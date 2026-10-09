import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDict } from "@capella/shared";
import { AuthForm } from "@/components/auth/auth-forms";

const auth = vi.hoisted(() => ({ login: vi.fn(), signup: vi.fn(), user: null }));
vi.mock("@/components/providers/auth-provider", () => ({ useAuth: () => auth }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams()
}));

function fillSignup(container: HTMLElement, values: { name: string; email: string; password: string }) {
  fireEvent.change(container.querySelector('input[autocomplete="name"]')!, { target: { value: values.name } });
  fireEvent.change(container.querySelector('input[autocomplete="email"]')!, { target: { value: values.email } });
  fireEvent.change(container.querySelector('input[autocomplete="new-password"]')!, { target: { value: values.password } });
}

describe("AuthForm signup rules", () => {
  beforeEach(() => {
    auth.signup.mockReset().mockResolvedValue(undefined);
  });

  it.each([
    ["en", { name: "Mona", email: "mona@example.com", password: "short" }, "passwordTooShort"],
    ["ar", { name: "M", email: "mona@example.com", password: "long-enough" }, "nameTooShort"],
    ["en", { name: "Mona", email: "not-an-email", password: "long-enough" }, "invalidEmail"]
  ] as const)("explains the %s %s rule instead of sending a request the API rejects", (lang, values, key) => {
    const dict = getDict(lang);
    const { container } = render(<AuthForm mode="signup" lang={lang} dict={dict} />);
    fillSignup(container, values);
    fireEvent.click(screen.getByRole("button", { name: dict.auth.signupCta }));
    expect(screen.getByText(dict.auth[key])).toBeInTheDocument();
    expect(auth.signup).not.toHaveBeenCalled();
  });

  it("sends a trimmed name and email once the rules pass", async () => {
    const dict = getDict("en");
    const { container } = render(<AuthForm mode="signup" lang="en" dict={dict} />);
    fillSignup(container, { name: "  Mona  ", email: "mona@example.com", password: "long-enough" });
    fireEvent.click(screen.getByRole("button", { name: dict.auth.signupCta }));
    await vi.waitFor(() => expect(auth.signup).toHaveBeenCalledWith("Mona", "mona@example.com", "long-enough"));
  });
});
