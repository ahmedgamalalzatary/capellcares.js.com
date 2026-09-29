"use client";

import { useId, useRef, useState } from "react";
import type { AdminOrderDto, ShipmentEdit, ShippingBulkRequest, ShippingBulkResult } from "@capella/shared";
import { shipmentEditSchema } from "@capella/shared";
import { getStore } from "@/lib/store";

const actions = { manual_state: "تحديث الحالة اليدوية", retry: "إعادة محاولة الإرسال", reconcile: "التحقق من النتيجة لدى بوسطة",
  shipment_edit: "تعديل بيانات الشحنة / حجم العبوة", cancel: "إلغاء قبل الطباعة والاستلام", resolve_flags: "حل علامة متابعة" };
const states = { preparing: "جارٍ التجهيز", ready_for_pickup: "جاهز للاستلام", printed: "تمت الطباعة", delivered: "تم التسليم" };

export function ShippingActions({ orderIds, order, orderCodes = {}, onComplete }: {
  orderIds: number[]; order?: AdminOrderDto; orderCodes?: Record<number, string>; onComplete: () => void;
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
  const printed = shipping?.history.some(event => ["printed", "delivered", "returned"].includes(event.state)) ||
    ["printed", "delivered", "returned"].includes(shipping?.manualState ?? "");
  const pickedUp = shipping?.processing.pickupAtMs != null;
  const pendingEdit = shipping?.workItem?.operation === "edit_delivery" && ["processing", "review_required"].includes(shipping.workItem.status);
  const editable = !locked && !pickedUp && !pendingEdit && shipping?.editEnabled !== false &&
    !["delivered", "returned"].includes(shipping?.manualState ?? "") && !(order?.refundedAmountCents);
  const currentFlagId = shipping?.flags?.some(flag => flag.id === flagId) ? flagId : shipping?.flags?.[0]?.id;

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
      if (fullName.trim() || phone.trim()) patch.recipient = { ...(fullName.trim() ? { fullName: fullName.trim() } : {}), ...(phone.trim() ? { phone: phone.trim() } : {}) };
      if (size) patch.size = size as ShipmentEdit["size"];
      if (editNotes) patch.notes = notes;
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
    savingRef.current = true; setSaving(true); setError(""); setResults([]);
    try {
      if (order) {
        await getStore().performShippingAction(order.id, input);
        setResults([{ orderId: order.id, status: "ok" }]);
      } else {
        const response = await getStore().runBulkShippingAction({ ...input, orderIds });
        setResults(response.results);
      }
      onComplete();
    } catch { setError("تعذر تنفيذ إجراء الشحن. تحققي من حالة الطلب لدى بوسطة ثم أعيدي تحميل البيانات."); }
    finally { savingRef.current = false; setSaving(false); }
  }

  if (!currentAction) return null;
  return <section className="card card--pad-lg" aria-label="إجراءات الشحن">
    <form onSubmit={submit} className="stack">
      <h3>إجراءات الشحن{!order && ` — ${orderIds.length} طلب`}</h3>
      {!order && <p className="muted">الطلبات المحددة: {orderIds.map(value => orderCodes[value] ?? `#${value}`).join("، ")}</p>}
      <fieldset disabled={saving} className="stack" style={{ border: 0, padding: 0, margin: 0 }}>
        <div className="field"><label htmlFor={`${id}-action`}>إجراء الشحن</label>
          <select id={`${id}-action`} className="select" value={currentAction} onChange={e => { setAction(e.target.value as typeof action); setError(""); }}>
            {(Object.entries(actions) as [ShippingBulkRequest["action"], string][]).filter(([key]) => allowed(key)).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select></div>
        {currentAction === "manual_state" && <div className="field"><label htmlFor={`${id}-state`}>الحالة اليدوية الجديدة</label>
          <select id={`${id}-state`} className="select" value={state} onChange={e => setState(e.target.value as typeof state)}>
            {Object.entries(states).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select></div>}
        {["manual_state", "cancel"].includes(currentAction) && <div className="field"><label htmlFor={`${id}-reason`}>سبب الإجراء (اختياري)</label>
          <input id={`${id}-reason`} className="input" maxLength={1000} value={reason} onChange={e => setReason(e.target.value)} /></div>}
        {currentAction === "cancel" && <p className="muted">الإلغاء الآمن يعيد المخزون بعد التحقق. استرداد باي موب يتم يدويًا من لوحته.</p>}
        {currentAction === "shipment_edit" && <>
          <p className="muted">عدّلي الحقول المطلوبة فقط. تكلفة الطلب ثابتة؛ تغيير المنطقة يحتاج طلبًا جديدًا.</p>
          <div className="field"><label htmlFor={`${id}-name`}>اسم المستلم الجديد</label><input id={`${id}-name`} className="input" maxLength={255} value={fullName} onChange={e => setFullName(e.target.value)} /></div>
          <div className="field"><label htmlFor={`${id}-phone`}>هاتف المستلم الجديد</label><input id={`${id}-phone`} className="input" dir="ltr" value={phone} onChange={e => setPhone(e.target.value)} /></div>
          <div className="field"><label htmlFor={`${id}-address`}>العنوان الجديد</label><input id={`${id}-address`} className="input" maxLength={255} value={addressLine} onChange={e => setAddressLine(e.target.value)} /></div>
          <div className="field"><label htmlFor={`${id}-building`}>المبنى / الشقة الجديدة</label><input id={`${id}-building`} className="input" maxLength={255} value={building} onChange={e => setBuilding(e.target.value)} /></div>
          <div className="field"><label htmlFor={`${id}-size`}>حجم العبوة الجديد</label><select id={`${id}-size`} className="select" value={size} onChange={e => setSize(e.target.value)}>
            <option value="">بدون تغيير</option><option value="small">صغير</option><option value="medium">وسط</option><option value="large">كبير</option></select></div>
          <label><input type="checkbox" checked={editNotes} onChange={e => setEditNotes(e.target.checked)} /> تعديل الملاحظات</label>
          {editNotes && <div className="field"><label htmlFor={`${id}-notes`}>ملاحظات الشحنة الجديدة</label><textarea id={`${id}-notes`} className="input" maxLength={4000} value={notes} onChange={e => setNotes(e.target.value)} /></div>}
        </>}
        {currentAction === "resolve_flags" && <>
          {order && <div className="field"><label htmlFor={`${id}-flag`}>علامة المتابعة</label><select id={`${id}-flag`} className="select" value={currentFlagId} onChange={e => setFlagId(Number(e.target.value))}>
            {shipping?.flags?.map(flag => <option key={flag.id} value={flag.id}>{flag.reason}</option>)}</select></div>}
          <div className="field"><label htmlFor={`${id}-note`}>ما الذي تم التحقق منه؟</label><textarea id={`${id}-note`} className="input" required maxLength={1000} value={note} onChange={e => setNote(e.target.value)} /></div>
          <p className="muted">حل العلامة يسجل المتابعة فقط؛ لا يؤكد الدفع أو الإلغاء أو استعادة المخزون.</p>
        </>}
        <button type="submit" className="btn" disabled={!orderIds.length || orderIds.length > 50}>{saving ? "جارٍ التنفيذ…" : "تنفيذ الإجراء"}</button>
      </fieldset>
      {error && <p role="alert">{error}</p>}
      <div aria-live="polite">{results.map(result => <p key={result.orderId}>{orderCodes[result.orderId] ?? order?.orderCode ?? `#${result.orderId}`}: {result.status === "ok" ? "تم" : `تعذر التنفيذ — ${result.message}`}</p>)}</div>
    </form>
  </section>;
}
