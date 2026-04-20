import {
  ensureEvolutionConfig,
  normalizeWhatsAppNumber,
  randomDelayMs,
  sendTextMessage,
  sendTypingPresence,
} from "./evolution-whatsapp.mjs";
import { buildPatientsResponseByDate } from "./simples-dental.mjs";

const scheduleTimeZone = process.env.DAILY_AGENDA_TIMEZONE || "America/Fortaleza";
const primaryProfessional = process.env.AGENDA_PRIMARY_PROFESSIONAL || "Ilara";
const primaryProfessionalLabel =
  process.env.AGENDA_PRIMARY_PROFESSIONAL_LABEL || "Dra. Ilara";

function normalizeSearchText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function formatLocalTime(value) {
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: scheduleTimeZone,
  }).format(new Date(value));
}

function addMinutes(date, minutes) {
  return new Date(new Date(date).getTime() + minutes * 60_000);
}

function cleanProfessionalName(value) {
  return String(value || "Profissional nao identificado")
    .replace(/\s+/g, " ")
    .replace(/\bDra\s+\./i, "Dra.")
    .replace(/\bDr\s+\./i, "Dr.")
    .trim();
}

function isPrimaryProfessional(patient) {
  const professional = normalizeSearchText(patient.profissional);
  const target = normalizeSearchText(primaryProfessional);

  return Boolean(professional && target && professional.includes(target));
}

function toAppointments(patients) {
  return patients
    .map((patient) => {
      const startDate = new Date(patient.data);
      const estimatedMinutes = Number(patient.tempoEstimado || 20);
      const endDate = addMinutes(startDate, estimatedMinutes);

      return {
        ...patient,
        profissional: cleanProfessionalName(patient.profissional),
        startDate,
        endDate,
        startTime: formatLocalTime(startDate),
        endTime: formatLocalTime(endDate),
      };
    })
    .filter((appointment) => !Number.isNaN(appointment.startDate.getTime()))
    .sort((left, right) => left.startDate - right.startDate);
}

function classifyProcedure(text) {
  const normalized = normalizeSearchText(text);

  if (/(exo|exodont|cirurg)/.test(normalized)) {
    return "cirurgia";
  }

  if (/(mold|protese)/.test(normalized)) {
    return "protese";
  }

  if (/(rrc|rest|resina)/.test(normalized)) {
    return "restauracao";
  }

  if (/(manut|orto|tubo|contenc|aparelho|lm)/.test(normalized)) {
    return "orto";
  }

  if (/(rx|raio-x|raio x)/.test(normalized)) {
    return "imagem";
  }

  if (/(limpeza|profilax)/.test(normalized)) {
    return "limpeza";
  }

  return "clinico";
}

function summarizeProcedureGroups(patients) {
  const counts = {
    restauracao: 0,
    cirurgia: 0,
    orto: 0,
    protese: 0,
    imagem: 0,
    limpeza: 0,
    clinico: 0,
  };

  for (const patient of patients) {
    counts[classifyProcedure(patient.descricao)] += 1;
  }

  const highlights = [];

  if (counts.restauracao > 0) {
    highlights.push(
      `predominam procedimentos restauradores, com ${counts.restauracao} atendimento(s) de restauracao ou ajuste restaurador`
    );
  }

  if (counts.cirurgia > 0) {
    highlights.push(
      `ha ${counts.cirurgia} procedimento(s) com perfil de cirurgia ou exodontia`
    );
  }

  if (counts.orto > 0) {
    highlights.push(
      `ha ${counts.orto} atendimento(s) de ortodontia, manutencao ou contencao`
    );
  }

  if (counts.protese > 0) {
    highlights.push(`existe ${counts.protese} caso(s) com perfil de moldagem ou protese`);
  }

  if (counts.imagem > 0) {
    highlights.push(`ha ${counts.imagem} avaliacao(oes) com imagem ou raio-x`);
  }

  if (highlights.length === 0) {
    highlights.push("a agenda tem perfil clinico geral, sem um bloco dominante muito claro");
  }

  return highlights;
}

function getLunchBreak(appointments) {
  if (appointments.length < 2) {
    return null;
  }

  let bestGap = null;

  for (let index = 0; index < appointments.length - 1; index += 1) {
    const currentEnd = appointments[index].endDate;
    const nextStart = appointments[index + 1].startDate;
    const gapMinutes = Math.round((nextStart.getTime() - currentEnd.getTime()) / 60_000);

    if (gapMinutes < 45) {
      continue;
    }

    const endHour = Number(formatLocalTime(currentEnd).split(":")[0]);
    const nextHour = Number(formatLocalTime(nextStart).split(":")[0]);

    if (endHour > 15 || nextHour < 11) {
      continue;
    }

    if (!bestGap || gapMinutes > bestGap.gapMinutes) {
      bestGap = {
        start: currentEnd,
        end: nextStart,
        gapMinutes,
      };
    }
  }

  return bestGap;
}

function buildScheduleLine(appointments, subject = "Seu atendimento") {
  const firstAppointment = appointments[0];
  const lastAppointment = appointments.at(-1);
  const lunchBreak = getLunchBreak(appointments);
  const startTime = firstAppointment ? firstAppointment.startTime : "sem horario";
  const endTime = lastAppointment ? lastAppointment.endTime : "sem horario";

  if (lunchBreak) {
    return `${subject} comeca as ${startTime}, vai ate ${formatLocalTime(
      lunchBreak.start
    )}, faz pausa para almoco e retorna as ${formatLocalTime(
      lunchBreak.end
    )}, seguindo ate ${endTime}.`;
  }

  return `${subject} comeca as ${startTime} e tem perspectiva de ir ate ${endTime}. Nao identifiquei uma pausa longa para almoco na agenda.`;
}

function buildOtherProfessionalLines(appointments, primaryAppointments) {
  const primaryLastEnd = primaryAppointments.at(-1)?.endDate || null;
  const otherAppointments = appointments.filter(
    (appointment) => !isPrimaryProfessional(appointment)
  );

  if (otherAppointments.length === 0) {
    return [];
  }

  const appointmentsByProfessional = new Map();

  for (const appointment of otherAppointments) {
    const professionalName = cleanProfessionalName(appointment.profissional);
    const professionalAppointments = appointmentsByProfessional.get(professionalName) || [];
    professionalAppointments.push(appointment);
    appointmentsByProfessional.set(professionalName, professionalAppointments);
  }

  return Array.from(appointmentsByProfessional.entries())
    .map(([professionalName, professionalAppointments]) => {
      const sortedAppointments = professionalAppointments.sort(
        (left, right) => left.startDate - right.startDate
      );
      const firstAppointment = sortedAppointments[0];
      const lastAppointment = sortedAppointments.at(-1);
      const startsAfterPrimary =
        primaryLastEnd && firstAppointment.startDate.getTime() >= primaryLastEnd.getTime();
      const prefix = startsAfterPrimary
        ? "Depois disso, quem atende e"
        : "Tambem ha atendimentos com";

      return `${prefix} ${professionalName}, de ${firstAppointment.startTime} ate ${lastAppointment.endTime}.`;
    })
    .sort();
}

export function buildDailyAgendaSummaryMessage(agenda, periodLabel = "hoje") {
  const primaryPatients = agenda.pacientes.filter(isPrimaryProfessional);

  if (primaryPatients.length === 0) {
    return [
      "Bom dia flor do dia!",
      "Vou fazer o resumo dos seus atendimentos de hoje.",
      "",
      `Nao encontrei atendimentos confirmados da ${primaryProfessionalLabel} para ${periodLabel}.`,
    ].join("\n");
  }

  const appointments = toAppointments(agenda.pacientes);
  const primaryAppointments = toAppointments(primaryPatients);
  const groupedHighlights = summarizeProcedureGroups(primaryAppointments);
  const uniqueContacts = new Map();

  for (const appointment of primaryAppointments) {
    if (!uniqueContacts.has(appointment.paciente)) {
      uniqueContacts.set(
        appointment.paciente,
        appointment.telefone || "telefone nao encontrado"
      );
    }
  }

  const contactLines = Array.from(uniqueContacts.entries()).map(
    ([patientName, phone]) => `- ${patientName}: ${phone}`
  );
  const procedureLines = groupedHighlights.map((item) => `- ${item}`);
  const scheduleLine = buildScheduleLine(primaryAppointments);
  const otherProfessionalLines = buildOtherProfessionalLines(
    appointments,
    primaryAppointments
  );

  const lines = [
    "Bom dia flor do dia!",
    "Vou fazer o resumo dos seus atendimentos de hoje.",
    "",
    scheduleLine,
    "",
    "Resumo do dia:",
    ...procedureLines,
  ];

  if (otherProfessionalLines.length > 0) {
    lines.push(
      "",
      "Outros atendimentos confirmados:",
      ...otherProfessionalLines,
      "",
      "Voce tambem quer que eu envie um resumo dos atendimentos da outra dentista?"
    );
  }

  lines.push("", `Pacientes e telefones de ${periodLabel}:`, ...contactLines);

  return lines.join("\n");
}

export async function sendDailyAgendaSummaryByDate(date, options = {}) {
  const number = normalizeWhatsAppNumber(
    options.number || process.env.DAILY_AGENDA_WHATSAPP_NUMBER
  );

  if (!number) {
    throw new Error("Defina DAILY_AGENDA_WHATSAPP_NUMBER ou informe --number=DDDNUMERO.");
  }

  const agenda = await buildPatientsResponseByDate(date);
  const message = buildDailyAgendaSummaryMessage(agenda, options.periodLabel || "hoje");

  if (options.dryRun !== false) {
    return {
      data: date,
      dryRun: true,
      number,
      totalConsultas: agenda.total,
      message,
    };
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

  const response = await sendTextMessage(number, message, delay);

  return {
    data: date,
    dryRun: false,
    number,
    totalConsultas: agenda.total,
    status: response?.status || "sent",
  };
}
