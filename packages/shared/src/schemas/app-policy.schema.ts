import { z } from "zod";

export const nativePlatformSchema = z.enum(["android", "ios"]);
export const appVersionSchema = z.string().regex(/^\d+\.\d+\.\d+$/).max(64);
export const appBuildSchema = z.string().regex(/^\d+(?:\.\d+){0,2}$/).max(64);
export function compareAppReleaseNumbers(left: string, right: string): number {
  const a = left.split(".").map(BigInt);
  const b = right.split(".").map(BigInt);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if ((a[i] ?? 0n) > (b[i] ?? 0n)) return 1;
    if ((a[i] ?? 0n) < (b[i] ?? 0n)) return -1;
  }
  return 0;
}
const revision = z.number().int().positive().safe();
const label = z.string().min(1).max(128);
const explanation = z.object({ ar: z.string().min(1).max(1000), en: z.string().min(1).max(1000) });
const storeUrl = z.string().url().refine(value => {
  const url = new URL(value);
  return url.protocol === "https:" && !url.username && !url.password &&
    ["play.google.com", "apps.apple.com"].includes(url.hostname);
}, "A store HTTPS URL is required");
export const nativeClientIdentitySchema = z.object({
  platform: nativePlatformSchema, appVersion: appVersionSchema, appBuild: appBuildSchema,
  runtimeVersion: label, updateId: z.union([z.literal("embedded"), z.string().uuid()]),
  clientRevision: revision
});
export const appFeatureSchema = z.enum(["cart-sync", "checkout", "shipping-quote", "payment-retry",
  "order-cancel", "wishlist-write", "review-submit"]);
export const platformReleaseSchema = z.object({
  appVersion: appVersionSchema, appBuild: appBuildSchema, runtimeVersion: label,
  clientRevision: revision, apiContract: z.literal("/api/v1"),
  updateIds: z.array(z.union([z.literal("embedded"), z.string().uuid()])).min(1),
  storeUrl: storeUrl.nullable(), available: z.boolean()
}).refine(value => !value.available || value.storeUrl !== null, "Available releases need a store URL");
export const appReleaseSchema = z.object({
  id: label, android: platformReleaseSchema, ios: platformReleaseSchema
});
export const featureRequirementSchema = z.object({
  feature: appFeatureSchema, requiredRelease: label, minimumAppVersion: appVersionSchema,
  minimumAppBuild: appBuildSchema, minimumClientRevision: revision,
  supportedRuntimes: z.array(label).min(1), explanation
});
export const releaseRegistrySchema = z.object({
  schemaVersion: z.literal(1), policyRevision: label,
  cache: z.object({ maxAgeSeconds: z.number().int().nonnegative().safe() }),
  current: appReleaseSchema.nullable(), previous: appReleaseSchema.nullable(), candidate: appReleaseSchema.nullable(),
  requirements: z.object({ android: z.array(featureRequirementSchema), ios: z.array(featureRequirementSchema) })
}).superRefine((registry, ctx) => {
  const occupied = [registry.current, registry.previous, registry.candidate].filter(value => value !== null);
  if (new Set(occupied.map(value => value.id)).size !== occupied.length || (!registry.current && registry.previous)) {
    ctx.addIssue({ code: "custom", message: "Release states must be distinct and ordered" });
  }
  for (const release of [registry.current, registry.previous]) {
    if (release && (!release.android.available || !release.ios.available)) {
      ctx.addIssue({ code: "custom", message: "Public releases must be available in both stores" });
    }
  }
  for (const platform of ["android", "ios"] as const) {
    const rules = registry.requirements[platform];
    if (new Set(rules.map(rule => rule.feature)).size !== rules.length) {
      ctx.addIssue({ code: "custom", message: "Duplicate feature requirements" });
    }
    for (const rule of rules) {
      const target = [registry.current, registry.previous].find(release => release?.id === rule.requiredRelease);
      if (!target || !target[platform].available) {
        ctx.addIssue({ code: "custom", message: "A requirement must offer an available public upgrade" });
      } else {
        const upgrade = target[platform];
        if (appVersionSchema.safeParse(upgrade.appVersion).success && appVersionSchema.safeParse(rule.minimumAppVersion).success &&
          appBuildSchema.safeParse(upgrade.appBuild).success && appBuildSchema.safeParse(rule.minimumAppBuild).success) {
          const versionOrder = compareAppReleaseNumbers(upgrade.appVersion, rule.minimumAppVersion);
          if (versionOrder < 0 || (versionOrder === 0 && compareAppReleaseNumbers(upgrade.appBuild, rule.minimumAppBuild) < 0) ||
            upgrade.clientRevision < rule.minimumClientRevision || !rule.supportedRuntimes.includes(upgrade.runtimeVersion)) {
            ctx.addIssue({ code: "custom", message: "The upgrade must satisfy its feature requirement" });
          }
        }
      }
    }
  }
});
export const appConfigSchema = z.object({
  schemaVersion: z.literal(1), policyRevision: label, platform: nativePlatformSchema,
  cache: z.object({ maxAgeSeconds: z.number().int().nonnegative().safe() }),
  current: z.object({ id: label, release: platformReleaseSchema }).nullable(),
  previous: z.object({ id: label, release: platformReleaseSchema }).nullable(),
  recommendedUpdate: z.object({ releaseId: label, storeUrl, explanation }).nullable(),
  features: z.array(featureRequirementSchema)
}).superRefine((config, ctx) => {
  for (const slot of [config.current, config.previous]) {
    if (slot && !slot.release.available) ctx.addIssue({ code: "custom", message: "Public upgrade is unavailable" });
  }
  if (config.recommendedUpdate && (config.recommendedUpdate.releaseId !== config.current?.id ||
    config.recommendedUpdate.storeUrl !== config.current?.release.storeUrl)) {
    ctx.addIssue({ code: "custom", message: "Recommended upgrade must identify the public current release" });
  }
  if ((!config.current && config.previous) || (config.current && config.previous?.id === config.current.id) ||
    new Set(config.features.map(rule => rule.feature)).size !== config.features.length) {
    ctx.addIssue({ code: "custom", message: "Invalid public policy state" });
  }
  for (const rule of config.features) {
    if (![config.current, config.previous].some(slot => slot?.id === rule.requiredRelease && slot.release.available)) {
      ctx.addIssue({ code: "custom", message: "Feature update must identify an available public release" });
    }
  }
});
export const appUpdateRequiredSchema = z.object({
  code: z.literal("APP_UPDATE_REQUIRED"), feature: appFeatureSchema,
  policyRevision: label, message: z.string().min(1).max(1000), explanation,
  storeUrl, requiredRelease: label
});
export type NativeClientIdentity = z.infer<typeof nativeClientIdentitySchema>;
export type NativePlatform = z.infer<typeof nativePlatformSchema>;
export type ReleaseRegistry = z.infer<typeof releaseRegistrySchema>;
export type AppConfig = z.infer<typeof appConfigSchema>;
export type AppUpdateRequired = z.infer<typeof appUpdateRequiredSchema>;
export type AppFeature = z.infer<typeof appFeatureSchema>;
