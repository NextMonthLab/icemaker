import { defineConfig } from "drizzle-kit";

// Guard for build environments where DATABASE_URL may not be set
// This config is only used by drizzle-kit commands (db:push, db:generate)
// Not imported during normal app build
const databaseUrl = process.env.DATABASE_URL || "postgresql://placeholder:placeholder@localhost:5432/placeholder";

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: databaseUrl,
  },
});
