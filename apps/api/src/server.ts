import { loadWorkspaceEnv } from "./config/env.js";

loadWorkspaceEnv();

const { app } = await import("./app.js");
const { syncPermissionCatalog } = await import("./services/erp-permissions.service.js");
const { ensureBootstrapAdmin } = await import("./modules/admin/auth/admin-auth.service.js");

await ensureBootstrapAdmin();
await syncPermissionCatalog();

const port = Number(process.env.PORT ?? 4000);
app.listen(port, () => {
  console.log(`API running on :${port}`);
});
