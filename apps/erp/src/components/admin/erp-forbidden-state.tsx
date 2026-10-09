"use client";

import { Lock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";

export function ErpForbiddenState({ message }: { message: string }) {
  return (
    <Card>
      <EmptyState icon={<Lock />} title="غير مصرح" description={message} />
    </Card>
  );
}
