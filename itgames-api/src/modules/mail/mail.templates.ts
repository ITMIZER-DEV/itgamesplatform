export const MAIL_TYPES = [
  'password_reset',
  'registration_confirmed',
  'payment_confirmed',
  'alert_new_registration',
  'alert_registration_cancelled',
  'alert_game_status',
  'alert_category_full',
  'password_changed',
] as const;

export type MailType = (typeof MAIL_TYPES)[number];

export function isMailType(value: string): value is MailType {
  return (MAIL_TYPES as readonly string[]).includes(value);
}

export interface TemplateDef {
  label: string;
  subject: string;
  body: string;
  variables: string[];
}

export const DEFAULT_TEMPLATES: Record<MailType, TemplateDef> = {
  password_reset: {
    label: 'Recuperação de senha',
    subject: 'Redefinição de senha — ITGames',
    body:
      'Olá, {{nome}}!\n\n' +
      'Recebemos um pedido para redefinir a sua senha. Use o link abaixo (válido por {{validade}}):\n{{link}}\n\n' +
      'Se você não fez esse pedido, ignore este e-mail.',
    variables: ['nome', 'link', 'validade'],
  },
  registration_confirmed: {
    label: 'Confirmação de inscrição',
    subject: 'Inscrição recebida — {{campeonato}}',
    body:
      'Olá, {{nome}}!\n\n' +
      'A inscrição da equipe {{equipe}} na categoria {{categoria}} do {{campeonato}} foi registrada com o número {{numero}} (valor {{valor}}).\n' +
      'O pagamento é confirmado pela organização; você receberá outro e-mail quando isso acontecer.',
    variables: ['nome', 'campeonato', 'categoria', 'equipe', 'numero', 'valor'],
  },
  payment_confirmed: {
    label: 'Confirmação de pagamento',
    subject: 'Pagamento confirmado — {{campeonato}}',
    body:
      'Olá, {{nome}}!\n\n' +
      'O pagamento da inscrição {{numero}} (equipe {{equipe}}, categoria {{categoria}}) foi confirmado. ' +
      'Sua vaga no {{campeonato}} está garantida.',
    variables: ['nome', 'campeonato', 'categoria', 'equipe', 'numero'],
  },
  alert_new_registration: {
    label: 'Alerta: nova inscrição (organizadores)',
    subject: 'Nova inscrição em {{campeonato}}',
    body:
      'Olá, {{nome}}!\n\n' +
      'Chegou uma nova inscrição no {{campeonato}}:\n\n' +
      'Equipe: {{equipe}}\nCategoria: {{categoria}}\nNúmero: {{numero}}\nIntegrantes: {{integrantes}}',
    variables: ['nome', 'campeonato', 'categoria', 'equipe', 'numero', 'integrantes'],
  },
  alert_registration_cancelled: {
    label: 'Alerta: inscrição cancelada',
    subject: 'Inscrição cancelada — {{campeonato}}',
    body:
      'Olá, {{nome}}!\n\n' +
      'A inscrição {{numero}} (equipe {{equipe}}, categoria {{categoria}}) do {{campeonato}} foi cancelada.',
    variables: ['nome', 'campeonato', 'categoria', 'equipe', 'numero'],
  },
  password_changed: {
    label: 'Aviso de senha alterada',
    subject: 'Sua senha foi alterada — ITGames',
    body:
      'Olá, {{nome}}!\n\n' +
      'A senha da sua conta foi alterada em {{quando}}.\n' +
      'Se não foi você, use "Esqueci minha senha" na tela de login para criar uma nova senha e avise a organização.',
    variables: ['nome', 'quando'],
  },
  alert_category_full: {
    label: 'Alerta: categoria esgotada',
    subject: 'Categoria esgotada — {{categoria}}',
    body:
      'Olá, {{nome}}!\n\n' +
      'A categoria {{categoria}} do {{campeonato}} atingiu o limite de {{limite}} inscrições e não aceita novas inscrições. ' +
      'Se uma inscrição for cancelada, a vaga volta a ficar disponível.',
    variables: ['nome', 'campeonato', 'categoria', 'limite'],
  },
  alert_game_status: {
    label: 'Alerta: campeonato liberado/bloqueado',
    subject: '{{campeonato}} foi {{status}}',
    body: 'Olá, {{nome}}!\n\nO campeonato {{campeonato}} foi {{status}} pelo administrador.',
    variables: ['nome', 'campeonato', 'status'],
  },
};

const BASE_SAMPLE = {
  nome: 'Maria Souza',
  campeonato: 'ITGames Summer 2026',
  categoria: 'INICIANTE - DUPLA MASCULINA',
  equipe: 'Dupla Dinâmica',
  numero: '#1185',
  valor: 'R$ 150,00',
  integrantes: 'Maria Souza, João Lima',
};

// Dados de exemplo para a prévia na tela
export const SAMPLE_VARS: Record<MailType, Record<string, string>> = {
  password_reset: {
    nome: BASE_SAMPLE.nome,
    link: 'https://exemplo.com.br/redefinir-senha?token=exemplo',
    validade: '1 hora',
  },
  registration_confirmed: BASE_SAMPLE,
  payment_confirmed: BASE_SAMPLE,
  alert_new_registration: BASE_SAMPLE,
  alert_registration_cancelled: BASE_SAMPLE,
  alert_game_status: { nome: BASE_SAMPLE.nome, campeonato: BASE_SAMPLE.campeonato, status: 'liberado' },
  password_changed: { nome: BASE_SAMPLE.nome, quando: '06/10/2026 15:30' },
  alert_category_full: {
    nome: BASE_SAMPLE.nome,
    campeonato: BASE_SAMPLE.campeonato,
    categoria: BASE_SAMPLE.categoria,
    limite: '30',
  },
};

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Passagem única: o valor substituído nunca é reinterpretado como {{outra}}
function substitute(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, name: string) => vars[name] ?? '');
}

export function renderText(template: string, vars: Record<string, string>): string {
  return substitute(template, vars);
}

// Escapa o texto do template e os valores; só então vira HTML com <br>
export function renderHtml(template: string, vars: Record<string, string>): string {
  const safeVars = Object.fromEntries(Object.entries(vars).map(([k, v]) => [k, escapeHtml(v)]));
  return substitute(escapeHtml(template), safeVars).replace(/\r?\n/g, '<br>');
}
