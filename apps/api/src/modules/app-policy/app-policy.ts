import type { Request, RequestHandler } from "express";
import { Router } from "express";
import { appConfigSchema, appUpdateRequiredSchema, compareAppReleaseNumbers, nativeClientIdentitySchema, nativePlatformSchema, releaseRegistrySchema,
  type AppConfig, type AppFeature, type NativeClientIdentity, type NativePlatform, type ReleaseRegistry } from "@capella/shared";

export const PRELAUNCH_POLICY: ReleaseRegistry = {
  schemaVersion: 1, policyRevision: "prelaunch-v1", cache: { maxAgeSeconds: 0 },
  current: null, previous: null, candidate: null, requirements: { android: [], ios: [] }
};

export function releasePolicyFromEnvironment(): ReleaseRegistry {
  const raw = process.env.APP_RELEASE_POLICY_JSON;
  return raw ? releaseRegistrySchema.parse(JSON.parse(raw)) : PRELAUNCH_POLICY;
}

const identityHeaders = ["x-app-version", "x-app-build", "x-platform", "x-runtime-version", "x-update-id", "x-client-revision"];
function requestIdentity(req: Request): NativeClientIdentity | null {
  if (!identityHeaders.some(header => req.get(header) !== undefined)) return null;
  const clientRevision = req.get("x-client-revision");
  if (clientRevision !== undefined && !/^[1-9]\d*$/.test(clientRevision)) throw new Error("Invalid client revision");
  return nativeClientIdentitySchema.parse({
    appVersion: req.get("x-app-version"), appBuild: req.get("x-app-build"), platform: req.get("x-platform"),
    runtimeVersion: req.get("x-runtime-version"), updateId: req.get("x-update-id"),
    clientRevision: req.get("x-client-revision") === undefined ? 1 : Number(req.get("x-client-revision"))
  });
}

export const compareReleaseNumbers = compareAppReleaseNumbers;

export function promoteReleaseCandidate(input: ReleaseRegistry, policyRevision: string) {
  const registry = releaseRegistrySchema.parse(input);
  if (!registry.candidate?.android.available || !registry.candidate?.ios.available) {
    throw new Error("Candidate must be available in both stores before promotion");
  }
  if (policyRevision === registry.policyRevision) throw new Error("Promotion requires a new policy revision");
  return { retired: registry.previous, registry: releaseRegistrySchema.parse({
    ...registry, policyRevision, current: registry.candidate, previous: registry.current, candidate: null
  }) };
}

function configForPlatform(policy: ReleaseRegistry, platform: NativePlatform, identity: NativeClientIdentity | null): AppConfig {
  const current = policy.current?.[platform];
  const versionOrder = current && identity ? compareReleaseNumbers(identity.appVersion, current.appVersion) : 0;
  const recommend = current && identity && (versionOrder < 0 || (versionOrder === 0 &&
    (compareReleaseNumbers(identity.appBuild, current.appBuild) < 0 || identity.clientRevision < current.clientRevision)));
  return appConfigSchema.parse({
    schemaVersion: 1, policyRevision: policy.policyRevision, platform, cache: policy.cache,
    current: policy.current ? { id: policy.current.id, release: policy.current[platform] } : null,
    previous: policy.previous ? { id: policy.previous.id, release: policy.previous[platform] } : null,
    recommendedUpdate: recommend ? { releaseId: policy.current!.id, storeUrl: current!.storeUrl,
      explanation: { ar: "يتوفر إصدار أحدث من التطبيق", en: "A newer app release is available" } } : null,
    features: policy.requirements[platform]
  });
}

export const appPolicyRoutes = Router();
appPolicyRoutes.get("/app-config", (req, res) => {
  res.set("Cache-Control", "no-store");
  let platform: NativePlatform;
  let identity: NativeClientIdentity | null;
  try {
    identity = requestIdentity(req);
    platform = identity?.platform ?? nativePlatformSchema.parse(req.query.platform);
  } catch {
    res.status(400).json({ code: "INVALID_APP_METADATA", message: "Valid app platform and metadata are required" });
    return;
  }
  try {
    res.json(configForPlatform(releasePolicyFromEnvironment(), platform, identity));
  } catch {
    res.status(503).json({ code: "APP_POLICY_UNAVAILABLE", message: "App policy is temporarily unavailable" });
  }
});

function affectedFeature(req: Request): AppFeature | null {
  const path = req.path.toLowerCase().replace(/\/$/, "");
  if (req.method === "PUT" && path === "/cart") return "cart-sync";
  if (req.method === "POST" && path === "/checkout") return "checkout";
  if (req.method === "POST" && path === "/checkout/shipping/quote") return "shipping-quote";
  if (req.method === "POST" && /^\/checkout\/[^/]+\/retry$/.test(path)) return "payment-retry";
  if (req.method === "POST" && /^\/orders\/[^/]+\/cancel$/.test(path)) return "order-cancel";
  if (["POST", "DELETE"].includes(req.method) && /^\/wishlist(?:\/[^/]+\/[^/]+)?$/.test(path)) return "wishlist-write";
  if (req.method === "POST" && path === "/reviews") return "review-submit";
  return null;
}

export const featureCompatibilityMiddleware: RequestHandler = (req, res, next) => {
  const feature = affectedFeature(req);
  const hasMetadata = identityHeaders.some(header => req.get(header) !== undefined);
  if (!feature || (!hasMetadata && req.get("x-client") !== "mobile")) { next(); return; }
  let policy: ReleaseRegistry;
  try { policy = releasePolicyFromEnvironment(); } catch {
    res.status(503).json({ code: "APP_POLICY_UNAVAILABLE", message: "App policy is temporarily unavailable" }); return;
  }
  // Preserve the existing auth transport and prelaunch development clients when
  // no feature requirement is deployed. Once a gate exists, native identity is required.
  if (!hasMetadata && !policy.requirements.android.length && !policy.requirements.ios.length) { next(); return; }
  let identity: NativeClientIdentity | null;
  try { identity = requestIdentity(req); if (!identity) throw new Error("Missing metadata"); } catch {
    res.status(400).json({ code: "INVALID_APP_METADATA", message: "Valid app metadata is required" }); return;
  }
  const rule = policy.requirements[identity.platform].find(value => value.feature === feature);
  if (!rule) { next(); return; }
  const versionOrder = compareReleaseNumbers(identity.appVersion, rule.minimumAppVersion);
  const compatible = versionOrder >= 0 && (versionOrder > 0 ||
    compareReleaseNumbers(identity.appBuild, rule.minimumAppBuild) >= 0) &&
    identity.clientRevision >= rule.minimumClientRevision && rule.supportedRuntimes.includes(identity.runtimeVersion);
  if (compatible) { next(); return; }
  const target = [policy.current, policy.previous].find(release => release?.id === rule.requiredRelease)!;
  res.status(409).json(appUpdateRequiredSchema.parse({
    code: "APP_UPDATE_REQUIRED", feature, policyRevision: policy.policyRevision,
    message: req.get("x-lang") === "ar" ? rule.explanation.ar : rule.explanation.en,
    explanation: rule.explanation, storeUrl: target[identity.platform].storeUrl, requiredRelease: target.id
  }));
};
