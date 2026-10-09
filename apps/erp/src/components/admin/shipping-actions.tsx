"use client";

import { useId, useRef, useState } from "react";
import type { AdminOrderDto, ShipmentEdit, ShippingBulkRequest, ShippingBulkResult } from "@capella/shared";
import { shipmentEditSchema } from "@capella/shared";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input, Select, Textarea } from "@/components/ui/input";
import { getStore } from "@/lib/store";

const actions = {
  manual_state: "تحديث الحالة اليدوية", retry: "إعادة محاولة الإرسال", reconcile: "التحقق من النتيجة لدى بوسطة",
  shipment_edit: "تعديل بيانات الشحنة / حجم العبوة", cancel: "إلغاء قبل الطباعة والاستلام", resolve_flags: "حل علامة متابعة"
};
const states = { preparing: "جارٍ التجهيز", ready_for_pickup: "جاهز للاستلام", printed: "تمت الطباعة", delivered: "تم التسليم" };

export function ShippingActions({ orderIds, order, orderCodes = {}, onComplete }: {
  orderIds: number[];
  order?: AdminOrderDto;
  orderCodes?: Record<number, string>;
  onComplete: () => void;
}) {
  const id = useId();
  const [action, setAction] = useState<ShippingBulkRequest["action"]>("manual_state");
  const [state, setState] = useState<keyof typeof states>("preparing");
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [flagId, setFlagId] = useState(order?.shipping?.flags?.[0]?.id ?? 0);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [addressLine, setAddressLine] = useState("");
  const [building, setBuilding] = useState("");
  const [size, setSize] = useState("");
  const [notes, setNotes] = useState("");
  const [editNotes, setEditNotes] = useState(false);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [error, setError] = useState("");
  const [results, setResults] = useState<ShippingBulkResult[]>([]);
  const shipping = order?.shipping;
  const locked = !!shipping?.cancellation || order?.paymentStatus === "denied";
  const printed = shipping?.history.some((event) => ["printed", "delivered", "returned"].includes(event.state)) ||
    ["printed", "delivered", "returned"].includes(shipping?.manualState ?? "");
  const pickedUp = shipping?.processing.pickupAtMs != null;
  const pendingEdit = shipping?.hasPendingEdit ?? (shipping?.workItem?.operation === "edit_delivery" && ["processing", "review_required"].includes(shipping.workItem.status));
  const editable = !locked && !pickedUp && !pendingEdit && shipping?.editEnabled !== false &&
    !["delivered", "returned"].includes(shipping?.manualState ?? "") && !(order?.refundedAmountCents);
  // Fields without verified merchant evidence are hidden/disabled client-side; the server still refuses them, so this is only a UI courtesy.
  const editFields = shipping?.editFields;
  const allowsField = (field: "recipientName" | "notes" | "size") => !editFields || editFields.includes(field);
  const currentFlagId = shipping?.flags?.some((flag) => flag.id === flagId) ? flagId : shipping?.flags?.[0]?.id;

  const allowed = (key: ShippingBulkRequest["action"]) => {
    if (!order) return true;
    if (key === "cancel") return !locked && !printed && !pickedUp && !pendingEdit && !(shipping?.collection.confirmed);
    if (key === "manual_state") return !locked;
    if (key === "shipment_edit") return editable;
    if (key === "resolve_flags") return !!shipping?.flags?.length;
    if (key === "retry") return shipping?.workItem?.operation === "create_delivery" && shipping.workItem.status === "failed" && !locked;
    return pendingEdit || (shipping?.workItem?.operation === "create_delivery" && shipping.workItem.status === "review_required" &&
      ["CREATE_UNCERTAIN", "ATTEMPT_LIMIT_REVIEW"].includes(shipping.workItem.lastError ?? ""));
  };
  const currentAction = allowed(action) ? action : (Object.keys(actions) as ShippingBulkRequest["action"][]).find(allowed);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (savingRef.current || !currentAction || !orderIds.length) return;
    const input: Omit<ShippingBulkRequest, "orderIds"> & { flagId?: number } = { action: currentAction };
    if (currentAction === "manual_state") input.state = state;
    if (["cancel", "manual_state"].includes(currentAction) && reason.trim()) input.reason = reason.trim();
    if (currentAction === "resolve_flags") { input.note = note.trim(); if (order) input.flagId = currentFlagId; }
    if (currentAction === "shipment_edit") {
      const patch: ShipmentEdit = {};
      const recipient: NonNullable<ShipmentEdit["recipient"]> = {};
      if (fullName.trim() && allowsField("recipientName")) recipient.fullName = fullName.trim();
      if (phone.trim()) recipient.phone = phone.trim();
      if (Object.keys(recipient).length) patch.recipient = recipient;
      if (size && allowsField("size")) patch.size = size as ShipmentEdit["size"];
      if (editNotes && allowsField("notes")) patch.notes = notes;
      if (addressLine.trim() || building.trim()) {
        if (!addressLine.trim() || !building.trim()) { setError("أدخلي العنوان والمبنى معًا."); return; }
        if (order) {
          if (!shipping?.destination) { setError("أعيدي تحميل بيانات العنوان."); return; }
          patch.address = { ...shipping.destination, addressLine: addressLine.trim(), buildingApartment: building.trim() };
        } else input.addressLines = { addressLine: addressLine.trim(), buildingApartment: building.trim() };
      }
      if (Object.keys(patch).length || !input.addressLines) {
        if (!shipmentEditSchema.safeParse(patch).success) { setError("راجعي بيانات التعديل؛ أدخلي تغييرًا صحيحًا."); return; }
        input.patch = patch;
      }
    }
    savingRef.current = true;
    setSaving(true);
    setError("");
    setResults([]);
    try {
      if (order) {
        await getStore().performShippingAction(order.id, input);
        setResults([{ orderId: order.id, status: "ok" }]);
      } else {
        const response = await getStore().runBulkShippingAction({ ...input, orderIds });
        setResults(response.results);
      }
      onComplete();
    } catch {
      setError("تعذر تنفيذ إجراء الشحن. تحققي من حالة الطلب لدى بوسطة ثم أعيدي تحميل البيانات.");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  if (!currentAction) return null;

  return (
    <Card>
      <CardHeader
        title={order ? "إجراءات الشحن" : `إجراءات الشحن — ${orderIds.length} طلب`}
        description={!order ? `الطلبات المحددة: ${orderIds.map((value) => orderCodes[value] ?? `#${value}`).join("، ")}` : undefined}
      />
      <CardBody>
        <form onSubmit={submit} className="grid gap-4">
          <fieldset disabled={saving} className="grid gap-4">
            <Field label="إجراء الشحن" htmlFor={`${id}-action`}>
              <Select id={`${id}-action`} value={currentAction} onChange={(event) => { setAction(event.target.value as typeof action); setError(""); }}>
                {(Object.entries(actions) as [ShippingBulkRequest["action"], string][]).filter(([key]) => allowed(key)).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </Select>
            </Field>

            {currentAction === "manual_state" ? (
              <Field label="الحالة اليدوية الجديدة" htmlFor={`${id}-state`}>
                <Select id={`${id}-state`} value={state} onChange={(event) => setState(event.target.value as typeof state)}>
                  {Object.entries(states).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                </Select>
              </Field>
            ) : null}

            {["manual_state", "cancel"].includes(currentAction) ? (
              <Field label="سبب الإجراء" htmlFor={`${id}-reason`} hint="اختياري.">
                <Input id={`${id}-reason`} maxLength={1000} value={reason} onChange={(event) => setReason(event.target.value)} />
              </Field>
            ) : null}
            {currentAction === "cancel" ? <Alert tone="info">الإلغاء الآمن يعيد المخزون بعد التحقق. استرداد باي موب يتم يدويًا من لوحته.</Alert> : null}

            {currentAction === "shipment_edit" ? (
              <>
                <Alert tone="info">عدّلي الحقول المطلوبة فقط. تكلفة الطلب ثابتة؛ تغيير المنطقة يحتاج طلبًا جديدًا.</Alert>
                <div className="grid gap-x-4 gap-y-4 @lg:grid-cols-2">
                  <Field label="اسم المستلم الجديد" htmlFor={`${id}-name`} hint={!allowsField("recipientName") ? "غير متاح لحسابك حتى يتم التحقق منه." : undefined}>
                    <Input id={`${id}-name`} maxLength={255} value={fullName} disabled={!allowsField("recipientName")} onChange={(event) => setFullName(event.target.value)} />
                  </Field>
                  <Field label="هاتف المستلم الجديد" htmlFor={`${id}-phone`}>
                    <Input id={`${id}-phone`} dir="ltr" value={phone} onChange={(event) => setPhone(event.target.value)} />
                  </Field>
                  <Field label="العنوان الجديد" htmlFor={`${id}-address`}>
                    <Input id={`${id}-address`} maxLength={255} value={addressLine} onChange={(event) => setAddressLine(event.target.value)} />
                  </Field>
                  <Field label="المبنى / الشقة الجديدة" htmlFor={`${id}-building`}>
                    <Input id={`${id}-building`} maxLength={255} value={building} onChange={(event) => setBuilding(event.target.value)} />
                  </Field>
                  <Field label="حجم العبوة الجديد" htmlFor={`${id}-size`} hint={!allowsField("size") ? "غير متاح لحسابك حتى يتم التحقق منه." : undefined}>
                    <Select id={`${id}-size`} value={size} disabled={!allowsField("size")} onChange={(event) => setSize(event.target.value)}>
                      <option value="">بدون تغيير</option>
                      <option value="small">صغير</option>
                      <option value="medium">وسط</option>
                      <option value="large">كبير</option>
                    </Select>
                  </Field>
                </div>
                <label className="flex items-center gap-2 text-base text-text-2">
                  <input type="checkbox" className="size-4" checked={editNotes} disabled={!allowsField("notes")} onChange={(event) => setEditNotes(event.target.checked)} />
                  تعديل الملاحظات
                </label>
                {editNotes && allowsField("notes") ? (
                  <Field label="ملاحظات الشحنة الجديدة" htmlFor={`${id}-notes`}>
                    <Textarea id={`${id}-notes`} maxLength={4000} value={notes} onChange={(event) => setNotes(event.target.value)} />
                  </Field>
                ) : null}
              </>
            ) : null}

            {currentAction === "resolve_flags" ? (
              <>
                {order ? (
                  <Field label="علامة المتابعة" htmlFor={`${id}-flag`}>
                    <Select id={`${id}-flag`} value={currentFlagId} onChange={(event) => setFlagId(Number(event.target.value))}>
                      {shipping?.flags?.map((flag) => <option key={flag.id} value={flag.id}>{flag.reason}</option>)}
                    </Select>
                  </Field>
                ) : null}
                <Field label="ما الذي تم التحقق منه؟" htmlFor={`${id}-note`}>
                  <Textarea id={`${id}-note`} required maxLength={1000} value={note} onChange={(event) => setNote(event.target.value)} />
                </Field>
                <Alert tone="info">حل العلامة يسجل المتابعة فقط؛ لا يؤكد الدفع أو الإلغاء أو استعادة المخزون.</Alert>
              </>
            ) : null}

            <div>
              <Button type="submit" variant="primary" disabled={!orderIds.length || orderIds.length > 50}>
                {saving ? "جارٍ التنفيذ…" : "تنفيذ الإجراء"}
              </Button>
            </div>
          </fieldset>

          {error ? <Alert tone="danger">{error}</Alert> : null}
          {results.length > 0 ? (
            <div aria-live="polite" className="grid gap-1 text-sm text-text-2">
              {results.map((result) => (
                <p key={result.orderId}>
                  {orderCodes[result.orderId] ?? order?.orderCode ?? `#${result.orderId}`}: {result.status === "ok" ? "تم" : `تعذر التنفيذ — ${result.message}`}
                </p>
              ))}
            </div>
          ) : null}
        </form>
      </CardBody>
    </Card>
  );
}
