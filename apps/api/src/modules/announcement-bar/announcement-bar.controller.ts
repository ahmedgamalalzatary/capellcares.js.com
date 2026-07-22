import type { Request, Response } from "express";
import { z } from "zod";
import {
  createAnnouncementItem,
  deleteAnnouncementItem,
  getAnnouncementBar,
  reorderAnnouncementItems,
  setAnnouncementBarEnabled,
  updateAnnouncementItem
} from "./announcement-bar.service.js";
import { triggerStorefrontRevalidation } from "../admin/storefront-revalidation.js";

const textSchema = z.object({
  ar: z.string().trim().min(1).max(500),
  en: z.string().trim().min(1).max(500)
});
const createSchema = z.object({ text: textSchema }).strict();
const updateSchema = z.object({ text: textSchema.optional(), isActive: z.boolean().optional() })
  .strict()
  .refine((input) => input.text !== undefined || input.isActive !== undefined);
const settingsSchema = z.object({ enabled: z.boolean() }).strict();
const reorderSchema = z.object({ ids: z.array(z.number().int().positive()) }).strict();

function positiveId(value: string): number | null {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

const REVALIDATION_WARNING = "Changes were saved, but the storefront refresh is delayed and will recover within 10 seconds.";

export async function revalidateAnnouncementBar(
  trigger: () => Promise<void> = () => triggerStorefrontRevalidation({ entity: "announcement-bar" })
): Promise<string | undefined> {
  try {
    await trigger();
    return undefined;
  } catch (error) {
    console.warn("Failed to trigger announcement bar revalidation", error);
    return REVALIDATION_WARNING;
  }
}

export async function listStorefrontAnnouncementBarController(_req: Request, res: Response) {
  res.json(await getAnnouncementBar(false));
}

export async function listAdminAnnouncementBarController(_req: Request, res: Response) {
  res.json(await getAnnouncementBar(true));
}

export async function updateAnnouncementBarSettingsController(req: Request, res: Response) {
  const parsed = settingsSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid announcement bar settings" });
  const result = await setAnnouncementBarEnabled(parsed.data.enabled);
  const revalidationWarning = await revalidateAnnouncementBar();
  res.json({ ...result, revalidationWarning });
}

export async function createAnnouncementItemController(req: Request, res: Response) {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Arabic and English text are required" });
  const { item, announcementBar } = await createAnnouncementItem(parsed.data.text);
  const revalidationWarning = await revalidateAnnouncementBar();
  res.status(201).json({ item, announcementBar, revalidationWarning });
}

export async function updateAnnouncementItemController(req: Request, res: Response) {
  const id = positiveId(req.params.id);
  const parsed = updateSchema.safeParse(req.body);
  if (!id || !parsed.success) return res.status(400).json({ message: "Invalid announcement item" });
  const result = await updateAnnouncementItem(id, parsed.data);
  if (!result) return res.status(404).json({ message: "Announcement item not found" });
  const { item, announcementBar } = result;
  const revalidationWarning = await revalidateAnnouncementBar();
  res.json({ item, announcementBar, revalidationWarning });
}

export async function deleteAnnouncementItemController(req: Request, res: Response) {
  const id = positiveId(req.params.id);
  if (!id) return res.status(400).json({ message: "Invalid announcement item id" });
  const announcementBar = await deleteAnnouncementItem(id);
  if (!announcementBar) {
    return res.status(404).json({ message: "Announcement item not found" });
  }
  const revalidationWarning = await revalidateAnnouncementBar();
  res.json({ ok: true, announcementBar, revalidationWarning });
}

export async function reorderAnnouncementItemsController(req: Request, res: Response) {
  const parsed = reorderSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Announcement order must contain every item exactly once" });
  }
  const announcementBar = await reorderAnnouncementItems(parsed.data.ids);
  if (!announcementBar) {
    return res.status(400).json({ message: "Announcement order must contain every item exactly once" });
  }
  const revalidationWarning = await revalidateAnnouncementBar();
  res.json({ ok: true, announcementBar, revalidationWarning });
}
