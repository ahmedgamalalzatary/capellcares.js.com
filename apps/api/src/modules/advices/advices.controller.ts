import type { Request, Response } from "express";
import { deleteAdviceRepo, listAdvicesRepo, toggleAdviceStatusRepo, upsertAdviceRepo } from "../../repositories/advice.repository.js";

function toAdviceDto(item: any) {
  return {
    id: item.id,
    title: { ar: item.arTitle, en: item.enTitle },
    description: { ar: item.arDescription, en: item.enDescription },
    imagePath: item.imagePath ?? null,
    videoUrl: item.videoUrl ?? null,
    status: item.status,
    sortOrder: item.sortOrder,
    createdAt: item.createdAt?.toISOString?.() ?? String(item.createdAt ?? ""),
    updatedAt: item.updatedAt?.toISOString?.() ?? String(item.updatedAt ?? "")
  };
}

export async function listAdminAdvicesController(_req: Request, res: Response) {
  res.json({ items: (await listAdvicesRepo(true)).map(toAdviceDto) });
}

export async function upsertAdviceController(req: Request, res: Response) {
  const input = req.body as any;
  await upsertAdviceRepo({
    id: input.id ? Number(input.id) : undefined,
    arTitle: input.title?.ar ?? "",
    enTitle: input.title?.en ?? "",
    arDescription: input.description?.ar ?? "",
    enDescription: input.description?.en ?? "",
    imagePath: input.imagePath ?? null,
    videoUrl: input.videoUrl ?? null,
    status: input.status ?? "inactive",
    sortOrder: Number(input.sortOrder ?? 0)
  });
  res.json({ ok: true });
}

export async function deleteAdviceController(req: Request, res: Response) {
  await deleteAdviceRepo(Number(req.params.id));
  res.json({ ok: true });
}

export async function toggleAdviceStatusController(req: Request, res: Response) {
  await toggleAdviceStatusRepo(Number(req.params.id));
  res.json({ ok: true });
}

export async function listStorefrontAdvicesController(_req: Request, res: Response) {
  res.json({ items: (await listAdvicesRepo(false)).map(toAdviceDto) });
}
