import path from "node:path";
import { config as loadEnv } from "dotenv";
import { defineConfig } from "prisma/config";

// A prisma.config.ts turns OFF Prisma's automatic .env loading, so we load it
// ourselves. `.env` holds DATABASE_URL / DATABASE_URL_UNPOOLED for local dev and
// for `prisma migrate deploy` during the build. On Vercel the real env vars are
// already in the process environment and dotenv does not override them (no .env
// file there), so this is a no-op in production. `quiet` silences dotenv's tips.
loadEnv({ quiet: true });

export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  migrations: {
    // Replaces the deprecated `package.json#prisma.seed`.
    seed: "tsx prisma/seed.ts",
  },
});
