type LoginJson = {
  profissionais: Array<{
    id: number;
    nome: string;
    regra: string;
    company: {
      id: number;
      nome: string;
      status: number;
      versao: number;
    };
    user: {
      id: number;
      token: string;
      tokenMaster: string;
      versao: number;
    };
  }>;
  token: string;
};
export type ConsultasJson = Array<{
  tempoEstimado: number;
  data: string;
  nomeProfissional: string;
  cadeira: {
    nome: string;
    id: number;
  };
  paciente: {
    nome: string;
    dtNascimento?: string;
  };
  id: number;
  profissional: {
    nome: string;
    id: number;
  };
  nomePaciente: string;
  status: number;
}>;
export type PacienteJson = {
  "@id": string;
  audCriadoData: string;
  audCriadoPor: string;
  audModificadoData: string;
  audModificadoPor: string;
  iDatabases: number;
  versao: number;
  agendado: boolean;
  avisadoEmail: boolean;
  avisadoLembrete: boolean;
  confirmacaoEnviada: boolean;
  avisarEmail: boolean;
  avisarLembrete: boolean;
  enviarMensagemConfirmacao: boolean;
  cadeira: {
    "@id": string;
    audCriadoData: string;
    audCriadoPor: string;
    audModificadoData: string;
    audModificadoPor: string;
    iDatabases: number;
    versao: number;
    ativa: boolean;
    excluido: boolean;
    inativadaViaLoja: boolean;
    id: number;
    nome: string;
  };
  data: string;
  descricao: string;
  excluido: boolean;
  exemplo: boolean;
  id: number;
  ignorarCancelada: boolean;
  maisConsultas: boolean;
  mensagens: any;
  obsRetorno: string;
  paciente: {
    "@id": string;
    audCriadoData: string;
    audCriadoPor: string;
    audModificadoData: string;
    audModificadoPor: string;
    iDatabases: number;
    versao: number;
    id: number;
    celular: string;
    consultas: any;
    orcamentos: any;
    maisConsultas: boolean;
    nome: string;
    nomeFonetica: string;
    excluido: boolean;
    numeroPaciente: number;
    observacao: string;
    parametrosPaciente: {
      id: number;
    };
    plano: {
      id: number;
    };
    sexo: string;
    tratamentos: any;
    enviarConfirmacaoConsulta: boolean;
    enviarSmsCampanhas: boolean;
    enviarMensagemServicoPrestado: boolean;
    solicitarEmailAssinatura: boolean;
    etiquetas: any;
    ddi: number;
    estrangeiro: boolean;
  };
  profissional: {
    "@id": string;
    audCriadoData: string;
    audCriadoPor: string;
    audModificadoData: string;
    audModificadoPor: string;
    iDatabases: number;
    versao: number;
    linkAgendamentoAtivo: boolean;
    atendeMaisConsultas: boolean;
    ativo: boolean;
    celular: string;
    clinica: {
      id: number;
    };
    consultas: any;
    cpf: string;
    email: string;
    horarios: any;
    id: number;
    nome: string;
    nps: any;
    podeAcessarImagens: boolean;
    regra: string;
    rolesDTO: Array<any>;
    modulos: Array<any>;
    status: number;
    tempoConsulta: number;
    user: {
      id: number;
    };
    usuario: string;
    comissoesRegras: any;
    appPushNotificationsEnabled: boolean;
    hasComissoesRegras: boolean;
    expired: boolean;
  };
  reagendado: boolean;
  status: number;
  tempoEstimado: number;
  consultasTratamentos: any;
  updateTratamento: boolean;
  primeiroEnvioConfirmacao: boolean;
  primeiraConsultaClinica: boolean;
  semProximaAgendada: boolean;
  countRespostas: number;
  criadoPor: string;
  linkConfirmacaoWeb: string;
  codigoConfirmacaoConsulta: string;
  origem: string;
  enviarConfirmacao: boolean;
  statusAsCodigo: number;
};

async function main() {
  const loginRequest = await fetch(
    "https://api.simplesdental.com/loginmultiplo",
    {
      headers: {
        accept: "application/json, text/plain, */*",
        "content-type": "application/json",
        "sec-ch-ua":
          '"Chromium";v="140", "Not=A?Brand";v="24", "Google Chrome";v="140"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": '"Windows"',
        Referer: "https://app.simplesdental.com/simples/login",
      },
      body: '{"username":"marcio_videira@hotmail.com","password":"amojesus2805"}',
      method: "POST",
    }
  );
  const login = (await loginRequest.json()) as LoginJson;
  // console.log('Login realizado com sucesso:', login);
  // console.dir(login, {depth: null})
  const tokenIlara = login.profissionais[1]?.user?.token;
  if (!tokenIlara) {
    throw new Error("Token de autenticação não encontrado.");
  }
  const consultasRequest = await fetch(
    "https://api.simplesdental.com/consultas?minimal=true&startDh=2025-10-06T03:00:00.000Z&endDh=2025-10-07T03:00:00.000Z",
    {
      headers: {
        accept: "application/json, text/plain, */*",
        "sec-ch-ua":
          '"Chromium";v="140", "Not=A?Brand";v="24", "Google Chrome";v="140"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": '"Windows"',
        "x-auth-token": tokenIlara,
        "x-canary": "false",
        Referer: "https://app.simplesdental.com/simples/agenda",
      },
      body: null,
      method: "GET",
    }
  );
  const consultas = (await consultasRequest.json()) as ConsultasJson;
  console.log(`Foram encontradas ${consultas.length} consultas.`);
  // console.dir(consultas, {depth: null})
  for (const consulta of consultas) {
    // console.log(
    // `Consulta ID: ${consulta.id}, Paciente: ${consulta.nomePaciente}, Data: ${consulta.data}, Profissional: ${consulta.nomeProfissional},`
    const pacienteRequest = await fetch(
      `https://api.simplesdental.com/consultas/${consulta.id}`,
      {
        headers: {
          accept: "application/json, text/plain, */*",
          "accept-language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
          priority: "u=1, i",
          "sec-ch-ua":
            '"Chromium";v="140", "Not=A?Brand";v="24", "Google Chrome";v="140"',
          "sec-ch-ua-mobile": "?0",
          "sec-ch-ua-platform": '"Windows"',
          "sec-fetch-dest": "empty",
          "sec-fetch-mode": "cors",
          "sec-fetch-site": "same-site",
          "x-auth-token": tokenIlara,
          "x-canary": "false",
          Referer: "https://app.simplesdental.com/simples/agenda",
        },
        body: null,
        method: "GET",
      }
    );
    const paciente = (await pacienteRequest.json()) as PacienteJson;
    console.log(
      `O número do paciente ${paciente.paciente.nome} É ${
        paciente.paciente.celular
      } \n A data é ${new Intl.DateTimeFormat("pt-BR", {
        dateStyle: "short",
        timeStyle: "short",
      }).format(new Date(consulta.data))}`
    );
  }
  // console.dir(paciente, {depth: null})
}
main();
