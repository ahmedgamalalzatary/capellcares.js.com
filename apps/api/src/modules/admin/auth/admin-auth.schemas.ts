import { z } from "zod";

const adminLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

export type AdminLoginInput = z.infer<typeof adminLoginSchema>;

export function parseAdminLoginBody(input: unknown): AdminLoginInput {
  return adminLoginSchema.parse(input);
}
