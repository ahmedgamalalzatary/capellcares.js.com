"use client";

import { useEffect, useRef, type RefObject } from "react";

const FOCUSABLE = "button:not([disabled]), [href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex='-1'])";
let activeModalCount = 0;
let originalBodyOverflow = "";
const modalStack: symbol[] = [];
const backgroundLocks = new Map<HTMLElement, { count: number; inert: boolean; ariaHidden: string | null }>();

function lockBackground(element: HTMLElement) {
  const lock = backgroundLocks.get(element);
  if (lock) {
    lock.count += 1;
    return;
  }
  backgroundLocks.set(element, {
    count: 1,
    inert: element.inert,
    ariaHidden: element.getAttribute("aria-hidden")
  });
  element.inert = true;
  element.setAttribute("aria-hidden", "true");
}

function unlockBackground(element: HTMLElement) {
  const lock = backgroundLocks.get(element);
  if (!lock) return;
  lock.count -= 1;
  if (lock.count > 0) return;
  backgroundLocks.delete(element);
  element.inert = lock.inert;
  if (lock.ariaHidden == null) element.removeAttribute("aria-hidden");
  else element.setAttribute("aria-hidden", lock.ariaHidden);
}

export function useModalAccessibility(
  open: boolean,
  overlayRef: RefObject<HTMLElement | null>,
  dialogRef: RefObject<HTMLElement | null>,
  onClose: () => void
) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const modalToken = Symbol("modal");
    modalStack.push(modalToken);
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (activeModalCount === 0) originalBodyOverflow = document.body.style.overflow;
    activeModalCount += 1;
    const overlay = overlayRef.current;
    const siblings: HTMLElement[] = overlay?.parentElement
      ? Array.from(overlay.parentElement.children).filter(
          (element): element is HTMLElement => element !== overlay && element instanceof HTMLElement &&
            !element.matches('[role="dialog"][aria-modal="true"]') &&
            !element.querySelector('[role="dialog"][aria-modal="true"]')
        )
      : [];

    document.body.style.overflow = "hidden";
    for (const element of siblings) lockBackground(element);

    const focusable = () => Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []);
    focusable()[0]?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (modalStack[modalStack.length - 1] !== modalToken) return;
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const elements = focusable();
      if (elements.length === 0) {
        event.preventDefault();
        dialogRef.current?.focus();
        return;
      }
      const first = elements[0]!;
      const last = elements[elements.length - 1]!;
      if (event.shiftKey && (document.activeElement === first || !dialogRef.current?.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !dialogRef.current?.contains(document.activeElement))) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      const wasTopModal = modalStack[modalStack.length - 1] === modalToken;
      const stackIndex = modalStack.indexOf(modalToken);
      if (stackIndex >= 0) modalStack.splice(stackIndex, 1);
      activeModalCount = Math.max(0, activeModalCount - 1);
      if (activeModalCount === 0) document.body.style.overflow = originalBodyOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      for (const element of siblings) unlockBackground(element);
      if (wasTopModal && previousFocus?.isConnected) previousFocus.focus();
    };
  }, [dialogRef, open, overlayRef]);
}
