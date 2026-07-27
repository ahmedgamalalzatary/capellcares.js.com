import { mysqlPool } from "../db.js";
import { seedDespacito } from "./despacito.seed.js";
import { copySeedAssets } from "./seed-assets.js";

async function main() {
  await copySeedAssets();
  await seedDespacito();
}

main()
  .then(async () => {
    await mysqlPool.end();
    console.log("Database seed completed.");
  })
  .catch(async (error) => {
    console.error(error);
    await mysqlPool.end();
    process.exit(1);
  });
