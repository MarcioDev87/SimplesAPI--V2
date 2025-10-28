// svc-playwright/index.mjs
import express from 'express';
import fs from 'fs';
import dotenv from 'dotenv';
import { chromium } from 'playwright';
import * as cheerio from 'cheerio';

dotenv.config();

const app = express();
app.use(express.json());

// Configurações
const LOGIN_URL = process.env.LOGIN_URL || 'https://app.simplesdental.com/simples/login';
const COMPANIES_URL = process.env.COMPANIES_URL || 'https://app.simplesdental.com/simples/companies';
const AGENDA_URL = process.env.AGENDA_URL || 'https://app.simplesdental.com/simples/agenda';
const STORAGE_FILE = process.env.STORAGE_FILE || './storageState.json';
const email_login = 'marcio_videira@hotmail.com';
const senha_login = 'amojesus2805';

/**
 * SELETORES - Ajuste conforme o DOM real do Simples Dental
 * Recomendo inspecionar a página e ajustar esses seletores
 */
const SELECTORS = {
  user: '#mat-input-0',
  pass: '#mat-input-1',
  submit: 'body > sd-app > sd-login-page > div > mat-card > mat-card-content > form > div > button',
  submite2: 'body > sd-app > sd-companies-page > div > sd-companies-list > mat-grid-list > div > mat-grid-tile:nth-child(2) > div > mat-card > mat-card-actions > button > span.mat-mdc-button-persistent-ripple.mdc-button__ripple',
  selecionar_dentista: '#mat-select-2 > div > div.mat-mdc-select-arrow-wrapper.ng-tns-c1711764913-6 > div > svg',
  selecionar_todos_dentistas: '#mat-option-4 > span',
  // Seletores da agenda (ajustar após inspecionar)
  agendaItems: '.appointment, .agenda-item, .agendamento, [data-appointment], .consulta',
  clientName: '.client-name, .nome-paciente, .patient-name, [data-patient-name]',
  clientPhone: '.client-phone, .telefone, .phone, [data-phone]',
  date: '.date, .data, [data-date]',
  time: '.time, .hora, .horario, [data-time]',
  procedure: '.procedure, .procedimento, .treatment, [data-procedure]'
};

// ==================== ROTA: Análise de Seletores ====================
/**
 * GET /login-selectors
 * Analisa a página de login e retorna os seletores encontrados
 * Útil para descobrir os campos corretos antes de tentar login automático
 */
// console.log('1️⃣ Tentando lançar o browser...');
// browser = await chromium.launch({ headless: false });
// console.log('2️⃣ Browser lançado com sucesso!');


const browser = await chromium.launch({
  headless: false,
  // args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
});
    const context = await browser.newContext();
    const page = await context.newPage();

    console.log('📄 Carregando página de login...');
    await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded' });
    console.log('🔍 Página carregada. Tentando preencher o formulário de login...') ;
    await page.fill(SELECTORS.user, email_login);
    console.log('✍️  E-mail preenchido.');
    await page.fill(SELECTORS.pass, senha_login);
    console.log('✍️  Senha preenchida.');
    await page.click(SELECTORS.submit);
    console.log('🚀 Formulário enviado. Aguardando redirecionamento...');
    await page.waitForURL('**/companies', { timeout: 10000 });
console.log('✅ Login bem-sucedido!');

    await page.goto(COMPANIES_URL, { waitUntil: 'domcontentloaded' });
    console.log('📄 Página de empresas carregada.');
        await page.click(SELECTORS.submite2);
console.log('🚀 Empresa selecionada. Aguardando redirecionamento...');
await page.goto(AGENDA_URL, { waitUntil: 'domcontentloaded' });
console.log('📄 Página de agenda carregada.') ;
await page.click(SELECTORS.selecionar_dentista);
console.log('🚀 Seleção de dentista aberta.') ;
await page.click(SELECTORS.selecionar_todos_dentistas);
console.log('✅ Todos os dentistas selecionados.') ;
const content = await page.content();
console.log('📄 Conteúdo da página obtido.');
    const $ = cheerio.load(content);
    console.log('Shyriu carregado com sucesso.');
const agenda = [];
const nomes = await page.$$eval(
  '#content-primary .fc-event-title-container > div',
  elements => elements.map(el => el.textContent.trim())
);

console.log('Nomes dos pacientes:', nomes);



//     $('.agenda-item, .appointment, [data-appointment]').each((i, el) => {
//       const nome = $(el).find('.nome-paciente, .client-name, [data-patient-name]').text().trim();
//       const hora = $(el).find('.hora, .time, [data-time]').text().trim();
//       const procedimento = $(el).find('.procedimento, .procedure, [data-procedure]').text().trim();
//       const telefone = $(el).find('.telefone, .phone, [data-phone]').text().trim();
//        if (nome) {
//         agenda.push({ nome, hora, procedimento, telefone });
//       }
//     });

//     console.log(`✅ ${agenda.length} agendamentos encontrados!`);
//     res.json({ ok: true, agenda });
// const nomeElemento = await page.locator('#content-primary > sd-agenda-page > div > div.sd-agenda-page__container.ng-star-inserted > div > sd-agenda-calendar > div > div > div > table > tbody > tr:nth-child(3) > td > div > div > div > div.fc-timegrid-cols > table > tbody > tr > td.fc-day.fc-day-mon.fc-day-today.fc-timegrid-col > div > div:nth-child(2) > div:nth-child(4) > a > div.fc-event-main > div > div.fc-event-title-container > div');
// const nome = await nomeElemento.innerText();
// console.log('Nome do paciente:', nome);





   