import type { NextFunction, Request, Response } from "express";
import {
  deleteAdviceRepo,
  listAdvicesRepo,
  reorderAdvicesRepo,
  toggleAdviceStatusRepo,
  upsertAdviceRepo
} from "../../../repositories/advice.repository.js";
import { triggerStorefrontRevalidation } from "../storefront-revalidation.js";

function isBilingualText(value: unknown): value is { ar: string; en: string } {
  return Boolean(
    value &&
    typeof value === "object" &&
    typeof (value as { ar?: unknown }).ar === "string" &&
    typeof (value as { en?: unknown }).en === "string"
  );
}

function sanitizeOptionalText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function sanitizeRequiredVideoUrl(value: unknown): string | null {
  const sanitized = sanitizeOptionalText(value);
  return sanitized;
}

function toAdviceDto(item: any) {
  return {
    id: item.id,
    title: { ar: item.arTitle, en: item.enTitle },
    description: { ar: item.arDescription, en: item.enDescription },
    videoUrl: item.videoUrl,
    status: item.status,
    sortOrder: item.sortOrder ?? 0,
    createdAt: item.createdAt?.toISOString?.() ?? String(item.createdAt ?? ""),
    updatedAt: item.updatedAt?.toISOString?.() ?? String(item.updatedAt ?? "")
  };
}

async function safeTriggerAdviceRevalidation() {
  try {
    await triggerStorefrontRevalidation({ entity: "advice" });
  } catch (error) {
    console.warn("Failed to trigger storefront revalidation for advice", error);
  }
}

export async function listAdminAdvicesController(_req: Request, res: Response) {
  res.json({ items: (await listAdvicesRepo(true)).map(toAdviceDto) });
}

export async function upsertAdviceController(req: Request, res: Response) {
  const input = req.body as any;
  if (!isBilingualText(input?.title) || !isBilingualText(input?.description)) {
    return res.status(400).json({ error: "Invalid advice payload" });
  }

  let id: number | undefined;
  if (input.id != null && input.id !== "") {
    const parsedId = Number.parseInt(String(input.id), 10);
    if (!Number.isInteger(parsedId) || parsedId <= 0) {
      return res.status(400).json({ error: "Invalid advice id" });
    }
    id = parsedId;
  }

  if (input.status != null && input.status !== "active" && input.status !== "inactive") {
    return res.status(400).json({ error: "Invalid advice status" });
  }

  const videoUrl = sanitizeRequiredVideoUrl(input.videoUrl);
  if (!videoUrl) {
    return res.status(400).json({ error: "Invalid advice video URL" });
  }

  await upsertAdviceRepo({
    id,
    arTitle: input.title.ar,
    enTitle: input.title.en,
    arDescription: input.description.ar,
    enDescription: input.description.en,
    videoUrl,
    status: input.status ?? "inactive"
  });
  await safeTriggerAdviceRevalidation();
  res.json({ ok: true });
}

export async function reorderAdvicesController(req: Request, res: Response, next: NextFunction) {
  const ids = Array.isArray(req.body?.ids)
    ? req.body.ids.map((value: unknown): number => Number(value))
    : [];

  if (ids.length === 0 || ids.some((id: number) => !Number.isInteger(id) || id <= 0)) {
    return res.status(400).json({ ok: false, reason: "invalid-advice-order" });
  }

  try {
    await reorderAdvicesRepo({ ids });
    await safeTriggerAdviceRevalidation();
    res.json({ ok: true });
  } catch (error: any) {
    if (error?.code === "INVALID_ADVICE_ORDER") {
      return res.status(400).json({ ok: false, reason: "invalid-advice-order" });
    }
    next(error);
  }
}

export async function deleteAdviceController(req: Request, res: Response) {
  const id = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: "Invalid id" });
  }
  const deleted = await deleteAdviceRepo(id);
  if (deleted) {
    await safeTriggerAdviceRevalidation();
  }
  res.json({ ok: true });
}

export async function toggleAdviceStatusController(req: Request, res: Response) {
  const id = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: "Invalid id" });
  }
  const toggled = await toggleAdviceStatusRepo(id);
  if (!toggled) {
    return res.status(404).json({ error: "Advice not found" });
  }
  await safeTriggerAdviceRevalidation();
  res.json({ ok: true });
}

export async function listStorefrontAdvicesController(_req: Request, res: Response) {
  res.json({ items: (await listAdvicesRepo(false, "storefront")).map(toAdviceDto) });
}
