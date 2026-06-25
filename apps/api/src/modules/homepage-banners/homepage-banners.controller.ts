import type { Request, Response } from "express";
import { triggerStorefrontRevalidation } from "../admin/storefront-revalidation.js";
import {
  createHomepageBannerItem,
  deleteHomepageBannerItem,
  isHomepageSectionKey,
  listHomepageBanners,
  updateHomepageBannerItem
} from "./homepage-banners.service.js";

function readPositiveInt(value: string) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function readRequiredText(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

async function revalidateHomepageBanners() {
  try {
    await triggerStorefrontRevalidation({ entity: "homepage-banners" });
  } catch (error) {
    console.warn("Failed to trigger homepage banner revalidation", error);
  }
}

export async function listAdminHomepageBannersController(_req: Request, res: Response) {
  res.json(await listHomepageBanners());
}

export async function listStorefrontHomepageBannersController(_req: Request, res: Response) {
  res.json(await listHomepageBanners());
}

export async function createHomepageBannerItemController(req: Request, res: Response) {
  const sectionKey = req.params.sectionKey;
  if (!isHomepageSectionKey(sectionKey)) {
    return res.status(400).json({ message: "Invalid section key" });
  }

  const imagePath = readRequiredText(req.body?.imagePath);
  const href = readRequiredText(req.body?.href);
  if (!imagePath || !href) {
    return res.status(400).json({ message: "Image path and href are required" });
  }

  const result = await createHomepageBannerItem({ sectionKey, imagePath, href });
  if (!result.ok) {
    return res.status(409).json({ reason: result.reason });
  }

  await revalidateHomepageBanners();
  res.json({ ok: true });
}

export async function updateHomepageBannerItemController(req: Request, res: Response) {
  const id = readPositiveInt(req.params.id);
  if (!id) {
    return res.status(400).json({ message: "Invalid id" });
  }

  const href = readRequiredText(req.body?.href);
  const imagePath = readRequiredText(req.body?.imagePath);
  if (!href) {
    return res.status(400).json({ message: "Href is required" });
  }

  const updated = await updateHomepageBannerItem(id, { href, imagePath });
  if (!updated) {
    return res.status(404).json({ message: "Homepage banner item not found" });
  }

  await revalidateHomepageBanners();
  res.json({ ok: true });
}

export async function deleteHomepageBannerItemController(req: Request, res: Response) {
  const id = readPositiveInt(req.params.id);
  if (!id) {
    return res.status(400).json({ message: "Invalid id" });
  }

  const deleted = await deleteHomepageBannerItem(id);
  if (!deleted) {
    return res.status(404).json({ message: "Homepage banner item not found" });
  }

  await revalidateHomepageBanners();
  res.json({ ok: true });
}
