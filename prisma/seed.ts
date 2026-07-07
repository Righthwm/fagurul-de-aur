import { config } from "dotenv";
// Load .env.local so the admin credentials are available whether the seed runs
// via `prisma db seed` (loads .env) or `npm run db:seed` (plain tsx).
config({ path: ".env.local" });

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "faguruldeaur@gmail.com";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

async function main() {
  if (!ADMIN_PASSWORD) {
    throw new Error(
      "ADMIN_PASSWORD is not set. Add ADMIN_EMAIL / ADMIN_PASSWORD to .env.local before seeding."
    );
  }

  const password = await bcrypt.hash(ADMIN_PASSWORD, 10);
  const admin = await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: { role: "ADMIN", password, name: "Fagurul de Aur" },
    create: { email: ADMIN_EMAIL, name: "Fagurul de Aur", role: "ADMIN", password },
  });

  console.log(`Seeded admin: ${admin.email} (ADMIN)`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
