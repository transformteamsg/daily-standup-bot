import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/shell/db/schema/sqlite.ts",
  out: "./drizzle",
  dialect: "sqlite",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "./data/standup.db",
  },
});
