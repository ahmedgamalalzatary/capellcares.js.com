import mysql from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";
import { resolveDatabaseUrl } from "./env.js";

const databaseUrl = resolveDatabaseUrl();

export const mysqlPool = mysql.createPool(databaseUrl);
export const db = drizzle(mysqlPool);
