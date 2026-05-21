import type { withTestServer } from "./request.js";

type TestRequest = Parameters<Parameters<typeof withTestServer>[1]>[0];
let authCounter = 0;

export async function getAdminAuthHeaders(request: TestRequest) {
  authCounter += 1;
  process.env.ADMIN_EMAIL = `admin-${authCounter}@capella.test`;
  process.env.ADMIN_PASSWORD = "AdminPass123";

  const response = await request("/api/erp/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      email: process.env.ADMIN_EMAIL,
      password: process.env.ADMIN_PASSWORD
    })
  });

  if (response.status !== 200 || !response.json?.accessToken) {
    throw new Error(`Failed to authenticate admin for test: ${response.status}`);
  }

  return { authorization: `Bearer ${response.json.accessToken}` };
}
