// Lightweight text/colour stand-ins for the payment brand logos. Swap these
// for real SVG/PNG brand assets when they're available.
const METHODS = [
  { label: "mastercard", className: "italic font-bold text-orange-500" },
  { label: "VISA", className: "font-bold italic text-blue-700" },
  { label: "COD", className: "rounded bg-red-600 px-1.5 text-white text-[10px] font-bold" },
  { label: "sympl", className: "font-bold text-pink-500" },
  { label: "Pay", className: "font-semibold text-white before:content-['']" },
  { label: "valU", className: "font-bold text-teal-400" },
];

export function PaymentMethods() {
  return (
    <ul className="flex items-center gap-4 text-sm">
      {METHODS.map((m) => (
        <li key={m.label} className={m.className}>
          {m.label === "Pay" ? <span>Pay</span> : m.label}
        </li>
      ))}
    </ul>
  );
}
