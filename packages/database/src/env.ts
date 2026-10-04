export function resolveDatabaseUrl(env: NodeJS.ProcessEnv = process.env): string {
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

/** The schema name a connection URL points at. */
export function databaseNameFromUrl(databaseUrl: string): string {
  return databaseUrl.slice(databaseUrl.lastIndexOf("/") + 1).split("?")[0];
}

/**
 * Test setup truncates and re-seeds every table, so the target must be a
 * disposable schema. A name that does not look like a test database is refused
 * rather than trusted.
 */
const DISPOSABLE_DATABASE_NAME = /(^|[_-])(test|testing)([_-]|$)/i;

export function isDisposableTestDatabaseUrl(databaseUrl: string): boolean {
  return DISPOSABLE_DATABASE_NAME.test(databaseNameFromUrl(databaseUrl));
}

/**
 * Throws unless the resolved URL names an explicitly disposable test database.
 * Call this before any destructive reset so a misconfigured environment cannot
 * delete real data.
 */
export function assertDisposableTestDatabaseUrl(databaseUrl: string): void {
  if (isDisposableTestDatabaseUrl(databaseUrl)) {
    return;
  }

  throw new Error(
    `Refusing to run destructive test setup against "${databaseNameFromUrl(databaseUrl)}". ` +
      "Point TEST_DATABASE_URL at a disposable schema whose name contains 'test' " +
      "(for example capella_test)."
  );
}
