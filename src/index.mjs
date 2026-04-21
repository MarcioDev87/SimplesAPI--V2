import express from "express";
import dotenv from "dotenv";
import {
  buildPatientsResponseByDate,
  ensureSimplesDentalConfig,
} from "./simples-dental.mjs";
import {
  buildReminderPlanByDate,
  sendAppointmentRemindersByDate,
} from "./reminders.mjs";
import {
  getReminderTemplate,
  listReminderTemplates,
  setReminderTemplate,
} from "./template-store.mjs";

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 3001);

app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/pacientes", async (req, res) => {
  const { data } = req.query;

  if (typeof data !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(data)) {
    return res.status(400).json({
      ok: false,
      error: "Informe a data no formato YYYY-MM-DD.",
    });
  }

  try {
    ensureSimplesDentalConfig();
    const response = await buildPatientsResponseByDate(data);
    return res.json({
      ok: true,
      ...response,
    });
  } catch (error) {
    console.error("Erro ao buscar pacientes no Simples Dental:", error);

    const message =
      error instanceof Error
        ? error.message
        : "Falha inesperada ao consultar o Simples Dental.";

    return res.status(500).json({
      ok: false,
      error: message,
    });
  }
});

app.get("/lembretes", async (req, res) => {
  const { data, mode, period, template } = req.query;

  if (typeof data !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(data)) {
    return res.status(400).json({
      ok: false,
      error: "Informe a data no formato YYYY-MM-DD.",
    });
  }

  try {
    ensureSimplesDentalConfig();
    const response = await buildReminderPlanByDate(data, {
      mode: typeof mode === "string" ? mode : undefined,
      period: typeof period === "string" ? period : undefined,
      template: typeof template === "string" ? template : undefined,
    });

    return res.json({
      ok: true,
      ...response,
    });
  } catch (error) {
    console.error("Erro ao preparar lembretes:", error);

    const message =
      error instanceof Error
        ? error.message
        : "Falha inesperada ao preparar lembretes.";

    return res.status(500).json({
      ok: false,
      error: message,
    });
  }
});

app.get("/modelos-lembrete", async (_req, res) => {
  try {
    return res.json({
      ok: true,
      modelos: await listReminderTemplates(),
    });
  } catch (error) {
    console.error("Erro ao listar modelos:", error);
    return res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : "Falha ao listar modelos.",
    });
  }
});

app.get("/modelos-lembrete/:key", async (req, res) => {
  try {
    return res.json({
      ok: true,
      ...(await getReminderTemplate(req.params.key)),
    });
  } catch (error) {
    console.error("Erro ao buscar modelo:", error);
    return res.status(400).json({
      ok: false,
      error: error instanceof Error ? error.message : "Falha ao buscar modelo.",
    });
  }
});

app.put("/modelos-lembrete/:key", async (req, res) => {
  const { template } = req.body || {};

  try {
    return res.json({
      ok: true,
      ...(await setReminderTemplate(req.params.key, template)),
    });
  } catch (error) {
    console.error("Erro ao salvar modelo:", error);
    return res.status(400).json({
      ok: false,
      error: error instanceof Error ? error.message : "Falha ao salvar modelo.",
    });
  }
});

app.post("/lembretes/enviar", async (req, res) => {
  const { data, dryRun = true, force = false, mode, period, template } = req.body || {};

  if (typeof data !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(data)) {
    return res.status(400).json({
      ok: false,
      error: "Informe a data no formato YYYY-MM-DD.",
    });
  }

  try {
    ensureSimplesDentalConfig();
    const response = await sendAppointmentRemindersByDate(data, {
      dryRun: dryRun !== false,
      force: force === true,
      mode: typeof mode === "string" ? mode : undefined,
      period: typeof period === "string" ? period : undefined,
      template: typeof template === "string" ? template : undefined,
    });

    return res.json({
      ok: true,
      ...response,
    });
  } catch (error) {
    console.error("Erro ao enviar lembretes:", error);

    const message =
      error instanceof Error
        ? error.message
        : "Falha inesperada ao enviar lembretes.";

    return res.status(500).json({
      ok: false,
      error: message,
    });
  }
});

app.listen(port, () => {
  console.log(`API ouvindo na porta ${port}`);
});
