"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { pickLang, type Language, type ReviewPrompt } from "@capella/shared";
import { useAuth } from "@/components/providers/auth-provider";
import { ReviewFormModal } from "@/components/reviews/review-form-modal";
import { claimReviewPrompt } from "@/lib/api/client";
import { resolveMediaUrl } from "@/lib/api/client/normalizers";

export function ReviewPromptProvider({ children, lang, dict }: { children?: ReactNode; lang: Language; dict: any }) {
  const { accessToken } = useAuth();
  const [claimedPrompt, setClaimedPrompt] = useState<{ prompt: ReviewPrompt; accessToken: string } | null>(null);
  const claimedForToken = useRef<string | null>(null);
  const prompt = claimedPrompt?.accessToken === accessToken ? claimedPrompt.prompt : null;

  useEffect(() => {
    setClaimedPrompt((current) => current?.accessToken === accessToken ? current : null);
    if (!accessToken || claimedForToken.current === accessToken) return;
    claimedForToken.current = accessToken;
    let cancelled = false;
    claimReviewPrompt(accessToken)
      .then((value) => {
        if (!cancelled) setClaimedPrompt(value ? { prompt: value, accessToken } : null);
      })
      .catch(() => {
        // The prompt is optional and must never interrupt storefront browsing.
        if (claimedForToken.current === accessToken) claimedForToken.current = null;
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  return (
    <>
      {children}
      {prompt && accessToken ? (
        <ReviewFormModal
          open
          accessToken={accessToken}
          itemName={pickLang(prompt.name, lang)}
          imagePath={resolveMediaUrl(prompt.imagePath)}
          target={prompt}
          dict={dict}
          onClose={() => setClaimedPrompt(null)}
          onSubmitted={() => setClaimedPrompt(null)}
        />
      ) : null}
    </>
  );
}
