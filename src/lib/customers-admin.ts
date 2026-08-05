/**
 * Admin customer queries — registered users with order aggregates + guest
 * order-snapshot customers (id: null, ADR 0004).
 * DB-REPO GAP (reported): there is no db/customers repo; aggregates are
 * composed here from prisma. Pagination is in-memory over the merged list —
 * fine at MVP data volumes, revisit before launch (database-agent follow-up).
 */
import 'server-only';
import { OrderStatus } from '@prisma/client';
import { prisma } from '@/lib/db';
import { NotFoundError } from '@/lib/errors';
import { normalizeLimit } from '@/lib/db/pagination';
import type { CustomerDTO, Page } from '@/types/api';

const PAID_STATUSES: OrderStatus[] = [OrderStatus.PAID, OrderStatus.FULFILLED];

type CustomerRow = {
  id: string | null;
  name: string;
  phone: string;
  email: string | null;
  ordersCount: number;
  totalSpentCents: number;
  lastOrderAt: string | null;
};

function rowKey(row: CustomerRow): string {
  return row.id ? `user:${row.id}` : `guest:${row.phone}:${row.name.toLowerCase()}`;
}

export async function listCustomers(params: {
  search?: string;
  cursor?: string;
  limit?: number;
}): Promise<Page<CustomerDTO>> {
  const take = normalizeLimit(params.limit, 25);
  const search = params.search?.trim();
  const searchWhere = search
    ? {
        OR: [
          { name: { contains: search, mode: 'insensitive' as const } },
          { email: { contains: search, mode: 'insensitive' as const } },
          { phone: { contains: search, mode: 'insensitive' as const } },
        ],
      }
    : undefined;

  // Registered users + their orders (all statuses; totals filter PAID/FULFILLED).
  const users = await prisma.user.findMany({
    where: searchWhere,
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      orders: { select: { status: true, totalCents: true, createdAt: true } },
    },
  });
  const userRows: CustomerRow[] = users.map((u) => {
    let totalSpentCents = 0;
    let lastOrderAt: string | null = null;
    for (const o of u.orders) {
      if (PAID_STATUSES.includes(o.status)) totalSpentCents += o.totalCents;
      const iso = o.createdAt.toISOString();
      if (!lastOrderAt || iso > lastOrderAt) lastOrderAt = iso;
    }
    return {
      id: u.id,
      name: u.name,
      phone: u.phone ?? '',
      email: u.email,
      ordersCount: u.orders.length,
      totalSpentCents,
      lastOrderAt,
    };
  });

  // Guest order snapshots (customerId null) grouped by phone + name.
  const guestOrders = await prisma.order.findMany({
    where: { customerId: null },
    select: { customerName: true, customerPhone: true, customerEmail: true, status: true, totalCents: true, createdAt: true },
  });
  const guestGroups = new Map<string, CustomerRow>();
  for (const o of guestOrders) {
    const name = o.customerName.trim();
    const phone = o.customerPhone.trim();
    if (!name || !phone) continue;
    if (search && !name.toLowerCase().includes(search.toLowerCase()) && !phone.includes(search)) continue;
    const key = `${phone}:${name.toLowerCase()}`;
    const existing = guestGroups.get(key);
    const iso = o.createdAt.toISOString();
    if (!existing) {
      guestGroups.set(key, {
        id: null,
        name,
        phone,
        email: o.customerEmail,
        ordersCount: 1,
        totalSpentCents: PAID_STATUSES.includes(o.status) ? o.totalCents : 0,
        lastOrderAt: iso,
      });
    } else {
      existing.ordersCount += 1;
      if (PAID_STATUSES.includes(o.status)) existing.totalSpentCents += o.totalCents;
      if (iso > (existing.lastOrderAt ?? '')) existing.lastOrderAt = iso;
    }
  }

  const merged = [...userRows, ...guestGroups.values()].sort((a, b) => {
    const ta = a.lastOrderAt ?? '';
    const tb = b.lastOrderAt ?? '';
    if (ta !== tb) return ta < tb ? 1 : -1;
    return rowKey(a) < rowKey(b) ? -1 : 1;
  });

  // In-memory cursor pagination: cursor = rowKey of the last item seen.
  const start = params.cursor ? merged.findIndex((r) => rowKey(r) === params.cursor) + 1 : 0;
  const slice = start < 0 ? [] : merged.slice(start, start + take + 1);
  const hasMore = slice.length > take;
  const items = hasMore ? slice.slice(0, take) : slice;

  return {
    items,
    nextCursor: hasMore && items.length > 0 ? rowKey(items[items.length - 1]!) : null,
    hasMore,
  };
}

/** Customer detail with recent order history + totals. Guests are visible via the orders screen only. */
export async function getCustomer(customerId: string): Promise<{
  customer: CustomerDTO;
  orders: {
    id: string;
    number: string;
    status: OrderStatus;
    totalCents: number;
    currency: string;
    createdAt: Date;
    items: { productName: string; quantity: number; unitPriceCents: number }[];
    payment: { method: 'COD_CASH' | 'COD_MOBILE_MONEY' | 'BANK_TRANSFER' | 'MOMO_GATEWAY' | 'CARD'; status: 'PENDING' | 'PAID' | 'REFUNDED' | 'FAILED' } | null;
  }[];
}> {
  const user = await prisma.user.findUnique({
    where: { id: customerId },
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      orders: {
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 50,
        select: {
          id: true,
          number: true,
          status: true,
          totalCents: true,
          currency: true,
          createdAt: true,
          items: { select: { productName: true, quantity: true, unitPriceCents: true } },
          payment: { select: { method: true, status: true } },
        },
      },
    },
  });
  if (!user) throw new NotFoundError('Customer not found');

  let totalSpentCents = 0;
  let lastOrderAt: string | null = null;
  for (const o of user.orders) {
    if (PAID_STATUSES.includes(o.status)) totalSpentCents += o.totalCents;
    const iso = o.createdAt.toISOString();
    if (!lastOrderAt || iso > lastOrderAt) lastOrderAt = iso;
  }

  return {
    customer: {
      id: user.id,
      name: user.name,
      phone: user.phone ?? '',
      email: user.email,
      ordersCount: user.orders.length,
      totalSpentCents,
      lastOrderAt,
    },
    orders: user.orders,
  };
}
