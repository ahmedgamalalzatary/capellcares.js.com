import { mysqlPool } from "../db.js";
import { seedCategories } from "./categories.seed.js";

async function main() {
  await seedCategories();
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
