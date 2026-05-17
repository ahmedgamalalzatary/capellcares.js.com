export function resolveDevAdminCredentials(env: NodeJS.ProcessEnv = process.env) {
  return {
    email: env.DEV_ADMIN_EMAIL ?? env.ADMIN_DEV_EMAIL,
    password: env.DEV_ADMIN_PASSWORD ?? env.ADMIN_DEV_PASSWORD
  };
}

export function isDevAdminFallbackEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const value = env.ALLOW_DEV_ADMIN_FALLBACK;
  if (!value) {
    return true;
  }
  return value !== "0" && value.toLowerCase() !== "false";
}
