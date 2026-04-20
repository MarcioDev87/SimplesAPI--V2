import dotenv from "dotenv";
import { sendDailyAgendaSummaryByDate } from "./agenda-summary.mjs";
import { ensureSimplesDentalConfig } from "./simples-dental.mjs";

dotenv.config();

function parseArgs(argv) {
  const args = {};

  for (const arg of argv) {
    if (!arg.startsWith("--")) {
      continue;
    }

    const [key, value = "true"] = arg.slice(2).split("=");
    args[key] = value;
  }

  return args;
}

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

const args = parseArgs(process.argv.slice(2));
const data = args.date || formatDate(new Date());
const dryRun = args["dry-run"] !== "false";

ensureSimplesDentalConfig();

const result = await sendDailyAgendaSummaryByDate(data, {
  dryRun,
  number: args.number,
  periodLabel: args.period || "hoje",
});

console.log(JSON.stringify(result, null, 2));
