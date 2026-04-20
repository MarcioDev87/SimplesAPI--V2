import { execFile } from "node:child_process";
import { promisify } from "node:util";

const LOGIN_URL = "https://api.simplesdental.com/loginmultiplo";
const CONSULTAS_URL = "https://api.simplesdental.com/consultas";
const AGENDA_REFERER = "https://app.simplesdental.com/simples/agenda";
const LOGIN_REFERER = "https://app.simplesdental.com/simples/login";
const execFileAsync = promisify(execFile);

function getConfig() {
  return {
    username: process.env.SIMPLES_DENTAL_USERNAME,
    password: process.env.SIMPLES_DENTAL_PASSWORD,
    professionalIndex: Number(process.env.SIMPLES_DENTAL_PROFESSIONAL_INDEX || 0),
    confirmedStatus: Number(process.env.SIMPLES_DENTAL_CONFIRMED_STATUS || 1),
    timezoneOffset: process.env.CLINIC_TIMEZONE_OFFSET || "-03:00",
    windowsSessionEnabled:
      process.env.SIMPLES_DENTAL_WINDOWS_SESSION_ENABLED !== "false",
    windowsHelperDir:
      process.env.SIMPLES_DENTAL_WINDOWS_HELPER_DIR ||
      "C:\\Users\\marci\\Documents\\Codex\\simplesAPI-github",
    windowsProfileDir:
      process.env.SIMPLES_DENTAL_WINDOWS_PROFILE_DIR ||
      "C:\\Users\\marci\\Documents\\Codex\\simplesAPI-github\\tmp-edge-profile",
    windowsStorageStatePath:
      process.env.SIMPLES_DENTAL_WINDOWS_STORAGE_STATE_PATH ||
      "C:\\Users\\marci\\Documents\\Codex\\simplesAPI-github\\simples-storage-state.json",
    windowsEdgePath:
      process.env.SIMPLES_DENTAL_WINDOWS_EDGE_PATH ||
      "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    windowsPowerShellPath:
      process.env.SIMPLES_DENTAL_WINDOWS_POWERSHELL_PATH ||
      "/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe",
  };
}

function filterConfirmedConsultas(consultas) {
  const { confirmedStatus } = getConfig();
  return consultas.filter((consulta) => Number(consulta.status) === confirmedStatus);
}

export function ensureSimplesDentalConfig() {
  const config = getConfig();

  if (!config.username || !config.password) {
    throw new Error(
      "Defina SIMPLES_DENTAL_USERNAME e SIMPLES_DENTAL_PASSWORD no ambiente."
    );
  }
}

function buildDefaultHeaders(referer) {
  return {
    accept: "application/json, text/plain, */*",
    Referer: referer,
  };
}

async function parseJsonResponse(response, contextUrl = "") {
  const text = await response.text();

  try {
    return text ? JSON.parse(text) : null;
  } catch {
    const snippet = text.replace(/\s+/g, " ").slice(0, 200);
    throw new Error(
      `O Simples Dental retornou uma resposta invalida em ${contextUrl || "resposta desconhecida"}. Trecho: ${snippet}`
    );
  }
}

async function fetchJson(url, options, errorContext) {
  const response = await fetch(url, options);
  const body = await parseJsonResponse(response, url);

  if (!response.ok) {
    const detail =
      body && typeof body === "object" && "message" in body
        ? body.message
        : response.statusText;

    throw new Error(`${errorContext}: ${detail || "erro desconhecido"}`);
  }

  return body;
}

async function loginWithCredentials() {
  const config = getConfig();
  const response = await fetch(LOGIN_URL, {
    method: "POST",
    headers: {
      ...buildDefaultHeaders(LOGIN_REFERER),
      "content-type": "application/json",
    },
    body: JSON.stringify({
      username: config.username,
      password: config.password,
    }),
  });
  const body = await parseJsonResponse(response);

  if (!response.ok) {
    const detail =
      body && typeof body === "object" && "mensagem" in body
        ? body.mensagem
        : body && typeof body === "object" && "message" in body
        ? body.message
        : response.statusText;

    throw new Error(`Falha no login: ${detail || "erro desconhecido"}`);
  }

  if (body?.validacaoDoisFatores) {
    throw new Error("O login exigiu validacao em duas etapas.");
  }

  if (!body?.profissionais?.length) {
    throw new Error("Nenhum profissional foi retornado no login.");
  }

  const professional = body.profissionais[config.professionalIndex];

  if (!professional?.user?.token) {
    throw new Error(
      `Token nao encontrado para o profissional no indice ${config.professionalIndex}.`
    );
  }

  return {
    token: professional.user.token,
    professional,
  };
}

function escapePowerShell(value) {
  return value.replace(/'/g, "''");
}

async function loginWithWindowsSession() {
  const config = getConfig();

  if (!config.windowsSessionEnabled) {
    throw new Error("O fallback da sessao do Windows esta desativado.");
  }

  const jsScript = `
const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch({
    executablePath: ${JSON.stringify(config.windowsEdgePath)},
    headless: true
  });
  const context = await browser.newContext({
    storageState: ${JSON.stringify(config.windowsStorageStatePath)}
  });

  try {
    const page = await context.newPage();
    await page.goto("https://app.simplesdental.com/simples/agenda", {
      waitUntil: "domcontentloaded"
    });
    await page.waitForTimeout(5000);

    const session = await page.evaluate(() => {
      const loggedCookie = document.cookie
        .split("; ")
        .find((entry) => entry.startsWith("logged="));

      let logged = null;
      if (loggedCookie) {
        try {
          logged = JSON.parse(
            decodeURIComponent(loggedCookie.split("=").slice(1).join("="))
          );
        } catch {}
      }

      return {
        url: location.href,
        token: localStorage.getItem("X-AUTH-TOKEN"),
        nome: logged?.nome || null,
        email: logged?.email || null
      };
    });

    console.log(JSON.stringify(session));
  } finally {
    await context.close();
    await browser.close();
  }
})().catch((error) => {
  console.error(error?.stack || String(error));
  process.exit(1);
});
`.trim();

  const powerShellCommand = `
$ErrorActionPreference = 'Stop'
Set-Location '${escapePowerShell(config.windowsHelperDir)}'
$script = @'
${jsScript}
'@
$script | node -
`.trim();

  const { stdout, stderr } = await execFileAsync(
    config.windowsPowerShellPath,
    ["-NoProfile", "-Command", powerShellCommand],
    {
      maxBuffer: 1024 * 1024 * 10,
      windowsHide: true,
    }
  );

  if (stderr?.trim()) {
    console.warn("Aviso do helper do Windows:", stderr.trim());
  }

  const payload = JSON.parse(stdout.trim());

  if (!payload?.token) {
    throw new Error(
      "Nao foi possivel obter um token da sessao do Edge. Confirme se o perfil copiado continua autenticado."
    );
  }

  if (typeof payload.url === "string" && payload.url.includes("/login")) {
    throw new Error(
      "A copia do perfil do Edge nao esta autenticada no Simples Dental."
    );
  }

  return {
    token: payload.token,
    professional: {
      nome: payload.nome || "Sessao autenticada do Edge",
      email: payload.email || null,
    },
  };
}

async function login() {
  try {
    return await loginWithCredentials();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const shouldTryWindowsSession =
      message.includes("validacao em duas etapas") ||
      message.includes("Unauthorized") ||
      message.includes("Nenhum profissional") ||
      message.includes("motivos de seguranca") ||
      message.includes("motivos de segurança");

    if (!shouldTryWindowsSession) {
      throw error;
    }

    return loginWithWindowsSession();
  }
}

function buildDayRange(date, timezoneOffset) {
  const start = new Date(`${date}T00:00:00${timezoneOffset}`);
  const end = new Date(`${date}T23:59:59.999${timezoneOffset}`);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new Error("Data invalida.");
  }

  return {
    startDh: start.toISOString(),
    endDh: end.toISOString(),
  };
}

function formatLocalDateTime(value) {
  if (!value) {
    return null;
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Fortaleza",
  }).format(new Date(value));
}

async function fetchConsultas(token, date) {
  const { timezoneOffset } = getConfig();
  const range = buildDayRange(date, timezoneOffset);
  const query = new URLSearchParams({
    minimal: "true",
    startDh: range.startDh,
    endDh: range.endDh,
  });

  return fetchJson(
    `${CONSULTAS_URL}?${query.toString()}`,
    {
      method: "GET",
      headers: {
        ...buildDefaultHeaders(AGENDA_REFERER),
        "x-auth-token": token,
        "x-canary": "false",
      },
    },
    "Falha ao buscar consultas"
  );
}

async function fetchConsultaDetail(token, consultaId) {
  return fetchJson(
    `${CONSULTAS_URL}/${consultaId}`,
    {
      method: "GET",
      headers: {
        ...buildDefaultHeaders(AGENDA_REFERER),
        "x-auth-token": token,
        "x-canary": "false",
      },
    },
    `Falha ao buscar detalhes da consulta ${consultaId}`
  );
}

function normalizePatient(consulta, detail) {
  return {
    consultaId: consulta.id,
    data: consulta.data,
    dataFormatada: formatLocalDateTime(consulta.data),
    tempoEstimado: consulta.tempoEstimado || detail?.tempoEstimado || null,
    paciente: detail?.paciente?.nome || consulta.nomePaciente || null,
    telefone: detail?.paciente?.celular || null,
    profissional: consulta.nomeProfissional || detail?.profissional?.nome || null,
    status: consulta.status,
    cadeira: consulta.cadeira?.nome || detail?.cadeira?.nome || null,
    descricao: detail?.descricao || null,
  };
}

export async function buildPatientsResponseByDate(date) {
  const { token, professional } = await login();
  const consultas = filterConfirmedConsultas(await fetchConsultas(token, date));
  const details = await Promise.all(
    consultas.map((consulta) => fetchConsultaDetail(token, consulta.id))
  );

  const pacientes = consultas.map((consulta, index) =>
    normalizePatient(consulta, details[index])
  );

  return {
    data: date,
    total: pacientes.length,
    profissionalAutenticado: professional.nome,
    pacientes,
  };
}
