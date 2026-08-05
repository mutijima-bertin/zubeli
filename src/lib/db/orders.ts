/**
 * Order queries + checkout order creation.
 * createOrder runs one interactive transaction: stock validation, stock
 * decrement, Order + OrderItem snapshots + Payment (PENDING) + OUT/ORDER
 * ledger entries + cart clearing (ADR 0001).
 */
import { randomBytes } from 'crypto';
import { Prisma, OrderStatus, PaymentMethod, PaymentStatus, InventoryMovementType, InventoryReason } from '@prisma/client';
import { prisma } from '../db';
import { idCursor, normalizeLimit, toPage, type PageParams } from './pagination';
import { InsufficientStockError, ProductNotFoundError } from './errors';

/** Delivery fee is snapshotted onto the order at checkout (ADR 0001). */
const DELIVERY_FEE_CENTS = Number(process.env.DELIVERY_FEE_CENTS ?? 2000);

export type CreateOrderInput = {
  userId?: string;
  customer: { name: string; phone: string; email?: string; address: string; city?: string };
  items: { productId: string; quantity: number }[];
  paymentMethod: PaymentMethod;
  bankTransferReference?: string;
  /** One order per cart: set to the cart id at checkout (idempotency). */
  idempotencyKey?: string;
  /** Cart to clear once the order is placed. */
  cartId?: string;
  currency?: string;
};

export const orderWithRelationsInclude = {
  items: { orderBy: { createdAt: 'asc' as const } },
  payment: true,
} satisfies Prisma.OrderInclude;

export type OrderWithRelations = Prisma.OrderGetPayload<{ include: typeof orderWithRelationsInclude }>;

export const orderDetailInclude = {
  ...orderWithRelationsInclude,
  customer: { select: { id: true, email: true, name: true, phone: true } },
} satisfies Prisma.OrderInclude;

export type OrderDetail = Prisma.OrderGetPayload<{ include: typeof orderDetailInclude }>;

function generateOrderNumber(): string {
  return `ZBL-${randomBytes(4).toString('hex').toUpperCase()}`;
}

export async function createOrder(input: CreateOrderInput): Promise<OrderWithRelations> {
  // Idempotency: if the same idempotencyKey (cart id) was already checked out,
  // return the existing order instead of creating a second one.
  if (input.idempotencyKey) {
    const existing = await prisma.order.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
      include: orderWithRelationsInclude,
    });
    if (existing) return existing;
  }

  const doCreate = async (): Promise<OrderWithRelations> => {
    const number = generateOrderNumber();
    const currency = input.currency ?? 'RWF';

    try {
      return await prisma.$transaction(async (tx) => {
        // 1. Load products (not soft-deleted) for stock validation + price snapshots
        const productIds = [...new Set(input.items.map((i) => i.productId))];
        const products = await tx.product.findMany({
          where: { id: { in: productIds }, deletedAt: null },
          select: { id: true, name: true, priceCents: true, stockQty: true },
        });
        const byId = new Map(products.map((p) => [p.id, p]));

        // 2. Validate stock — throws InsufficientStockError before any write
        let subtotalCents = 0;
        const lines = input.items.map((item) => {
          const product = byId.get(item.productId);
          if (!product) throw new ProductNotFoundError(item.productId);
          if (product.stockQty < item.quantity) {
            throw new InsufficientStockError(product.name, product.stockQty, item.quantity);
          }
          subtotalCents += product.priceCents * item.quantity;
          return { product, quantity: item.quantity };
        });

        const deliveryFeeCents = DELIVERY_FEE_CENTS;
        const totalCents = subtotalCents + deliveryFeeCents;

        // 3. Order + snapshot items + PENDING payment in one create
        const order = await tx.order.create({
          data: {
            number,
            customerId: input.userId ?? null,
            customerName: input.customer.name,
            customerPhone: input.customer.phone,
            customerEmail: input.customer.email ?? null,
            customerAddress: input.customer.address,
            customerCity: input.customer.city ?? null,
            subtotalCents,
            deliveryFeeCents,
            totalCents,
            currency,
            bankTransferReference: input.bankTransferReference ?? null,
            idempotencyKey: input.idempotencyKey ?? null,
            items: {
              create: lines.map((l) => ({
                productId: l.product.id,
                productName: l.product.name,
                unitPriceCents: l.product.priceCents,
                quantity: l.quantity,
              })),
            },
            payment: {
              create: {
                method: input.paymentMethod,
                status: PaymentStatus.PENDING,
                amountCents: totalCents,
                currency,
              },
            },
          },
          include: orderWithRelationsInclude,
        });

        // 4. Decrement stock + append OUT/ORDER ledger entries
        for (const line of lines) {
          await tx.product.update({
            where: { id: line.product.id },
            data: { stockQty: { decrement: line.quantity } },
          });
          await tx.inventoryMovement.create({
            data: {
              productId: line.product.id,
              type: InventoryMovementType.OUT,
              reason: InventoryReason.ORDER,
              quantity: line.quantity,
              orderId: order.id,
              note: `Order ${order.number}`,
            },
          });
        }

        // 5. Clear the cart — the checkout is complete
        if (input.cartId) {
          await tx.cartItem.deleteMany({ where: { cartId: input.cartId } });
        }

        return order;
      });
    } catch (e) {
      // Extremely rare: collision on the random ZBL-XXXXXXXX number — retry with a fresh one.
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002' &&
        Array.isArray(e.meta?.target) &&
        e.meta.target.includes('number')
      ) {
        return doCreate();
      }
      throw e;
    }
  };

  return doCreate();
}

export async function getOrderById(id: string): Promise<OrderDetail | null> {
  return prisma.order.findUnique({ where: { id }, include: orderDetailInclude });
}

/** Account order history (customer view), newest first, cursor-paginated. */
export async function listByUser({
  userId,
  cursor,
  limit,
}: PageParams & { userId: string }) {
  const take = normalizeLimit(limit, 10);
  const rows = await prisma.order.findMany({
    where: { customerId: userId },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: take + 1,
    ...idCursor(cursor),
    select: {
      id: true,
      number: true,
      status: true,
      totalCents: true,
      currency: true,
      createdAt: true,
      items: { select: { id: true, productName: true, quantity: true, unitPriceCents: true } },
      payment: { select: { method: true, status: true } },
    },
  });

  return toPage(rows, take);
}

export type ListAllAdminParams = PageParams & {
  status?: OrderStatus;
  paymentMethod?: PaymentMethod;
  search?: string;
};

/** Dashboard order list — filters by status / payment method, search, cursor-paginated. */
export async function listAllAdmin({
  status,
  paymentMethod,
  search,
  cursor,
  limit,
}: ListAllAdminParams = {}) {
  const take = normalizeLimit(limit, 25);
  const where: Prisma.OrderWhereInput = {
    ...(status ? { status } : {}),
    ...(paymentMethod ? { payment: { is: { method: paymentMethod } } } : {}),
    ...(search
      ? {
          OR: [
            { number: { contains: search, mode: 'insensitive' } },
            { customerName: { contains: search, mode: 'insensitive' } },
            { customerPhone: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const rows = await prisma.order.findMany({
    where,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: take + 1,
    ...idCursor(cursor),
    include: {
      items: { select: { id: true, productName: true, quantity: true, unitPriceCents: true } },
      payment: { select: { id: true, method: true, status: true, confirmedAt: true } },
      customer: { select: { id: true, email: true, name: true, phone: true } },
    },
  });

  return toPage(rows, take);
}
