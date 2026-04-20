import dotenv from "dotenv";
import { sendAppointmentRemindersByDate } from "./reminders.mjs";
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

function resolveDate(args) {
  if (args.date) {
    return args.date;
  }

  const offset = Number(args.offset || 0);
  const date = new Date();
  date.setDate(date.getDate() + offset);

  return formatDate(date);
}

const args = parseArgs(process.argv.slice(2));
const data = resolveDate(args);
const dryRun = args["dry-run"] !== "false";
const mode = args.mode || (Number(args.offset || 0) > 0 ? "evening" : "morning");
const force = args.force === "true";
const period = args.period || (mode === "afternoon" ? "afternoon" : undefined);

ensureSimplesDentalConfig();

const result = await sendAppointmentRemindersByDate(data, {
  dryRun,
  force,
  mode,
  period,
  template: args.template,
});

console.log(
  JSON.stringify(
    {
      ok: true,
      data: result.data,
      mode,
      dryRun: result.dryRun,
      totalConsultas: result.totalConsultas,
      totalEnviaveis: result.totalEnviaveis,
      totalIgnorados: result.totalIgnorados,
      enviados: result.sent?.length || 0,
      falhas: result.failed?.length || 0,
      jaEnviados: result.skippedAlreadySent?.length || 0,
      ignorados: result.skipped,
      skippedAlreadySent: result.skippedAlreadySent,
      failed: result.failed,
    },
    null,
    2
  )
);
