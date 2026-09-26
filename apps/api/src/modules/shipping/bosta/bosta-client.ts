import type { BostaConfig } from "./bosta-config.js";

export type BostaErrorKind = "definitive" | "throttled" | "transient" | "ambiguous";

/** Successful transport with invalid data; never eligible for outage fallback. */
export class BostaResponseValidationError extends Error {
  constructor(message: string, public readonly status: number | null = null) {
    super(message);
    this.name = "BostaResponseValidationError";
  }
}

export class BostaProviderError extends Error {
  constructor(
    message: string,
    public readonly kind: BostaErrorKind,
    public readonly status: number | null
  ) {
    super(message);
  }
}

const READ_METHODS = new Set(["GET", "HEAD"]);

export class BostaClient {
  constructor(
    private readonly config: BostaConfig,
    private readonly fetchImpl: typeof fetch = fetch
  ) {}

  async get(path: string): Promise<unknown> {
    return this.request("GET", path);
  }

  async post(path: string, body: unknown): Promise<unknown> {
    return this.request("POST", path, body);
  }

  private redact(message: string): string {
    let out = message;
    for (const secret of [this.config.apiKey, this.config.webhookSecret]) {
      if (secret) {
        out = out.split(secret).join("[redacted]");
      }
    }
    return out;
  }

  private async request(method: string, path: string, body?: unknown): Promise<unknown> {
    if (!this.config.canCallProvider || !this.config.apiKey || !this.config.baseUrl) {
      throw new Error("Bosta integration is inactive; provider call refused");
    }

    const isRead = READ_METHODS.has(method);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.timeoutMs);
    try {
      const response = await this.fetchImpl(`${this.config.baseUrl}${path}`, {
        method,
        headers: {
          Authorization: this.config.apiKey,
          "content-type": "application/json"
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal
      });

      const text = await response.text();
      let parsed: unknown = null;
      let parseFailed = false;
      if (text) {
        try {
          parsed = JSON.parse(text);
        } catch {
          parseFailed = true;
        }
      }

      if (response.ok) {
        if (isRead && parseFailed) {
          throw new BostaResponseValidationError("Bosta returned malformed JSON to a read", response.status);
        }
        // A write whose body cannot be parsed is an uncertain outcome: the
        // delivery may have been created but its reference is lost. Never
        // report it as a successful create. Reads tolerate an empty body.
        if (parseFailed || (!isRead && parsed == null)) {
          throw new BostaProviderError(
            "Bosta returned an unreadable response to a write; the operation outcome is uncertain",
            "ambiguous",
            response.status
          );
        }
        return parsed;
      }

      // Only a string message is usable; an object/array/number message would
      // break redaction and must not erase the known HTTP status.
      const rawMessage = (parsed as { message?: unknown } | null)?.message;
      const message = this.redact(
        typeof rawMessage === "string" ? rawMessage : `Bosta request failed with status ${response.status}`
      );
      if (response.status === 429) {
        throw new BostaProviderError(message, "throttled", response.status);
      }
      if (response.status >= 400 && response.status < 500) {
        throw new BostaProviderError(message, "definitive", response.status);
      }
      // 5xx on a read is transient and safe to retry. On a write it is
      // ambiguous: the provider may have processed the mutation before failing.
      throw new BostaProviderError(message, isRead ? "transient" : "ambiguous", response.status);
    } catch (error) {
      if (error instanceof BostaProviderError || error instanceof BostaResponseValidationError) {
        throw error;
      }
      // AbortError (timeout) and network failures are ambiguous: the provider may
      // have processed the request. Never treat them as a definite rejection.
      const message = this.redact(error instanceof Error ? error.message : "Bosta request failed");
      throw new BostaProviderError(message, "ambiguous", null);
    } finally {
      clearTimeout(timer);
    }
  }
}
