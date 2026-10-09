"use client";

import { useState } from "react";

export interface WizardStep {
  id: string;
  label: string;
}

export interface WizardRequirement {
  key: string;
  target: string;
  ok: boolean;
}

export type WizardStepState = "done" | "missing" | "todo";

interface Options<T extends WizardStep> {
  steps: readonly T[];
  requirements: readonly WizardRequirement[];
  editing?: boolean;
  /** When true, `next` validates even while editing (category form). */
  validateWhenEditing?: boolean;
  checkRequirements: (keys: string[]) => boolean;
}

/** Step / reached / goTo / next / stepItems engine shared by the wizard forms. */
export function useWizardSteps<T extends WizardStep>({ steps, requirements, editing = false, validateWhenEditing = false, checkRequirements }: Options<T>) {
  const [step, setStep] = useState(0);
  const [reached, setReached] = useState(editing ? steps.length - 1 : 0);

  const goTo = (index: number) => {
    setStep(index);
    setReached((current) => Math.max(current, index));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const next = () => {
    const keys = requirements.filter((requirement) => requirement.target === steps[step]!.id).map((requirement) => requirement.key);
    if ((!editing || validateWhenEditing) && !checkRequirements(keys)) return;
    goTo(step + 1);
  };

  const back = () => goTo(step - 1);

  const stepIndex = (id: T["id"]) => steps.findIndex((candidate) => candidate.id === id);

  const stepItems = steps.map((item, index): { id: T["id"]; label: string; state: WizardStepState } => {
    const required = requirements.filter((requirement) => requirement.target === item.id);
    const unmet = required.some((requirement) => !requirement.ok);
    const seen = editing || index < step || index < reached;
    if (unmet) return { id: item.id, label: item.label, state: seen ? "missing" : "todo" };
    return { id: item.id, label: item.label, state: seen ? "done" : "todo" };
  });

  return { step, current: steps[step]!, goTo, next, back, stepIndex, stepItems, reached };
}
