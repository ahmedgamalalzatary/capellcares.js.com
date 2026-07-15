"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const POP_WIDTH = 232;
const POP_HEIGHT = 268;

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

const PRESETS = [
  "#1A1A1A", "#FFFFFF", "#B42318", "#C4320A", "#B54708",
  "#B8860B", "#3F6212", "#0F766E", "#175CD3", "#3538CD",
  "#6941C6", "#C11574", "#F4C2C2", "#E8D8C3", "#8B7355"
];

function normalizeHexDraft(raw: string): string | null {
  let value = raw.trim().replace(/^#*/, "");
  if (/^[0-9a-fA-F]{3}$/.test(value)) {
    value = value.split("").map((ch) => ch + ch).join("");
  }
  const hex = `#${value}`;
  return HEX_RE.test(hex) ? hex.toUpperCase() : null;
}

function isLightHex(hex: string): boolean {
  const { r, g, b } = hexToRgb(hex);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.82;
}

function hexToRgb(hex: string) {
  return {
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16)
  };
}

function rgbToHex(r: number, g: number, b: number): string {
  const to = (n: number) => Math.round(Math.min(255, Math.max(0, n))).toString(16).padStart(2, "0");
  return `#${to(r)}${to(g)}${to(b)}`.toUpperCase();
}

type Hsv = { h: number; s: number; v: number };

function hexToHsv(hex: string): Hsv {
  const { r, g, b } = hexToRgb(hex);
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === rn) h = ((gn - bn) / d) % 6;
    else if (max === gn) h = (bn - rn) / d + 2;
    else h = (rn - gn) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s: max === 0 ? 0 : d / max, v: max };
}

function hsvToHex({ h, s, v }: Hsv): string {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let rn = 0, gn = 0, bn = 0;
  if (h < 60) [rn, gn, bn] = [c, x, 0];
  else if (h < 120) [rn, gn, bn] = [x, c, 0];
  else if (h < 180) [rn, gn, bn] = [0, c, x];
  else if (h < 240) [rn, gn, bn] = [0, x, c];
  else if (h < 300) [rn, gn, bn] = [x, 0, c];
  else [rn, gn, bn] = [c, 0, x];
  return rgbToHex((rn + m) * 255, (gn + m) * 255, (bn + m) * 255);
}

type ColorSwatchFieldProps = {
  hex: string;
  label: string;
  onChange: (hex: string) => void;
};

export function ColorSwatchField({ hex, label, onChange }: ColorSwatchFieldProps) {
  const [draft, setDraft] = useState(hex.toUpperCase());
  const [invalid, setInvalid] = useState(false);
  const [open, setOpen] = useState(false);
  // hue/sat survive value changes that would otherwise collapse them (e.g. black)
  const [hsv, setHsv] = useState<Hsv>(() => hexToHsv(hex));
  const [popPos, setPopPos] = useState<{ top: number; left: number; up: boolean }>({ top: 0, left: 0, up: false });
  const rootRef = useRef<HTMLDivElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const areaRef = useRef<HTMLDivElement>(null);

  const placePopover = useCallback(() => {
    const anchor = rootRef.current;
    if (!anchor) return;
    const rect = anchor.getBoundingClientRect();
    const width = Math.min(POP_WIDTH, window.innerWidth - 24);
    const up = rect.bottom + 8 + POP_HEIGHT > window.innerHeight && rect.top - 8 - POP_HEIGHT > 0;
    const left = Math.max(12, Math.min(rect.left, window.innerWidth - width - 12));
    const top = up ? rect.top - 8 - POP_HEIGHT : rect.bottom + 8;
    setPopPos({ top, left, up });
  }, []);

  useEffect(() => {
    setDraft(hex.toUpperCase());
    setInvalid(false);
    setHsv((current) => (hsvToHex(current) === hex.toUpperCase() ? current : hexToHsv(hex)));
  }, [hex]);

  useEffect(() => {
    if (!open) return;
    placePopover();
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || popRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const onReflow = () => placePopover();
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("scroll", onReflow, true);
    window.addEventListener("resize", onReflow);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", onReflow, true);
      window.removeEventListener("resize", onReflow);
    };
  }, [open, placePopover]);

  const applyHsv = useCallback((next: Hsv) => {
    setHsv(next);
    onChange(hsvToHex(next));
  }, [onChange]);

  const pickFromArea = useCallback((event: React.PointerEvent) => {
    const area = areaRef.current;
    if (!area) return;
    const rect = area.getBoundingClientRect();
    const s = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    const v = 1 - Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height));
    setHsv((current) => {
      const next = { ...current, s, v };
      onChange(hsvToHex(next));
      return next;
    });
  }, [onChange]);

  const onAreaPointerDown = (event: React.PointerEvent) => {
    event.preventDefault();
    (event.target as HTMLElement).setPointerCapture?.(event.pointerId);
    pickFromArea(event);
  };

  const onAreaPointerMove = (event: React.PointerEvent) => {
    if (event.buttons & 1) pickFromArea(event);
  };

  const commitDraft = () => {
    const normalized = normalizeHexDraft(draft);
    if (normalized) {
      setDraft(normalized);
      setInvalid(false);
      if (normalized !== hex.toUpperCase()) onChange(normalized);
    } else {
      setDraft(hex.toUpperCase());
      setInvalid(false);
    }
  };

  const hueHex = hsvToHex({ h: hsv.h, s: 1, v: 1 });

  return (
    <div className="color-swatch-field" data-light={isLightHex(hex) || undefined} ref={rootRef}>
      <button
        type="button"
        className="color-swatch-field__coin"
        aria-label={label}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <i style={{ backgroundColor: hex }} />
      </button>
      <input
        className="color-swatch-field__hex"
        dir="ltr"
        spellCheck={false}
        value={draft}
        data-invalid={invalid || undefined}
        onChange={(event) => {
          setDraft(event.target.value);
          setInvalid(normalizeHexDraft(event.target.value) === null);
        }}
        onBlur={commitDraft}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            commitDraft();
          }
        }}
        aria-label={`${label} — كود Hex`}
        maxLength={7}
      />

      {open && createPortal(
        <div
          className="color-pop"
          data-up={popPos.up || undefined}
          style={{ top: popPos.top, left: popPos.left }}
          ref={popRef}
          role="dialog"
          aria-label={`اختيار ${label}`}
        >
          <div
            className="color-pop__area"
            ref={areaRef}
            style={{ backgroundColor: hueHex }}
            onPointerDown={onAreaPointerDown}
            onPointerMove={onAreaPointerMove}
          >
            <span
              className="color-pop__thumb"
              style={{
                left: `${hsv.s * 100}%`,
                top: `${(1 - hsv.v) * 100}%`,
                backgroundColor: hex
              }}
            />
          </div>
          <input
            className="color-pop__hue"
            type="range"
            min={0}
            max={360}
            step={1}
            value={Math.round(hsv.h)}
            onChange={(event) => applyHsv({ ...hsv, h: Number(event.target.value) })}
            aria-label="درجة اللون"
          />
          <div className="color-pop__presets">
            {PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                className="color-pop__preset"
                data-selected={preset === hex.toUpperCase() || undefined}
                style={{ backgroundColor: preset }}
                onClick={() => onChange(preset)}
                aria-label={preset}
              />
            ))}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
