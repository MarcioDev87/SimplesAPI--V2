import { buildPatientsResponseByDate } from "./simples-dental.mjs";
import {
  ensureEvolutionConfig,
  normalizeWhatsAppNumber,
  randomDelayMs,
  sendTextMessage,
  sendTypingPresence,
} from "./evolution-whatsapp.mjs";
import {
  buildSendKey,
  markReminderSent,
  wasReminderSent,
} from "./send-log.mjs";
import { getStoredReminderTemplate } from "./template-store.mjs";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function getClinicName() {
  return process.env.CLINIC_NAME || "Clínica Dra. Ilara Queiroz";
}

function getAppointmentTime(patient) {
  return patient.dataFormatada?.split(", ").at(-1) || "no horario agendado";
}

function getPatientFirstName(patient) {
  return String(patient.paciente || "").trim().split(/\s+/).at(0) || "";
}

function formatProfessionalName(patient) {
  return String(patient.profissional || "Dra. Ilara").replace(/\s+/g, " ").trim();
}

function getAppointmentLocalHour(patient) {
  const date = new Date(patient.data);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return Number(
    new Intl.DateTimeFormat("pt-BR", {
      hour: "2-digit",
      hour12: false,
      timeZone: process.env.CLINIC_TIMEZONE || "America/Fortaleza",
    }).format(date)
  );
}

function isInPeriod(patient, period) {
  if (period !== "afternoon") {
    return true;
  }

  const hour = getAppointmentLocalHour(patient);
  return hour !== null && hour >= 12;
}

function buildDefaultMessage(patient, mode) {
  const dayText = mode === "morning" ? "hoje" : "amanha";

  if (mode === "afternoon") {
    return [
      "🌞 Bom dia!",
      "",
      `Passando aqui com carinho para lembrar da sua consulta hoje à tarde, às *${getAppointmentTime(patient)}*, com a *${formatProfessionalName(patient)}* 🦷✨`,
      "",
      "Estamos te esperando para cuidar do seu sorriso com toda atenção 💙",
      "",
      "Se por algum motivo não puder comparecer, nos avise, por favor, para que possamos organizar a agenda da melhor forma 🙏",
      "",
      "Até mais tarde! 😄",
    ].join("\n");
  }

  if (mode === "morning") {
    return [
      "Bom dia!",
      "",
      `Tudo bem com você, ${getPatientFirstName(patient)}?`,
      `Passando aqui com carinho para confirmar a sua consulta agendada para ${dayText} às ${getAppointmentTime(patient)} com a ${patient.profissional || "Dra. Ilara"} 🦷✨`,
      "",
      "Estamos te esperando com todo cuidado e atenção de sempre 💙",
      "",
      "Caso aconteça algum imprevisto e você não possa comparecer, pedimos, por gentileza, que nos avise o quanto antes. Assim conseguimos reorganizar a agenda e atender outro paciente que está aguardando 🙏",
      "",
      "Qualquer dúvida, estamos por aqui!",
      "Será um prazer cuidar do seu sorriso 😄",
    ].join("\n");
  }

  return [
    "Bom dia!",
    "",
    `Tudo bem com você, ${getPatientFirstName(patient)}?`,
    `Passando aqui com carinho para confirmar a sua consulta agendada para ${dayText} às ${getAppointmentTime(patient)} com a ${patient.profissional || "Dra. Ilara"} 🦷✨`,
    "",
    "Estamos te esperando com todo cuidado e atenção de sempre 💙",
    "",
    "Caso aconteça algum imprevisto e você não possa comparecer, pedimos, por gentileza, que nos avise o quanto antes. Assim conseguimos reorganizar a agenda e atender outro paciente que está aguardando 🙏",
    "",
    "Qualquer dúvida, estamos por aqui!",
    "Será um prazer cuidar do seu sorriso 😄",
  ].join("\n");
}

function buildMessage(patient, template, mode) {
  const message = template || buildDefaultMessage(patient, mode);

  return message
    .replaceAll("{{paciente}}", patient.paciente || "")
    .replaceAll("{{primeiroNome}}", getPatientFirstName(patient))
    .replaceAll("{{horario}}", getAppointmentTime(patient))
    .replaceAll("{{clinica}}", getClinicName())
    .replaceAll("{{profissional}}", patient.profissional || "")
    .replaceAll("{{descricao}}", patient.descricao || "");
}

export async function buildReminderPlanByDate(date, options = {}) {
  const response = await buildPatientsResponseByDate(date);
  const reminders = [];
  const skipped = [];
  const period = options.period || (options.mode === "afternoon" ? "afternoon" : "all");
  const template =
    options.template === undefined
      ? await getStoredReminderTemplate(options.mode || "evening")
      : options.template;

  for (const patient of response.pacientes) {
    if (!isInPeriod(patient, period)) {
      continue;
    }

    const number = normalizeWhatsAppNumber(patient.telefone);

    if (!number) {
      skipped.push({
        consultaId: patient.consultaId,
        paciente: patient.paciente,
        motivo: "telefone ausente ou invalido",
      });
      continue;
    }

    reminders.push({
      consultaId: patient.consultaId,
      paciente: patient.paciente,
      telefoneOriginal: patient.telefone,
      numeroWhatsApp: number,
      horario: getAppointmentTime(patient),
      mensagem: buildMessage(patient, template, options.mode),
    });
  }

  return {
    data: response.data,
    profissionalAutenticado: response.profissionalAutenticado,
    totalConsultas: response.total,
    totalEnviaveis: reminders.length,
    totalIgnorados: skipped.length,
    reminders,
    skipped,
  };
}

export async function sendAppointmentRemindersByDate(date, options = {}) {
  const dryRun = options.dryRun !== false;
  const mode = options.mode || "evening";
  const plan = await buildReminderPlanByDate(date, {
    ...options,
    mode,
  });

  if (dryRun) {
    return {
      ...plan,
      dryRun: true,
      sent: [],
    };
  }

  ensureEvolutionConfig();

  const sent = [];
  const failed = [];
  const skippedAlreadySent = [];

  for (const reminder of plan.reminders) {
    const sendKey = buildSendKey({
      date,
      mode,
      consultaId: reminder.consultaId,
    });

    if (!options.force && (await wasReminderSent(sendKey))) {
      skippedAlreadySent.push({
        consultaId: reminder.consultaId,
        paciente: reminder.paciente,
        motivo: "lembrete ja enviado",
      });
      continue;
    }

    const delay = randomDelayMs();

    try {
      try {
        await sendTypingPresence(reminder.numeroWhatsApp, delay);
      } catch (error) {
        console.warn(
          `Aviso: presenca de digitacao falhou para ${reminder.paciente}, seguindo com envio: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }
      await sleep(delay);
      const response = await sendTextMessage(
        reminder.numeroWhatsApp,
        reminder.mensagem,
        delay
      );

      sent.push({
        consultaId: reminder.consultaId,
        paciente: reminder.paciente,
        numeroWhatsApp: reminder.numeroWhatsApp,
        status: response?.status || "sent",
      });
      await markReminderSent(sendKey, {
        consultaId: reminder.consultaId,
        paciente: reminder.paciente,
        numeroWhatsApp: reminder.numeroWhatsApp,
        mode,
        responseStatus: response?.status || "sent",
      });
    } catch (error) {
      failed.push({
        consultaId: reminder.consultaId,
        paciente: reminder.paciente,
        numeroWhatsApp: reminder.numeroWhatsApp,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return {
    ...plan,
    dryRun: false,
    sent,
    skippedAlreadySent,
    failed,
  };
}
