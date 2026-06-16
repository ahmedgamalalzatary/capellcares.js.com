"use client";

export function CategoryPill({
  name,
  checked,
  onChange,
  children,
  indent = false
}: {
  name: string;
  checked: boolean;
  onChange: () => void;
  children: React.ReactNode;
  indent?: boolean;
}) {
  return (
    <label
      style={{
        display: "flex",
        cursor: "pointer",
        marginInlineStart: indent ? "16px" : "0"
      }}
    >
      <input type="radio" name={name} checked={checked} onChange={onChange} className="sr-only" />
      <span
        style={{
          display: "flex",
          alignItems: "center",
          width: "100%",
          height: indent ? 30 : 34,
          paddingInline: "14px",
          borderRadius: "var(--radius)",
          fontSize: indent ? "12px" : "13px",
          fontWeight: checked ? 600 : 400,
          border: checked ? "1px solid var(--accent)" : "1px solid transparent",
          background: checked ? "oklch(0.32 0.018 85 / 0.08)" : "transparent",
          color: checked ? "var(--accent)" : "var(--ink-3)",
          transition: "background 180ms, border-color 180ms, color 180ms"
        }}
      >
        {checked && (
          <span
            style={{
              width: 5,
              height: 5,
              borderRadius: "50%",
              background: "var(--accent)",
              marginInlineEnd: 10,
              flexShrink: 0
            }}
          />
        )}
        {children}
      </span>
    </label>
  );
}
