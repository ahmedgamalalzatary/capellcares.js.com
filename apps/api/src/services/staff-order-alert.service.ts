import { formatPrice } from "@capella/shared";

/** What a staff alert needs to know about a freshly placed website order. */
export interface NewOrderAlert {
  id: number;
  orderCode: string;
  fullName: string;
  phone: string;
  items: { nameAr: string; sizeLabel: string | null; qty: number; lineTotal: number }[];
  deliveryFee: number;
  totalAmount: number;
}

type AlertEnv = Partial<Record<"OPENWA_URL" | "OPENWA_API_KEY" | "OPENWA_SESSION_ID" | "STAFF_WHATSAPP_NUMBER" | "ERP_PUBLIC_URL", string>>;

type AlertOptions = {
  env?: AlertEnv | NodeJS.ProcessEnv;
  fetchFn?: typeof fetch;
  logger?: Pick<Console, "error">;
};

const SEND_TIMEOUT_MS = 10_000;

const trimSlash = (value: string) => value.replace(/\/+$/, "");

/** The Arabic WhatsApp message staff receive: order number, customer, items, totals and a link to the order in the ERP. */
export function buildNewOrderAlertText(order: NewOrderAlert, erpUrl?: string): string {
  const lines = [
    `🛒 طلب جديد #${order.orderCode}`,
    "",
    `👤 العميل: ${order.fullName}`,
    `📞 الهاتف: ${order.phone}`,
    "",
    "📦 المنتجات:",
    ...order.items.map((item) =>
      `• ${item.nameAr}${item.sizeLabel ? ` (${item.sizeLabel})` : ""} × ${item.qty} — ${formatPrice(item.lineTotal, "ar")}`
    ),
    "",
    `🚚 التوصيل: ${formatPrice(order.deliveryFee, "ar")}`,
    `💰 الإجمالي: ${formatPrice(order.totalAmount, "ar")}`
  ];
  if (erpUrl) lines.push("", `🔗 ${trimSlash(erpUrl)}/orders/${order.id}`);
  return lines.join("\n");
}

/**
 * Sends the new-order alert to the staff WhatsApp number through this store's OpenWA gateway.
 * Never throws: an alert that cannot be sent is logged and the order carries on untouched. Returns whether OpenWA accepted it.
 * Skipped (returns false) until OPENWA_URL, OPENWA_API_KEY, OPENWA_SESSION_ID and STAFF_WHATSAPP_NUMBER are all set.
 */
export async function sendNewOrderAlert(order: NewOrderAlert, options: AlertOptions = {}): Promise<boolean> {
  const env = (options.env ?? process.env) as AlertEnv;
  const logger = options.logger ?? console;
  const baseUrl = env.OPENWA_URL?.trim();
  const apiKey = env.OPENWA_API_KEY?.trim();
  const sessionId = env.OPENWA_SESSION_ID?.trim();
  // WhatsApp ids are the full international number, digits only (no "+", spaces or dashes).
  const staffNumber = env.STAFF_WHATSAPP_NUMBER?.replace(/\D/g, "");
  if (!baseUrl || !apiKey || !sessionId || !staffNumber) return false;

  const fetchFn = options.fetchFn ?? fetch;
  try {
    const response = await fetchFn(`${trimSlash(baseUrl)}/api/sessions/${encodeURIComponent(sessionId)}/messages/send-text`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": apiKey,
        // OpenWA drops a repeat with the same key for 24h, so a retried order never alerts twice.
        "Idempotency-Key": `new-order-${order.id}`
      },
      body: JSON.stringify({
        chatId: `${staffNumber}@c.us`,
        text: buildNewOrderAlertText(order, env.ERP_PUBLIC_URL?.trim()),
        linkPreview: false
      }),
      signal: AbortSignal.timeout(SEND_TIMEOUT_MS)
    });
    if (!response.ok) {
      logger.error("New-order WhatsApp alert was refused by OpenWA", { orderId: order.id, status: response.status, body: await response.text().catch(() => "") });
      return false;
    }
    return true;
  } catch (error) {
    logger.error("New-order WhatsApp alert could not reach OpenWA", { orderId: order.id, error });
    return false;
  }
}
