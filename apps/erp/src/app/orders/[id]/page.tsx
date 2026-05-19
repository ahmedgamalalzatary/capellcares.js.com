import { notFound } from "next/navigation";
import { OrderDetailsView } from "@/components/orders/order-details-view";

export default async function OrderDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const orderId = Number.parseInt(id, 10);

  if (!Number.isInteger(orderId) || orderId <= 0) {
    notFound();
  }

  return <OrderDetailsView orderId={orderId} crumbLabel={id} />;
}
