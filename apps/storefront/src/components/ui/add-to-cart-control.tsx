"use client";

import { useEffect, useRef, useState } from "react";
import type { CartLine } from "@capella/shared";
import { Icon } from "@/components/ui/icons";
import { useCart } from "@/components/providers/cart-provider";

interface Props {
  /** One unit of the thing this card sells; the control owns the quantity. */
  line: CartLine;
  dict: any;
  /** Available stock when the card knows it — `+` stops there. */
  maxQty?: number;
  /** Applied to the add button so each card keeps its own padding. */
  className?: string;
}

const ADD_CLASS =
  "inline-flex flex-1 items-center justify-center gap-2 h-11 px-4 bg-accent font-semibold tracking-[0.01em] text-canvas transition-[transform,background,color,box-shadow] duration-150 hover:-translate-y-px hover:bg-accent-deep hover:shadow-(--shadow-1) active:translate-y-0 active:shadow-none focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2";

const STEP_CLASS =
  "grid h-9 w-9 place-items-center border-0 bg-transparent text-(--ink-2) transition-colors hover:bg-(--warm-soft) hover:text-ink disabled:pointer-events-none disabled:opacity-30";

/**
 * The card action row: add → confirm → quantity stepper.
 *
 * The stepper is derived from the cart, not from local state, so a card always
 * reflects what is actually in the bag — across reloads, and after the line is
 * removed elsewhere. Every step writes to the cart immediately; stepping below
 * one drops the line and hands the row back to the add button.
 */
export function AddToCartControl({ line, dict, maxQty, className }: Props) {
  const { lines, add, setQty, remove, keyOf } = useCart();
  const [added, setAdded] = useState(false);
  const addedResetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (addedResetTimeoutRef.current != null) {
      clearTimeout(addedResetTimeoutRef.current);
    }
  }, []);

  const key = keyOf(line);
  const qty = lines.find((item) => keyOf(item) === key)?.qty ?? 0;
  const atStock = maxQty != null && qty >= maxQty;

  const onAdd = (event: React.MouseEvent) => {
    event.preventDefault();
    add(line);
    setAdded(true);
    if (addedResetTimeoutRef.current != null) {
      clearTimeout(addedResetTimeoutRef.current);
    }
    addedResetTimeoutRef.current = setTimeout(() => {
      setAdded(false);
      addedResetTimeoutRef.current = null;
    }, 1400);
  };

  const onStep = (next: number) => (event: React.MouseEvent) => {
    event.preventDefault();
    if (next < 1) remove(key);
    else setQty(key, next);
  };

  // The confirmation holds the row for a beat before the stepper takes over.
  if (added) {
    return (
      <button type="button" className={className ?? ADD_CLASS} onClick={(event) => event.preventDefault()}>
        <Icon.Check size={16} />
        <span>{dict.common.added}</span>
      </button>
    );
  }

  if (qty > 0) {
    return (
      <div className="inline-flex h-11 flex-1 items-center justify-between border border-(--hairline) bg-surface px-1">
        <button type="button" aria-label="−" className={STEP_CLASS} onClick={onStep(qty - 1)}>
          <Icon.Minus />
        </button>
        <span className="text-sm font-semibold tabular-nums text-ink">
          {`${dict.common.quantity}: ${qty}`}
        </span>
        <button
          type="button"
          aria-label="+"
          className={STEP_CLASS}
          disabled={atStock}
          onClick={onStep(qty + 1)}
        >
          <Icon.Plus />
        </button>
      </div>
    );
  }

  return (
    <button type="button" className={className ?? ADD_CLASS} onClick={onAdd}>
      <span>{dict.common.addToCart}</span>
    </button>
  );
}
