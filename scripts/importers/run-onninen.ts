import { parseCliFlags, printStats, runSupplierImport } from "./run";

async function main() {
  const flags = parseCliFlags(process.argv.slice(2));
  const stats = await runSupplierImport("onninen", flags);
  printStats(stats);
}

main().catch((error) => {
  console.error("Onninen import failed.");
  console.error(error);
  process.exit(1);
});
