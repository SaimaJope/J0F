import { parseCliFlags, printStats, runSupplierImport } from "./run";

async function main() {
  const flags = parseCliFlags(process.argv.slice(2));
  const stats = await runSupplierImport("ahlsell", flags);
  printStats(stats);
}

main().catch((error) => {
  console.error("Ahlsell import failed.");
  console.error(error);
  process.exit(1);
});
