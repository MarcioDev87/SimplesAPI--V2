import fs from "node:fs/promises";
import path from "node:path";

const templatePath = path.resolve(
  process.env.REMINDER_TEMPLATE_PATH || "data/reminder-templates.json"
);

export const TEMPLATE_KEYS = new Set(["confirmation", "afternoon"]);

async function ensureTemplateDirectory() {
  await fs.mkdir(path.dirname(templatePath), { recursive: true });
}

async function readTemplateFile() {
  try {
    const raw = await fs.readFile(templatePath, "utf8");
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (error) {
    if (error?.code === "ENOENT") {
      return {};
    }

    throw error;
  }
}

async function writeTemplateFile(templates) {
  await ensureTemplateDirectory();
  await fs.writeFile(templatePath, `${JSON.stringify(templates, null, 2)}\n`, "utf8");
}

export function normalizeTemplateKey(key) {
  if (["evening", "morning", "confirmation", "confirmacao"].includes(key)) {
    return "confirmation";
  }

  if (["afternoon", "tarde", "lembrete_tarde"].includes(key)) {
    return "afternoon";
  }

  return null;
}

export function getDefaultTemplate(key) {
  const normalizedKey = normalizeTemplateKey(key);

  if (normalizedKey === "afternoon") {
    return [
      "🌞 Bom dia!",
      "",
      "Passando aqui com carinho para lembrar da sua consulta hoje à tarde, às *{{horario}}*, com a *{{profissional}}* 🦷✨",
      "",
      "Estamos te esperando para cuidar do seu sorriso com toda atenção 💙",
      "",
      "Se por algum motivo não puder comparecer, nos avise, por favor, para que possamos organizar a agenda da melhor forma 🙏",
      "",
      "Até mais tarde! 😄",
    ].join("\n");
  }

  return [
    "Bom dia!",
    "",
    "Tudo bem com você, {{primeiroNome}}?",
    "Passando aqui com carinho para confirmar a sua consulta agendada para amanha às {{horario}} com a {{profissional}} 🦷✨",
    "",
    "Estamos te esperando com todo cuidado e atenção de sempre 💙",
    "",
    "Caso aconteça algum imprevisto e você não possa comparecer, pedimos, por gentileza, que nos avise o quanto antes. Assim conseguimos reorganizar a agenda e atender outro paciente que está aguardando 🙏",
    "",
    "Qualquer dúvida, estamos por aqui!",
    "Será um prazer cuidar do seu sorriso 😄",
  ].join("\n");
}

export async function getStoredReminderTemplate(key) {
  const normalizedKey = normalizeTemplateKey(key);

  if (!normalizedKey) {
    throw new Error("Modelo de lembrete invalido.");
  }

  const templates = await readTemplateFile();
  const template = templates[normalizedKey];
  return typeof template === "string" && template.trim() ? template : null;
}

export async function getReminderTemplate(key) {
  const normalizedKey = normalizeTemplateKey(key);
  const template = await getStoredReminderTemplate(normalizedKey);

  return {
    key: normalizedKey,
    template: template || getDefaultTemplate(normalizedKey),
    customized: Boolean(template),
  };
}

export async function setReminderTemplate(key, template) {
  const normalizedKey = normalizeTemplateKey(key);

  if (!normalizedKey) {
    throw new Error("Modelo de lembrete invalido.");
  }

  if (typeof template !== "string" || !template.trim()) {
    throw new Error("Informe um modelo de mensagem.");
  }

  const templates = await readTemplateFile();
  templates[normalizedKey] = template.trim();
  await writeTemplateFile(templates);

  return {
    key: normalizedKey,
    template: templates[normalizedKey],
    customized: true,
  };
}

export async function listReminderTemplates() {
  const templates = await readTemplateFile();

  return Array.from(TEMPLATE_KEYS).map((key) => ({
    key,
    template:
      typeof templates[key] === "string" && templates[key].trim()
        ? templates[key]
        : getDefaultTemplate(key),
    customized: typeof templates[key] === "string" && Boolean(templates[key].trim()),
  }));
}
