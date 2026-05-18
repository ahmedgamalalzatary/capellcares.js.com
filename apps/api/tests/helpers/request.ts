import type { Express } from "express";
import { request as httpRequest } from "node:http";
import type { AddressInfo } from "node:net";

export async function withTestServer<T>(
  app: Express,
  run: (request: (path: string, init?: RequestInit) => Promise<TestResponse>) => Promise<T>
) {
  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", () => resolve()));

  const address = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    return await run(async (path, init) => {
      const response = await sendRequest(`${baseUrl}${path}`, init);
      const text = response.text;
      return {
        status: response.status,
        headers: response.headers,
        json: text ? JSON.parse(text) : null,
        text
      };
    });
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve()))
    );
  }
}

type TestResponse = {
  status: number;
  headers: Headers;
  json: any;
  text: string;
};

async function sendRequest(url: string, init?: RequestInit) {
  const body = typeof init?.body === "string" ? init.body : undefined;

  return new Promise<{ status: number; headers: Headers; text: string }>((resolve, reject) => {
    const request = httpRequest(
      url,
      {
        method: init?.method ?? "GET",
        headers: {
          connection: "close",
          ...(init?.headers as Record<string, string> | undefined)
        }
      },
      (response) => {
        const chunks: Buffer[] = [];
        response.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
        response.on("end", () => {
          resolve({
            status: response.statusCode ?? 500,
            headers: new Headers(
              Object.entries(response.headers).flatMap(([key, value]) =>
                value === undefined
                  ? []
                  : Array.isArray(value)
                    ? value.map((entry) => [key, entry] as [string, string])
                    : [[key, String(value)]]
              )
            ),
            text: Buffer.concat(chunks).toString("utf8")
          });
        });
      }
    );

    request.on("error", reject);
    if (body) {
      request.write(body);
    }
    request.end();
  });
}
