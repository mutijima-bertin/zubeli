import { Button, EmptyState } from "@/components/ui";

export default function CustomerNotFound() {
  return (
    <EmptyState
      title="Customer not found"
      description="This customer may have been removed, or the link is wrong."
      action={<Button href="/admin/customers">Back to customers</Button>}
    />
  );
}