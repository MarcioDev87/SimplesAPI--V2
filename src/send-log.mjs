import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

function getLogPath() {
  return resolve(process.env.REMINDER_SEND_LOG_PATH || "data/reminder-sends.json");
}

export function buildSendKey({ date, mode, consultaId }) {
  return `${date}:${mode}:${consultaId}`;
}

async function readLog() {
  try {
    return JSON.parse(await readFile(getLogPath(), "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") {
      return {};
    }

    throw error;
  }
}

async function writeLog(log) {
  const logPath = getLogPath();
  await mkdir(dirname(logPath), { recursive: true });
  await writeFile(logPath, JSON.stringify(log, null, 2));
}

export async function wasReminderSent(key) {
  const log = await readLog();
  return Boolean(log[key]);
}

export async function markReminderSent(key, payload) {
  const log = await readLog();
  log[key] = {
    ...payload,
    sentAt: new Date().toISOString(),
  };
  await writeLog(log);
}
