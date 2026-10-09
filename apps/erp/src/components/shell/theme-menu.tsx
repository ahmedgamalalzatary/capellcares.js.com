"use client";

import { DropdownMenu } from "radix-ui";
import { Check, Monitor, Moon, Sun } from "lucide-react";
import { useThemePreference, type ThemePreference } from "@/lib/theme";

const OPTIONS: Array<{ value: ThemePreference; label: string; icon: typeof Sun }> = [
  { value: "light", label: "فاتح", icon: Sun },
  { value: "dark", label: "داكن", icon: Moon },
  { value: "system", label: "حسب الجهاز", icon: Monitor },
];

export function ThemeMenu() {
  const { preference, setPreference } = useThemePreference();
  const current = OPTIONS.find((option) => option.value === preference) ?? OPTIONS[2];
  const CurrentIcon = current.icon;

  return (
    <DropdownMenu.Root dir="rtl" modal={false}>
      <DropdownMenu.Trigger
        aria-label={`المظهر: ${current.label}`}
        title="المظهر"
        className="grid size-9 shrink-0 place-items-center rounded-control text-rail-muted transition-colors hover:bg-rail-hover hover:text-rail-strong focus-visible:outline-rail-accent data-[state=open]:bg-rail-hover data-[state=open]:text-rail-strong"
      >
        <CurrentIcon className="size-[18px]" />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          side="top"
          align="start"
          sideOffset={8}
          className="z-50 grid min-w-44 gap-0.5 rounded-control bg-surface p-1.5 shadow-float data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
        >
          <DropdownMenu.Label className="px-2.5 pt-1 pb-1.5 text-xs text-text-muted">المظهر</DropdownMenu.Label>
          <DropdownMenu.RadioGroup value={preference} onValueChange={(value) => setPreference(value as ThemePreference)}>
            {OPTIONS.map(({ value, label, icon: OptionIcon }) => (
              <DropdownMenu.RadioItem
                key={value}
                value={value}
                className="flex h-9 cursor-pointer select-none items-center gap-2.5 rounded-md px-2.5 text-base text-text outline-none data-[highlighted]:bg-hover data-[highlighted]:text-text-strong pointer-coarse:h-11"
              >
                <OptionIcon className="size-4 text-text-muted" />
                <span className="flex-1">{label}</span>
                <DropdownMenu.ItemIndicator><Check className="size-4 text-nude-strong" /></DropdownMenu.ItemIndicator>
              </DropdownMenu.RadioItem>
            ))}
          </DropdownMenu.RadioGroup>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
