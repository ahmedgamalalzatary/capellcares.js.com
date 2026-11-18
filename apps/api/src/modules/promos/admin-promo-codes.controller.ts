import type { Request, Response } from "express";
import type { ErpAuthenticatedRequest } from "../../middlewares/admin-auth.middleware.js";
import { PROMO_CODE_STATUSES, promoCodeCreateSchema, promoCodeStatusChangeSchema, type PromoCodeStatus } from "@capella/shared";
import {
  changePromoCodeStatusRepo,
  createPromoCodeRepo,
  getPromoCodeRepo,
  listPromoCodesRepo,
  PromoCodeError,
  searchPromoCustomersRepo
} from "./promo-codes.repository.js";
import { getPromoAttentionRepo, getPromoCodeReportRepo } from "./promo-report.repository.js";

const sendError = (res: Response, error: unknown) => {
  if (error instanceof PromoCodeError) return res.status(error.status).json({ errors: [error.key] });
  throw error;
};

const parseId = (value: unknown) => {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
};

export async function adminListPromoCodes(req: Request, res: Response) {
  const status = typeof req.query.status === "string" && (PROMO_CODE_STATUSES as readonly string[]).includes(req.query.status)
    ? (req.query.status as PromoCodeStatus)
    : undefined;
  res.json({ items: await listPromoCodesRepo({ status }) });
}

export async function adminGetPromoCode(req: Request, res: Response) {
  const id = parseId(req.params.id);
  const code = id ? await getPromoCodeRepo(id) : null;
  if (!code) return res.status(404).json({ errors: ["promo.not_found"] });
  res.json(code);
}

export async function adminCreatePromoCode(req: ErpAuthenticatedRequest, res: Response) {
  const parsed = promoCodeCreateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ errors: [...new Set(parsed.error.issues.map((issue) => issue.message))] });
  try {
    res.status(201).json(await createPromoCodeRepo(parsed.data, req.adminUser!.id));
  } catch (error) {
    sendError(res, error);
  }
}

export async function adminChangePromoCodeStatus(req: ErpAuthenticatedRequest, res: Response) {
  const id = parseId(req.params.id);
  const parsed = promoCodeStatusChangeSchema.safeParse(req.body);
  if (!id) return res.status(404).json({ errors: ["promo.not_found"] });
  if (!parsed.success) return res.status(400).json({ errors: ["promo.status_action_invalid"] });
  try {
    res.json(await changePromoCodeStatusRepo(id, parsed.data.action, req.adminUser!.id));
  } catch (error) {
    sendError(res, error);
  }
}

export async function adminSearchPromoCustomers(req: Request, res: Response) {
  const query = typeof req.query.q === "string" ? req.query.q.trim() : "";
  res.json({ items: query.length >= 2 ? await searchPromoCustomersRepo(query.slice(0, 100)) : [] });
}

/** Uses, money, customers, orders and health for one code (spec section 9.3). */
export async function adminPromoCodeReport(req: Request, res: Response) {
  const id = parseId(req.params.id);
  const report = id === null ? null : await getPromoCodeReportRepo(id);
  if (!report) return res.status(404).json({ errors: ["promo.not_found"] });
  res.json(report);
}

/** Dashboard items: free orders a code made that wait for review, and codes ending within a week. */
export async function adminPromoAttention(_req: Request, res: Response) {
  res.json(await getPromoAttentionRepo());
}
