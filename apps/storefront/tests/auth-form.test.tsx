import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LocaleProvider } from "@/components/i18n/LocaleProvider";
import { AuthForm } from "@/components/auth/AuthForm";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

describe("AuthForm", () => {
  it("toggles between login and inline signup mode", () => {
    render(<LocaleProvider lang="en"><AuthForm /></LocaleProvider>);

    expect(screen.getByRole("heading", { name: "Log in" })).toBeInTheDocument();
    expect(screen.queryByText("Name")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Sign up" }));

    expect(screen.getByRole("heading", { name: "Create account" })).toBeInTheDocument();
    expect(screen.getByText("Name")).toBeInTheDocument();
  });

  it("logs in via POST /api/v1/auth/login and stores the session", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({
      accessToken: "token-123",
      user: { id: 1, name: "Ahmed", email: "a@example.com" }
    }));
    vi.stubGlobal("fetch", fetchMock);

    render(<LocaleProvider lang="en"><AuthForm /></LocaleProvider>);
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "a@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "password123" } });
    fireEvent.click(screen.getByRole("button", { name: "Log in" }));

    await waitFor(() => {
      expect(JSON.parse(localStorage.getItem("minikoshk_auth") ?? "null")).toEqual({
        accessToken: "token-123",
        user: { id: 1, name: "Ahmed", email: "a@example.com" }
      });
    });
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/api/v1/auth/login");
    expect(init.credentials).toBe("include");
    expect(JSON.parse(init.body)).toEqual({ email: "a@example.com", password: "password123" });
  });

  it("surfaces the API error message on failed login", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ message: "Invalid credentials" }, 401)));

    render(<LocaleProvider lang="en"><AuthForm /></LocaleProvider>);
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "a@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "wrongpassword" } });
    fireEvent.click(screen.getByRole("button", { name: "Log in" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Invalid credentials");
    expect(localStorage.getItem("minikoshk_auth")).toBeNull();
  });
});
