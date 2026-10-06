/**
 * Utilitários de Conformidade com a LGPD (Lei Geral de Proteção de Dados - Lei nº 13.709/2018)
 * Minimização de Dados (PII - Personally Identifiable Information) e Mascaramento
 */

export function maskCpf(cpf?: string): string {
  if (!cpf) return '***.***.***-**';
  const clean = cpf.replace(/\D/g, '');
  if (clean.length === 11) {
    return `***.${clean.slice(3, 6)}.${clean.slice(6, 9)}-**`;
  }
  return '***.***.***-**';
}

export function maskPhone(phone?: string): string {
  if (!phone) return '(**) *****-****';
  const clean = phone.replace(/\D/g, '');
  if (clean.length >= 10) {
    const ddd = clean.slice(0, 2);
    const lastDigits = clean.slice(-4);
    return `(${ddd}) 9****-${lastDigits}`;
  }
  return '(**) *****-****';
}

export function maskEmail(email?: string): string {
  if (!email || !email.includes('@')) return '***@***.com';
  const [user, domain] = email.split('@');
  const maskedUser = user.length > 2 
    ? `${user[0]}***${user[user.length - 1]}` 
    : `${user[0]}***`;
  return `${maskedUser}@${domain}`;
}

export const LGPD_TERMS_OF_USE = {
  version: '2026.1',
  title: 'Termo de Consentimento para Tratamento de Dados Pessoais e Direito de Imagem (LGPD)',
  summary: 'Em conformidade com a Lei Federal nº 13.709/2018 (LGPD), ao participar do evento esportivo você concorda com o tratamento de dados necessários para cronometragem, súmulas oficiais, auditoria de arbitragem e exibição no placar público e telão.',
  points: [
    'Seus dados cadastrais (nome, idade, gênero e afiliação) serão utilizados exclusivamente para alocação de categorias, baterias e pontuação.',
    'Documentos como CPF e dados de contato serão tratados sob sigilo e mascarados em relatórios e exibições públicas.',
    'As súmulas de campo contendo fotos, assinaturas digitais e tempos são mantidas para fins legítimos de auditoria e resolução de recursos durante a competição.',
    'Você autoriza a captação e exibição do seu nome, categoria e pontuação nos telões da arena e rankings ao vivo.'
  ]
};
