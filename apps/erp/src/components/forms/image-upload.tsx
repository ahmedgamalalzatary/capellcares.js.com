"use client";

import { useRef, useState } from "react";
import { Icon } from "@/components/ui/icons";

interface Props {
  value: string | null;
  onChange: (dataUrl: string | null) => void;
  hint?: string;
}

// Mock upload — accepts a local file, encodes to data URL and reports back.
export function ImageUpload({ value, onChange, hint }: Props) {
  const ref = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFile = (file?: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => onChange(reader.result as string);
    reader.readAsDataURL(file);
  };

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files?.[0]); }}
      style={{
        border: `1.5px dashed ${dragOver ? "var(--accent)" : "var(--hairline-2)"}`,
        background: dragOver ? "var(--accent-soft)" : "#fff",
        borderRadius: 10,
        padding: 16,
        display: "grid",
        gap: 12,
        placeItems: "center",
        textAlign: "center"
      }}
    >
      {value ? (
        <>
          <img src={value} alt="" style={{ maxHeight: 160, borderRadius: 8 }} />
          <div className="row" style={{ gap: 8 }}>
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => ref.current?.click()}>
              <Icon.Upload size={14} /> استبدال الصورة
            </button>
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => onChange(null)}>
              <Icon.Trash size={14} /> إزالة
            </button>
          </div>
        </>
      ) : (
        <>
          <div style={{ width: 56, height: 56, borderRadius: "50%", background: "var(--bg-tint)", color: "var(--ink-3)", display: "grid", placeItems: "center" }}>
            <Icon.Upload />
          </div>
          <div>
            <div style={{ fontWeight: 600 }}>اسحبي الصورة هنا أو اضغطي للاختيار</div>
            <div className="faint" style={{ fontSize: 12, marginTop: 4 }}>{hint ?? "PNG / JPG / WEBP — حتى 4MB"}</div>
          </div>
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => ref.current?.click()}>
            <Icon.Upload size={14} /> اختيار صورة
          </button>
        </>
      )}
      <input
        type="file"
        accept="image/*"
        ref={ref}
        style={{ display: "none" }}
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
    </div>
  );
}
