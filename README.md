# simplesAPI

API interna para consultar os pacientes agendados no `Simples Dental` por data e usar esses dados em automacoes, como envio de mensagens por WhatsApp.

## Configuracao

Crie um `.env` com:

```env
PORT=3001
SIMPLES_DENTAL_USERNAME=seu-login
SIMPLES_DENTAL_PASSWORD=sua-senha
SIMPLES_DENTAL_PROFESSIONAL_INDEX=0
SIMPLES_DENTAL_CONFIRMED_STATUS=1
CLINIC_TIMEZONE_OFFSET=-03:00
CLINIC_NAME=Clínica Dra. Ilara Queiroz
SIMPLES_DENTAL_WINDOWS_SESSION_ENABLED=true
SIMPLES_DENTAL_WINDOWS_HELPER_DIR=C:\Users\marci\Documents\Codex\simplesAPI-github
SIMPLES_DENTAL_WINDOWS_PROFILE_DIR=C:\Users\marci\Documents\Codex\simplesAPI-github\tmp-edge-profile
SIMPLES_DENTAL_WINDOWS_STORAGE_STATE_PATH=C:\Users\marci\Documents\Codex\simplesAPI-github\simples-storage-state.json
SIMPLES_DENTAL_WINDOWS_EDGE_PATH=C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe
SIMPLES_DENTAL_WINDOWS_POWERSHELL_PATH=/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe

EVOLUTION_API_URL=http://127.0.0.1:8080
EVOLUTION_API_KEY=sua-chave-global-ou-da-instancia
EVOLUTION_INSTANCE_NAME=clinica-ilara
EVOLUTION_LINK_PREVIEW=false
WHATSAPP_DEFAULT_COUNTRY_CODE=55
WHATSAPP_DELAY_MIN_MS=2000
WHATSAPP_DELAY_MAX_MS=5000
REMINDER_SEND_LOG_PATH=data/reminder-sends.json

POSTGRES_DATABASE=evolution
POSTGRES_USERNAME=evolution
POSTGRES_PASSWORD=troque-esta-senha

AUTHENTICATION_API_KEY=mesma-chave-do-EVOLUTION_API_KEY
DATABASE_ENABLED=true
DATABASE_PROVIDER=postgresql
DATABASE_CONNECTION_URI=postgresql://evolution:troque-esta-senha@evolution-postgres:5432/evolution?schema=public
DATABASE_CONNECTION_CLIENT_NAME=evolution_simples

CACHE_REDIS_ENABLED=true
CACHE_REDIS_URI=redis://evolution-redis:6379/1
CACHE_REDIS_PREFIX_KEY=evolution_simples
CACHE_REDIS_SAVE_INSTANCES=false
CACHE_LOCAL_ENABLED=false

WEBSOCKET_ENABLED=true
WEBSOCKET_GLOBAL_EVENTS=true
```

## Executar

```bash
bun run dev
```

Para subir a Evolution API gratuita com Redis e Postgres:

```bash
docker compose up -d
```

Use a mesma chave em `AUTHENTICATION_API_KEY` (Evolution) e `EVOLUTION_API_KEY` (esta API).

Para criar/conectar a instancia, abra o Manager em `http://localhost:3000`, crie a instancia `clinica-ilara` usando `WHATSAPP-BAILEYS` e leia o QR Code com o WhatsApp do numero remetente.

## Rotas

`GET /health`

Resposta simples de status.

`GET /pacientes?data=2026-04-16`

Retorna somente as consultas confirmadas do dia, com nome do paciente, telefone e horario formatado.

Exemplo de resposta:

```json
{
  "ok": true,
  "data": "2026-04-16",
  "total": 2,
  "profissionalAutenticado": "Dra. Exemplo",
  "pacientes": [
    {
      "consultaId": 123,
      "data": "2026-04-16T12:30:00.000Z",
      "dataFormatada": "16/04/2026, 09:30",
      "paciente": "Maria Silva",
      "telefone": "85999999999",
      "profissional": "Dra. Exemplo",
      "status": 1,
      "cadeira": "Sala 1",
      "descricao": "Consulta de retorno"
    }
  ]
}
```

`GET /lembretes?data=2026-04-16`

Prepara os lembretes de WhatsApp sem enviar. Remove consultas sem telefone valido e normaliza os numeros para o formato com DDI, por exemplo `5585999999999`.

Use `mode=evening` para mensagem de vespera e `mode=morning` para mensagem do dia.

`POST /lembretes/enviar`

Por seguranca, roda em `dryRun` por padrao. Para enviar de verdade, envie `dryRun: false`.

```json
{
  "data": "2026-04-16",
  "dryRun": true,
  "force": false,
  "mode": "evening",
  "template": "Ola, {{paciente}}. Lembrete da sua consulta as {{horario}} na {{clinica}}."
}
```

Quando `dryRun` for `false`, a API chama a Evolution API em duas etapas por paciente:

1. `POST /chat/sendPresence/{instance}` com `presence: "composing"`.
2. `POST /message/sendText/{instance}` com a mensagem.

O intervalo aleatorio entre mensagens usa `WHATSAPP_DELAY_MIN_MS` e `WHATSAPP_DELAY_MAX_MS`.

Cada envio real fica registrado em `REMINDER_SEND_LOG_PATH`. Se o agendador rodar duas vezes para a mesma consulta e mesmo modo, a segunda execucao e ignorada. Use `force: true` somente para reenviar.

## Disparo automatico

Scripts prontos para cron, n8n ou Agendador de Tarefas:

```bash
bun run reminders:send:tomorrow
bun run reminders:send:today
```

Use os previews antes do envio real:

```bash
bun run reminders:preview:tomorrow
bun run reminders:preview:today
```

Agenda sugerida:

1. Noite: `reminders:send:tomorrow` para consultas do dia seguinte.
2. Manha: `reminders:send:today` para consultas do mesmo dia.

## Teste avulso

```bash
bun run whatsapp:test --number=85996249271 --message="Teste de automação"
```

Para enviar de verdade:

```bash
bun run whatsapp:test --number=85996249271 --message="Teste de automação" --dry-run=false
```

## Observacoes

- As credenciais do `Simples Dental` nao devem ficar hardcoded no codigo.
- Os envios reais dependem de uma instancia conectada na `Evolution API`.
- Se o login direto cair em `2FA`, a API tenta reutilizar uma sessao salva em `storageState` do Playwright no Windows.
- O helper do Windows espera encontrar `playwright` instalado em `SIMPLES_DENTAL_WINDOWS_HELPER_DIR` e o arquivo autenticado em `SIMPLES_DENTAL_WINDOWS_STORAGE_STATE_PATH`.
- O filtro de status confirmado usa `SIMPLES_DENTAL_CONFIRMED_STATUS` e o padrao atual e `1`.
