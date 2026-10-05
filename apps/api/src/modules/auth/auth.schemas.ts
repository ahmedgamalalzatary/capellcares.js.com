import { loginSchema, signupSchema } from "@capella/shared";
import type { z } from "zod";

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;

export function parseSignupBody(input: unknown): SignupInput {
  return signupSchema.parse(input);
}

export function parseLoginBody(input: unknown): LoginInput {
  return loginSchema.parse(input);
}
