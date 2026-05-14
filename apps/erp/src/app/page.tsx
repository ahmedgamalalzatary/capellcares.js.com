"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAdminAuth } from "@/components/providers/admin-auth";

export default function HomeRedirect() {
  const router = useRouter();
  const { user, hydrated } = useAdminAuth();
  useEffect(() => {
    if (!hydrated) return;
    router.replace(user ? "/dashboard" : "/login");
  }, [hydrated, user, router]);
  return null;
}
