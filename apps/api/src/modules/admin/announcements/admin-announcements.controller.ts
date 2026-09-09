import type { Request, Response } from "express";
import { announcementReplacePayloadSchema } from "@capella/shared";
import {
  listAnnouncementStateRepo,
  replaceAnnouncementsRepo
} from "../../../repositories/announcement.repository.js";
import { triggerStorefrontRevalidation } from "../storefront-revalidation.js";

async function safeTriggerAnnouncementRevalidation() {
  try {
    await triggerStorefrontRevalidation({ entity: "announcements" });
  } catch (error) {
    console.warn("Failed to trigger storefront revalidation for announcements", error);
  }
}

export async function listAdminAnnouncementsController(_req: Request, res: Response) {
  res.json(await listAnnouncementStateRepo());
}

export async function replaceAdminAnnouncementsController(req: Request, res: Response) {
  const parsed = announcementReplacePayloadSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid announcements payload" });
  }

  await replaceAnnouncementsRepo(parsed.data.items, parsed.data.barStatus);
  await safeTriggerAnnouncementRevalidation();
  res.json({ ok: true });
}
