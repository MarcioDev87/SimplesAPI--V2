function getEvolutionConfig() {
  return {
    baseUrl: (process.env.EVOLUTION_API_URL || "").replace(/\/+$/, ""),
    apiKey: process.env.EVOLUTION_API_KEY,
    instanceName: process.env.EVOLUTION_INSTANCE_NAME || "clinica-ilara",
    linkPreview: process.env.EVOLUTION_LINK_PREVIEW === "true",
    delayMinMs: Number(process.env.WHATSAPP_DELAY_MIN_MS || 2000),
    delayMaxMs: Number(process.env.WHATSAPP_DELAY_MAX_MS || 5000),
    defaultCountryCode: process.env.WHATSAPP_DEFAULT_COUNTRY_CODE || "55",
  };
}

export function ensureEvolutionConfig() {
  const config = getEvolutionConfig();

  if (!config.baseUrl || !config.apiKey || !config.instanceName) {
    throw new Error(
      "Defina EVOLUTION_API_URL, EVOLUTION_API_KEY e EVOLUTION_INSTANCE_NAME no ambiente."
    );
  }
}

export function normalizeWhatsAppNumber(phone) {
  const { defaultCountryCode } = getEvolutionConfig();
  const digits = String(phone || "").replace(/\D/g, "");

  if (!digits) {
    return null;
  }

  if (digits.startsWith(defaultCountryCode) && digits.length >= 12) {
    return digits;
  }

  if (digits.length === 10 || digits.length === 11) {
    return `${defaultCountryCode}${digits}`;
  }

  return null;
}

export function randomDelayMs() {
  const { delayMinMs, delayMaxMs } = getEvolutionConfig();
  const min = Math.max(0, Math.min(delayMinMs, delayMaxMs));
  const max = Math.max(min, delayMaxMs);

  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function evolutionFetch(path, body, errorContext) {
  const config = getEvolutionConfig();
  const response = await fetch(`${config.baseUrl}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      apikey: config.apiKey,
    },
    body: JSON.stringify(body),
  });

  const text = await response.text();
  let payload = null;

  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = { raw: text };
    }
  }

  if (!response.ok) {
    const detail =
      payload && typeof payload === "object"
        ? payload.message || payload.error || payload.raw
        : response.statusText;

    throw new Error(`${errorContext}: ${detail || response.statusText}`);
  }

  return payload;
}

export async function sendTypingPresence(number, delay) {
  const { instanceName } = getEvolutionConfig();

  return evolutionFetch(
    `/chat/sendPresence/${encodeURIComponent(instanceName)}`,
    {
      number,
      options: {
        delay,
        presence: "composing",
        number,
      },
    },
    "Falha ao enviar presenca de digitacao"
  );
}

export async function sendTextMessage(number, text, delay) {
  const { instanceName, linkPreview } = getEvolutionConfig();

  return evolutionFetch(
    `/message/sendText/${encodeURIComponent(instanceName)}`,
    {
      number,
      text,
      delay,
      linkPreview,
    },
    "Falha ao enviar mensagem"
  );
}
