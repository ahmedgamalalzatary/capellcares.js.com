/**
 * One-off, provable backfill for the indexed inbox identity columns added in migration 0063.
 *
 * Existing rows already carry their signed order id inside `normalized_payload`, but the
 * evidence checks must not read it back out of JSON. This copies it into the new scalar
 * columns so an existing backlog is indexed too.
 *
 * Two properties matter and are enforced here rather than assumed:
 *
 *  1. PROVABLE. A value is only written when it comes from the row's own signed payload, and
 *     a session binding only when that id resolves to exactly one attempt. Nothing is
 *     inferred or defaulted. A row that cannot be proven keeps NULL and stays visible in the
 *     unbound staff queue rather than being deleted or correlated to the wrong checkout.
 *
 *  2. NON-DESTRUCTIVE. No row is deleted and no unresolved history is removed. Rows that
 *     cannot be proven keep their receipt, status and payload untouched.
 *
 * This reads and writes in application code rather than one `UPDATE ... JOIN` because MySQL
 * refuses to read the table being updated from a derived table, and the JSON extraction has
 * to happen per row anyway. Rows are processed in bounded batches so a large backlog neither
 * pins the whole table in one statement nor exhausts the connection.
 *
 * Safe to run repeatedly: every value is derived from the row's own payload, so re-running
 * converges to the same result. Rows already populated are skipped, so a concurrent intake
 * that wrote the same values is never disturbed.
 *
 *   node ./scripts/backfill-paymob-callback-identity.mjs
 */
import mysql from "mysql2/promise";

const BATCH_SIZE = 500;

const url = process.env.DATABASE_URL ?? process.env.TEST_DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is required");

// The URL is parsed explicitly rather than passed as `uri`: a connection that silently
// lands on the wrong database would read no rows, report "nothing to backfill", and exit
// successfully - the worst possible outcome for a one-off migration.
const parsed = new URL(url);
const databaseName = decodeURIComponent(parsed.pathname.replace(/^\//, ""));
if (!databaseName) throw new Error("DATABASE_URL must include a database name");
const connection = await mysql.createConnection({
  host: parsed.hostname,
  port: parsed.port ? Number(parsed.port) : 3306,
  user: decodeURIComponent(parsed.username),
  password: decodeURIComponent(parsed.password),
  database: databaseName
});
console.log(`Backfilling ${databaseName} at ${parsed.hostname}`);

try {
  let copied = 0;
  let bound = 0;
  let ambiguous = 0;
  let lastId = 0;

  for (;;) {
    // Keyset pagination, not OFFSET: rows are being updated underneath the scan, and OFFSET
    // would skip rows as the result set shifts. `id > lastId` walks the table exactly once.
    const [rows] = await connection.query(
      `SELECT id, signed_order_id, bound_session_id, normalized_payload
         FROM paymob_callback_inbox
        WHERE id > ? AND (signed_order_id IS NULL OR bound_session_id IS NULL)
        ORDER BY id
        LIMIT ?`, [lastId, BATCH_SIZE]);
    if (rows.length === 0) break;
    lastId = rows[rows.length - 1].id;

    for (const row of rows) {
      let payload;
      try {
        // A JSON column can still hold an unparseable value if it was written outside this
        // application. Such a row is simply skipped: no identity can be proven from it.
        payload = typeof row.normalized_payload === "string"
          ? JSON.parse(row.normalized_payload) : row.normalized_payload;
      } catch {
        continue;
      }
      if (!payload || typeof payload !== "object") continue;

      const rawOrderId = payload.order?.id;
      const orderId = rawOrderId === undefined || rawOrderId === null ? null : String(rawOrderId);
      const rawIntegrationId = payload.integration_id;
      const integrationId = Number.isSafeInteger(rawIntegrationId) && rawIntegrationId > 0 ? rawIntegrationId : null;

      let sessionId = row.bound_session_id;
      if (sessionId === null && orderId !== null) {
        const [matches] = await connection.query(
          `SELECT DISTINCT checkout_session_id FROM payment_attempts WHERE paymob_order_id = ?`, [orderId]);
        if (matches.length > 1) {
          // `paymob_order_id` is UNIQUE today, so this is defensive. Choosing one session
          // could hold or release the wrong checkout's stock, so leave it unresolved.
          ambiguous += 1;
          continue;
        }
        if (matches.length === 1) sessionId = matches[0].checkout_session_id;
      }

      if (row.signed_order_id === orderId && row.bound_session_id === sessionId) continue;
      await connection.query(
        `UPDATE paymob_callback_inbox SET signed_order_id = ?, signed_integration_id = ?, bound_session_id = ?
          WHERE id = ?`, [orderId, integrationId, sessionId, row.id]);
      if (row.signed_order_id !== orderId) copied += 1;
      if (row.bound_session_id !== sessionId) bound += 1;
    }
  }

  console.log(`Signed identity copied for ${copied} receipts`);
  console.log(`Proven session binding recorded for ${bound} receipts`);
  if (ambiguous > 0) console.log(`${ambiguous} receipts left unbound: the id matched several sessions`);

  const [remaining] = await connection.query(`
    SELECT
      SUM(signed_order_id IS NULL) AS without_signed_order_id,
      SUM(signed_order_id IS NOT NULL AND bound_session_id IS NULL) AS signed_but_unbound
    FROM paymob_callback_inbox
  `);
  const [row] = remaining;
  console.log(`Remaining: ${row.without_signed_order_id ?? 0} without a signed order id, ` +
    `${row.signed_but_unbound ?? 0} signed but unbound (left for staff review)`);
} finally {
  await connection.end();
}