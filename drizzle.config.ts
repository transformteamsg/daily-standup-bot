import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/shell/db/schema/postgres.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgresql://standup:standup@localhost:5432/standup",
  },
});
