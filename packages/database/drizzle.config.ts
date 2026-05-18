import "dotenv/config";
import { defineConfig } from "drizzle-kit";

function resolveDrizzleDatabaseUrl(env: NodeJS.ProcessEnv): string {
  if (env.NODE_ENV === "test" && env.TEST_DATABASE_URL) {
    return env.TEST_DATABASE_URL;
  }

  if (env.DATABASE_URL) {
    return env.DATABASE_URL;
  }

  if (env.TEST_DATABASE_URL) {
    return env.TEST_DATABASE_URL;
  }

  throw new Error("DATABASE_URL or TEST_DATABASE_URL is required");
}

export default defineConfig({
  schema: "./drizzle/schema.ts",
  out: "./drizzle/migrations",
  dialect: "mysql",
  dbCredentials: {
    url: resolveDrizzleDatabaseUrl(process.env)
  }
});
