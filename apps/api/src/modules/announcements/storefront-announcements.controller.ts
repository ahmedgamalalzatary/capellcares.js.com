import type { Request, Response } from "express";
import { listActiveAnnouncementTextsRepo } from "../../repositories/announcement.repository.js";
import type { LocalizedRequest } from "../../middlewares/locale.middleware.js";

export async function listStorefrontAnnouncementsController(req: Request, res: Response) {
  const locale = (req as LocalizedRequest).locale ?? "ar";
  res.json({ items: await listActiveAnnouncementTextsRepo(locale) });
}
