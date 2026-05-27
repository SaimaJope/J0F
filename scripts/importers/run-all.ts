import { parseCliFlags, printStats, runAllImport } from "./run";

async function main() {
  const flags = parseCliFlags(process.argv.slice(2));
  const stats = await runAllImport(flags);
  printStats(stats);
}

main().catch((error) => {
  console.error("Combined import failed.");
  console.error(error);
  process.exit(1);
});
