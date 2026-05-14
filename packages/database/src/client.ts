import mysql from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required");
}

export const mysqlPool = mysql.createPool(databaseUrl);
export const db = drizzle(mysqlPool);
