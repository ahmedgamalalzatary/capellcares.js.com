export function resolveDevAdminCredentials(env: NodeJS.ProcessEnv = process.env) {
  return {
    email: env.DEV_ADMIN_EMAIL ?? env.ADMIN_DEV_EMAIL ?? "admin@capella.eg",
    password: env.DEV_ADMIN_PASSWORD ?? env.ADMIN_DEV_PASSWORD ?? "admin1234"
  };
}

export function isDevAdminFallbackEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const value = env.ALLOW_DEV_ADMIN_FALLBACK;
  if (!value) {
    return true;
  }
  return value !== "0" && value.toLowerCase() !== "false";
}
