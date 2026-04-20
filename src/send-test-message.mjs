import dotenv from "dotenv";
import {
  ensureEvolutionConfig,
  normalizeWhatsAppNumber,
  randomDelayMs,
  sendTextMessage,
  sendTypingPresence,
} from "./evolution-whatsapp.mjs";

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

const args = parseArgs(process.argv.slice(2));
const number = normalizeWhatsAppNumber(args.number);
const text = args.message || "Teste de automação";
const dryRun = args["dry-run"] !== "false";

if (!number) {
  throw new Error("Informe um numero valido em --number=DDDNUMERO.");
}

if (dryRun) {
  console.log(
    JSON.stringify(
      {
        ok: true,
        dryRun: true,
        number,
        text,
      },
      null,
      2
    )
  );
  process.exit(0);
}

ensureEvolutionConfig();

const delay = randomDelayMs();
try {
  await sendTypingPresence(number, delay);
} catch (error) {
  console.warn(
    `Aviso: presenca de digitacao falhou, seguindo com envio: ${
      error instanceof Error ? error.message : String(error)
    }`
  );
}
const response = await sendTextMessage(number, text, delay);

console.log(
  JSON.stringify(
    {
      ok: true,
      dryRun: false,
      number,
      status: response?.status || "sent",
    },
    null,
    2
  )
);
