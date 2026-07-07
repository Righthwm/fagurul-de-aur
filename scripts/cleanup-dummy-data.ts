import { config } from "dotenv";
// Same env loading order as prisma/seed.ts.
config({ path: ".env.local" });

import { PrismaClient } from "@prisma/client";

/**
 * Deletes the dummy data created while building the admin section:
 *  - PageVisit rows with the fake IPs from the old seed script
 *  - test orders / contact messages (@example.com-style addresses)
 *  - the dexter@lab.ro test client
 *
 * Dry-run by default: prints what would be deleted. Pass --yes to delete.
 * Run against production with the Neon DATABASE_URL, e.g.:
 *   DATABASE_URL="postgresql://…" npx tsx scripts/cleanup-dummy-data.ts --yes
 */
const SEED_IPS = ["86.120.1.10", "79.115.2.20", "188.27.3.30", "5.12.4.40", "31.5.6.50", "127.0.0.1"];
const TEST_EMAIL_DOMAINS = ["example.com", "sda.com", "lab.ro"];

const prisma = new PrismaClient();
const apply = process.argv.includes("--yes");

async function main() {
  const emailFilters = TEST_EMAIL_DOMAINS.map((d) => ({ endsWith: `@${d}` }));

  const [visitCount, orders, messages, users] = await Promise.all([
    prisma.pageVisit.count({ where: { ip: { in: SEED_IPS } } }),
    prisma.order.findMany({
      where: { OR: emailFilters.map((f) => ({ customerEmail: f })) },
      select: { orderNumber: true, customerEmail: true, total: true },
    }),
    prisma.contactMessage.findMany({
      where: { OR: emailFilters.map((f) => ({ email: f })) },
      select: { id: true, email: true, name: true },
    }),
    prisma.user.findMany({
      where: { role: { not: "ADMIN" }, OR: emailFilters.map((f) => ({ email: f })) },
      select: { id: true, email: true },
    }),
  ]);

  console.log(`Vizite cu IP-uri din seed: ${visitCount}`);
  console.log(`Comenzi de test: ${orders.map((o) => `${o.orderNumber} (${o.customerEmail})`).join(", ") || "—"}`);
  console.log(`Mesaje de test: ${messages.map((m) => `${m.name} <${m.email}>`).join(", ") || "—"}`);
  console.log(`Clienți de test: ${users.map((u) => u.email).join(", ") || "—"}`);

  if (!apply) {
    console.log("\nDry-run. Rulează cu --yes ca să ștergi datele de mai sus.");
    return;
  }

  const [v, o, m, u] = await prisma.$transaction([
    prisma.pageVisit.deleteMany({ where: { ip: { in: SEED_IPS } } }),
    prisma.order.deleteMany({ where: { OR: emailFilters.map((f) => ({ customerEmail: f })) } }),
    prisma.contactMessage.deleteMany({ where: { OR: emailFilters.map((f) => ({ email: f })) } }),
    prisma.user.deleteMany({
      where: { role: { not: "ADMIN" }, OR: emailFilters.map((f) => ({ email: f })) },
    }),
  ]);
  console.log(`\nȘters: ${v.count} vizite, ${o.count} comenzi, ${m.count} mesaje, ${u.count} clienți.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
