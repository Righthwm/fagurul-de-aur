/**
 * One-off cleanup: remove historical bot page-visits from the PageVisit table so
 * the admin Trafic numbers (page views + unique IPs) reflect humans only.
 *
 * Uses the SAME isBotUserAgent() the live proxy filter uses, so "bot" means
 * exactly what it means going forward. Run the count first, then delete:
 *
 *   npx tsx scripts/clean-bot-visits.ts            # dry run — counts only
 *   npx tsx scripts/clean-bot-visits.ts --delete   # actually delete
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { PrismaClient } from "@prisma/client";
import { isBotUserAgent } from "../lib/bot-filter";

const prisma = new PrismaClient();
const DELETE = process.argv.includes("--delete");

async function main() {
  const total = await prisma.pageVisit.count();
  const rows = await prisma.pageVisit.findMany({ select: { id: true, userAgent: true } });

  const botIds: string[] = [];
  let noUa = 0;
  for (const r of rows) {
    if (isBotUserAgent(r.userAgent)) {
      botIds.push(r.id);
      if (!r.userAgent || !r.userAgent.trim()) noUa++;
    }
  }

  console.log(`Total page-visits:      ${total}`);
  console.log(`Bot / script visits:    ${botIds.length}  (of which no user-agent: ${noUa})`);
  console.log(`Human visits (kept):    ${total - botIds.length}`);

  if (!DELETE) {
    console.log("\nDry run — nothing deleted. Re-run with --delete to remove the bot rows.");
    return;
  }

  let deleted = 0;
  for (let i = 0; i < botIds.length; i += 1000) {
    const chunk = botIds.slice(i, i + 1000);
    const res = await prisma.pageVisit.deleteMany({ where: { id: { in: chunk } } });
    deleted += res.count;
  }
  const remaining = await prisma.pageVisit.count();
  console.log(`\nDeleted ${deleted} bot rows. Remaining page-visits: ${remaining}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
