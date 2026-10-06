# Configuração de e-mails Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** O super admin configura, numa aba do `/admin`, o envio de e-mails por SMTP (Google Workspace) e escolhe quais e-mails saem e com qual texto: recuperação de senha, confirmação de inscrição, confirmação de pagamento e três alertas.

**Architecture:** Módulo global `mail` na API (NestJS): `MailService` (configuração no banco com senha criptografada, templates com padrão no código, envio assíncrono que nunca lança, log em `email_logs`) e `MailNotifier` (resolve destinatários e é chamado pelos serviços de eventos). Recuperação de senha entra em `AuthService` com token de uso único. O frontend ganha a aba "E-mails" e as telas de "esqueci minha senha".

**Tech Stack:** NestJS 10, Prisma 5 (PostgreSQL 18), `nodemailer`, `class-validator`, Jest + supertest (e2e), Next.js (App Router, `'use client'`), Tailwind, `sonner`, `lucide-react`.

**Spec:** `docs/superpowers/specs/2026-10-06-configuracao-de-emails-design.md`

## Global Constraints

- Idioma: toda mensagem de usuário, texto padrão de e-mail, comentário e doc em **português do Brasil, com acentuação correta**. Identificadores de código em inglês/como já existem.
- **Banco:** nunca usar `migrate reset`, `db push --force-reset`, `--accept-data-loss` contra `itgames_db`, nem `DROP`/`TRUNCATE` fora do `resetDb` dos testes (skill `no-db-reset`). Só tabelas **novas**; nenhuma tabela existente é alterada, exceto a relação inversa no model `User` (sem coluna nova).
- Testes e2e rodam **somente** no banco `itgames_test` (`resetDb` recusa outro). O Postgres do compose não publica a 5433: subir um descartável (veja Task 8) antes de rodar os testes.
- A senha SMTP **nunca** sai da API (nem na resposta, nem em log, nem em `email_logs`). Cifra AES-256-GCM, formato `iv:tag:cipher` em base64, chave = SHA-256 de `MAIL_ENCRYPTION_KEY`, ou de `JWT_SECRET` se ausente.
- `MailService.send` e `dispatch` **nunca lançam**: falha de e-mail não pode derrubar inscrição, pagamento ou mudança de status.
- Links nos e-mails usam apenas `appBaseUrl` (nunca o header `Host`). Variáveis de usuário são escapadas em HTML no corpo.
- `POST /auth/forgot-password` responde **sempre 200** com a mesma mensagem; o trabalho roda em segundo plano.
- Regra de senha: mínimo 8 caracteres (igual `ChangePasswordDto`).
- Alertas a organizadores vão só para vínculos `GameOrganizer.active = true`.
- Rotas `/mail/*` exigem `SUPER_ADMIN`; `/auth/forgot-password` e `/auth/reset-password` são `@Public()`.
- Convenção do repo: um commit por task, mensagem em inglês no estilo `feat(mail): ...`, terminando com as linhas de atribuição pedidas pelo harness. **Só commitar se o usuário pedir** (nesta sessão ele não pediu); os passos "Commit" abaixo ficam condicionados a isso.
- Next.js deste repo tem mudanças que quebram APIs conhecidas (`itgames-platform/AGENTS.md`): copiar os padrões das páginas existentes (`trocar-senha/page.tsx`, `login/page.tsx`) e só consultar `node_modules/next/dist/docs/` se o build reclamar.

## Review Focus

1. **Duas requisições `forgot-password` seguidas para o mesmo e-mail** não podem gerar mais de 3 e-mails por hora, e a 4ª precisa responder igual (200) sem enviar. Teste na Task 4.
2. **Token de reset reutilizado, expirado, adulterado ou vazio** deve dar 400 com a mesma mensagem, e um token novo invalida os anteriores ao ser usado. Teste na Task 4.
3. **SMTP fora do ar ou senha ilegível (chave trocada)** durante `registerTeam`: a inscrição retorna 201 e o log mostra `failed`/`skipped`. Teste na Task 5.
4. **PUT de configurações sem `password`** não pode apagar a senha salva; **com `enabled: true` e campos faltando** deve ser 400. Teste na Task 3.
5. **Conteúdo malicioso** (`<script>` no nome da equipe, quebra de linha no assunto) não pode chegar sem escape ao HTML do corpo nem injetar cabeçalho no assunto. Teste na Task 2.

---

## File Structure

**API — criar**
- `itgames-api/src/modules/mail/mail.module.ts` — módulo `@Global()`; provê `MailService`, `MailNotifier`, o factory de transporte.
- `itgames-api/src/modules/mail/mail.crypto.ts` — `encryptSecret`/`decryptSecret`.
- `itgames-api/src/modules/mail/mail.templates.ts` — tipos, textos padrão, variáveis, exemplos, `renderText`/`renderHtml`.
- `itgames-api/src/modules/mail/mail.transport.ts` — token `MAIL_TRANSPORT_FACTORY`, interfaces e a implementação com `nodemailer`.
- `itgames-api/src/modules/mail/mail.service.ts` — configurações, templates, envio, logs, reenvio, teste.
- `itgames-api/src/modules/mail/mail-notifier.service.ts` — destinatários e disparo dos 4 eventos do sistema.
- `itgames-api/src/modules/mail/mail.controller.ts` — rotas `/mail/*`.
- `itgames-api/src/modules/mail/dto/update-mail-settings.dto.ts`, `dto/update-mail-template.dto.ts`.
- `itgames-api/src/modules/auth/dto/forgot-password.dto.ts`, `dto/reset-password.dto.ts`.
- `itgames-api/src/common/utils/rate-limit.ts` — contador em memória.
- Testes: `test/mail-utils.e2e-spec.ts`, `test/mail-service.e2e-spec.ts`, `test/mail-admin.e2e-spec.ts`, `test/password-reset.e2e-spec.ts`, `test/mail-triggers.e2e-spec.ts`.

**API — modificar**
- `itgames-api/prisma/schema.prisma` — 4 models novos + relação em `User`.
- `itgames-api/src/app.module.ts` — importar `MailModule`.
- `itgames-api/src/modules/auth/auth.service.ts`, `auth.controller.ts` — forgot/reset.
- `itgames-api/src/modules/events/events.service.ts` — injeta `MailNotifier` e dispara.
- `itgames-api/test/helpers.ts` — fake de transporte, `configureMail`, `resetDb` com as tabelas novas.
- `itgames-api/package.json` — `nodemailer`, `@types/nodemailer`.

**Frontend — criar**
- `itgames-platform/src/components/admin/MailSettingsPanel.tsx` (container), `MailServerCard.tsx`, `MailTemplatesCard.tsx`, `MailLogsCard.tsx`.
- `itgames-platform/src/components/auth/ForgotPasswordModal.tsx`.
- `itgames-platform/src/app/redefinir-senha/page.tsx`.

**Frontend — modificar**
- `itgames-platform/src/lib/api-client.ts` — métodos de e-mail e senha.
- `itgames-platform/src/app/admin/page.tsx` — aba "E-mails".
- `itgames-platform/src/app/login/page.tsx` — link "Esqueci minha senha".

**Infra**
- `docker-compose.yml`, `docker-compose.portainer.yml`, `.env.example` — `MAIL_ENCRYPTION_KEY`.
- `docs/superpowers/specs/2026-10-06-configuracao-de-emails-design.md` — tweak (variável `nome` em todos os tipos; reenvio de `password_reset` não permitido).

---

### Task 1: Schema, criptografia e renderização de templates

**Files:**
- Modify: `itgames-api/prisma/schema.prisma` (relação em `User` + 4 models no fim)
- Modify: `itgames-api/package.json` (dependências)
- Create: `itgames-api/src/modules/mail/mail.crypto.ts`
- Create: `itgames-api/src/modules/mail/mail.templates.ts`
- Modify: `itgames-api/test/helpers.ts` (`resetDb`)
- Test: `itgames-api/test/mail-utils.e2e-spec.ts`

**Interfaces:**
- Produces:
  - `encryptSecret(plain: string): string`, `decryptSecret(payload: string): string | null`.
  - `MAIL_TYPES` (`readonly` tupla), `type MailType`, `isMailType(v: string): v is MailType`.
  - `interface TemplateDef { subject: string; body: string; variables: string[]; label: string }`, `DEFAULT_TEMPLATES: Record<MailType, TemplateDef>`, `SAMPLE_VARS: Record<MailType, Record<string,string>>`.
  - `renderText(template: string, vars: Record<string,string>): string` (sem escape), `renderHtml(template: string, vars: Record<string,string>): string` (escapa o template e os valores, `\n` → `<br>`), `escapeHtml(v: string): string`.
  - Modelos Prisma: `mailSettings`, `mailTemplate`, `emailLog`, `passwordResetToken`.

- [ ] **Step 1: Instalar a dependência**

```bash
cd D:/Projects/fitness/itgames/itgames-api && npm install nodemailer && npm install -D @types/nodemailer
```

Expected: `package.json` ganha `nodemailer` em `dependencies` e `@types/nodemailer` em `devDependencies`.

- [ ] **Step 2: Escrever o teste que falha**

Criar `itgames-api/test/mail-utils.e2e-spec.ts`:

```ts
import { decryptSecret, encryptSecret } from '../src/modules/mail/mail.crypto';
import {
  DEFAULT_TEMPLATES,
  escapeHtml,
  isMailType,
  MAIL_TYPES,
  renderHtml,
  renderText,
  SAMPLE_VARS,
} from '../src/modules/mail/mail.templates';

describe('Mail utils', () => {
  describe('criptografia', () => {
    it('cifra e decifra de volta; o texto cifrado não contém o original', () => {
      const enc = encryptSecret('senha-de-app-123');
      expect(enc).not.toContain('senha-de-app-123');
      expect(enc.split(':')).toHaveLength(3);
      expect(decryptSecret(enc)).toBe('senha-de-app-123');
    });

    it('duas cifragens do mesmo texto diferem (IV aleatório)', () => {
      expect(encryptSecret('x')).not.toBe(encryptSecret('x'));
    });

    it('chave trocada ou conteúdo adulterado devolve null, sem lançar', () => {
      const enc = encryptSecret('segredo');
      const old = process.env.JWT_SECRET;
      process.env.JWT_SECRET = 'outra-chave';
      try {
        expect(decryptSecret(enc)).toBeNull();
      } finally {
        process.env.JWT_SECRET = old;
      }
      expect(decryptSecret('lixo')).toBeNull();
      expect(decryptSecret('')).toBeNull();
    });

    it('MAIL_ENCRYPTION_KEY tem precedência sobre JWT_SECRET', () => {
      process.env.MAIL_ENCRYPTION_KEY = 'chave-propria';
      try {
        const enc = encryptSecret('abc');
        delete process.env.MAIL_ENCRYPTION_KEY;
        expect(decryptSecret(enc)).toBeNull(); // sem a chave própria, usa JWT_SECRET e falha
        process.env.MAIL_ENCRYPTION_KEY = 'chave-propria';
        expect(decryptSecret(enc)).toBe('abc');
      } finally {
        delete process.env.MAIL_ENCRYPTION_KEY;
      }
    });
  });

  describe('templates', () => {
    it('tem os 6 tipos, cada um com assunto, corpo e variáveis, e todo {{var}} do padrão está declarado', () => {
      expect([...MAIL_TYPES].sort()).toEqual(
        [
          'alert_game_status',
          'alert_new_registration',
          'alert_registration_cancelled',
          'password_reset',
          'payment_confirmed',
          'registration_confirmed',
        ].sort(),
      );
      for (const type of MAIL_TYPES) {
        const def = DEFAULT_TEMPLATES[type];
        expect(def.subject.length).toBeGreaterThan(0);
        expect(def.body.length).toBeGreaterThan(0);
        const used = [...(def.subject + def.body).matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((m) => m[1]);
        for (const v of used) expect(def.variables).toContain(v);
        for (const v of def.variables) expect(SAMPLE_VARS[type][v]).toBeDefined();
      }
    });

    it('isMailType só aceita os tipos conhecidos', () => {
      expect(isMailType('password_reset')).toBe(true);
      expect(isMailType('qualquer')).toBe(false);
      expect(isMailType('__proto__')).toBe(false);
    });

    it('renderText substitui variáveis (com espaços) e deixa vazio o que não existe', () => {
      expect(renderText('Olá, {{ nome }}! {{x}}', { nome: 'Ana' })).toBe('Olá, Ana! ');
    });

    it('renderHtml escapa variáveis e o próprio template e converte quebras de linha', () => {
      const html = renderHtml('Oi {{nome}}\n<b>x</b>', { nome: '<script>alert(1)</script>' });
      expect(html).toBe('Oi &lt;script&gt;alert(1)&lt;/script&gt;<br>&lt;b&gt;x&lt;/b&gt;');
      expect(escapeHtml(`&"'<>`)).toBe('&amp;&quot;&#39;&lt;&gt;');
    });

    it('um valor que contém {{outra}} não é reinterpretado', () => {
      expect(renderText('{{a}}', { a: '{{b}}', b: 'secreto' })).toBe('{{b}}');
    });
  });
});
```

- [ ] **Step 3: Rodar o teste e ver falhar**

Pré-requisito: Postgres de teste no ar (Task 8, Step 1). Run:

```bash
cd D:/Projects/fitness/itgames/itgames-api && npx jest --config ./test/jest-e2e.json --runInBand mail-utils
```

Expected: FAIL — `Cannot find module '../src/modules/mail/mail.crypto'`.

- [ ] **Step 4: Implementar `mail.crypto.ts`**

```ts
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

// Chave de 32 bytes: MAIL_ENCRYPTION_KEY, ou JWT_SECRET quando a primeira não existe
function key(): Buffer {
  return createHash('sha256')
    .update(process.env.MAIL_ENCRYPTION_KEY || process.env.JWT_SECRET || '')
    .digest();
}

// AES-256-GCM; formato "iv:tag:cipher" em base64
export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), enc].map((b) => b.toString('base64')).join(':');
}

// Devolve null (nunca lança) quando o conteúdo está corrompido ou a chave mudou
export function decryptSecret(payload: string): string | null {
  try {
    const [iv, tag, enc] = payload.split(':').map((p) => Buffer.from(p, 'base64'));
    if (!iv?.length || !tag?.length || !enc) return null;
    const decipher = createDecipheriv('aes-256-gcm', key(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}
```

- [ ] **Step 5: Implementar `mail.templates.ts`**

```ts
export const MAIL_TYPES = [
  'password_reset',
  'registration_confirmed',
  'payment_confirmed',
  'alert_new_registration',
  'alert_registration_cancelled',
  'alert_game_status',
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
```

- [ ] **Step 6: Models Prisma**

Em `itgames-api/prisma/schema.prisma`, no `model User { ... }` adicionar a relação logo após `athleteProfile AthleteProfile?`:

```prisma
  passwordResetTokens PasswordResetToken[]
```

E ao final do arquivo:

```prisma
// ─── E-mails ────────────────────────────────────────────────────────────────

// Linha única (id = 1): servidor SMTP. A senha é guardada criptografada.
model MailSettings {
  id          Int      @id @default(1)
  enabled     Boolean  @default(false)
  host        String   @default("smtp.gmail.com")
  port        Int      @default(587)
  secure      String   @default("starttls") // starttls | ssl
  username    String   @default("")
  passwordEnc String?
  fromName    String   @default("ITGames")
  fromAddress String   @default("")
  appBaseUrl  String   @default("")
  updatedAt   DateTime @updatedAt

  @@map("mail_settings")
}

// Só existe linha para templates editados; sem linha vale o padrão do código.
model MailTemplate {
  type      String   @id
  enabled   Boolean  @default(true)
  subject   String
  body      String
  updatedAt DateTime @updatedAt

  @@map("mail_templates")
}

model EmailLog {
  id        String   @id @default(uuid())
  type      String
  toAddress String
  subject   String
  status    String // sent | failed | skipped
  error     String?
  payload   Json? // variáveis usadas, para reenviar (nulo em password_reset e test)
  createdAt DateTime @default(now())

  @@index([createdAt])
  @@map("email_logs")
}

model PasswordResetToken {
  id        String    @id @default(uuid())
  userId    String
  tokenHash String    @unique
  expiresAt DateTime
  usedAt    DateTime?
  createdAt DateTime  @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@map("password_reset_tokens")
}
```

- [ ] **Step 7: `resetDb` limpa as tabelas novas**

Em `itgames-api/test/helpers.ts`, trocar o `TRUNCATE` (as tabelas novas de e-mail não dependem de `users`/`games`, então precisam entrar na lista; `password_reset_tokens` cai por cascata de `users`):

```ts
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE "users", "games", "mail_settings", "mail_templates", "email_logs" RESTART IDENTITY CASCADE',
  );
```

- [ ] **Step 8: Gerar o client e rodar o teste**

```bash
cd D:/Projects/fitness/itgames/itgames-api && npx prisma generate && npx jest --config ./test/jest-e2e.json --runInBand mail-utils
```

Expected: PASS (o `globalSetup` faz `db push` no banco de teste e cria as tabelas novas).

- [ ] **Step 9: Suíte inteira continua verde**

```bash
cd D:/Projects/fitness/itgames/itgames-api && npx jest --config ./test/jest-e2e.json --runInBand
```

Expected: todas as suítes PASS (nada existente depende das tabelas novas).

- [ ] **Step 10: Commit (somente se o usuário pedir)**

```bash
git add itgames-api/prisma/schema.prisma itgames-api/package.json itgames-api/package-lock.json itgames-api/src/modules/mail itgames-api/test/helpers.ts itgames-api/test/mail-utils.e2e-spec.ts
git commit -m "feat(mail): schema, secret encryption and template rendering"
```

---

### Task 2: `MailService` (envio, log, transporte injetável) e módulo

**Files:**
- Create: `itgames-api/src/modules/mail/mail.transport.ts`
- Create: `itgames-api/src/modules/mail/mail.service.ts`
- Create: `itgames-api/src/modules/mail/mail.module.ts`
- Modify: `itgames-api/src/app.module.ts` (importar `MailModule`)
- Modify: `itgames-api/test/helpers.ts` (fake de transporte, `configureMail`, `ctx.mail`, `ctx.idle`)
- Test: `itgames-api/test/mail-service.e2e-spec.ts`

**Interfaces:**
- Consumes (Task 1): `encryptSecret`, `decryptSecret`, `MailType`, `MAIL_TYPES`, `DEFAULT_TEMPLATES`, `SAMPLE_VARS`, `renderText`, `renderHtml`.
- Produces:
  - Token `MAIL_TRANSPORT_FACTORY`; `interface MailTransport { sendMail(o: { from: string; to: string; subject: string; text: string; html: string }): Promise<unknown> }`; `interface SmtpConfig { host: string; port: number; secure: 'starttls' | 'ssl'; user: string; pass: string }`; `type MailTransportFactory = (cfg: SmtpConfig) => MailTransport`; `nodemailerFactory: MailTransportFactory`.
  - `MailService`:
    - `getSettings(): Promise<SettingsRow>` (linha ou padrões), `isConfigured(s): boolean`.
    - `send(type: MailType | 'test', to: string, vars: Record<string,string>, opts?: { redact?: boolean; force?: boolean; subject?: string; body?: string }): Promise<{ status: 'sent' | 'failed' | 'skipped'; error?: string }>` — nunca lança.
    - `dispatch(type, to, vars, opts?): void` — `send` sem `await`, rastreado.
    - `track(p: Promise<unknown>): void` — registra uma promessa em segundo plano (nunca propaga erro).
    - `idle(): Promise<void>` — espera tudo que está rastreado.
    - `recordSkipped(type: string, to: string, reason: string): Promise<void>`.
    - `getTemplate(type: MailType): Promise<{ enabled: boolean; subject: string; body: string; custom: boolean }>`.
  - Em `test/helpers.ts`: `interface FakeMail { sent: SentMail[]; failWith: string | null }`, `TestCtx` ganha `mail: FakeMail` e `idle: () => Promise<void>`; `configureMail(ctx: TestCtx, over?: Partial<...>): Promise<void>`.

- [ ] **Step 1: Transporte (arquivo novo, sem teste próprio — coberto pelo teste do service)**

Criar `itgames-api/src/modules/mail/mail.transport.ts`:

```ts
import * as nodemailer from 'nodemailer';

export const MAIL_TRANSPORT_FACTORY = 'MAIL_TRANSPORT_FACTORY';

export interface SmtpConfig {
  host: string;
  port: number;
  secure: 'starttls' | 'ssl';
  user: string;
  pass: string;
}

export interface MailTransport {
  sendMail(options: { from: string; to: string; subject: string; text: string; html: string }): Promise<unknown>;
}

export type MailTransportFactory = (config: SmtpConfig) => MailTransport;

// Implementação real; os testes substituem este provider por um fake
export const nodemailerFactory: MailTransportFactory = (c) =>
  nodemailer.createTransport({
    host: c.host,
    port: c.port,
    secure: c.secure === 'ssl',
    requireTLS: c.secure === 'starttls',
    auth: { user: c.user, pass: c.pass },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });
```

- [ ] **Step 2: Fake de transporte e helpers de teste**

Em `itgames-api/test/helpers.ts`, substituir o cabeçalho (`TestCtx` e `createTestApp`) por:

```ts
import { encryptSecret } from '../src/modules/mail/mail.crypto';
import { MailService } from '../src/modules/mail/mail.service';
import { MAIL_TRANSPORT_FACTORY, MailTransportFactory } from '../src/modules/mail/mail.transport';

export interface SentMail {
  from: string;
  to: string;
  subject: string;
  text: string;
  html: string;
}

export interface FakeMail {
  sent: SentMail[];
  // quando preenchido, o próximo envio falha com esta mensagem
  failWith: string | null;
}

export interface TestCtx {
  app: INestApplication;
  prisma: PrismaService;
  mail: FakeMail;
  // espera os envios em segundo plano terminarem
  idle: () => Promise<void>;
}

export async function createTestApp(): Promise<TestCtx> {
  const mail: FakeMail = { sent: [], failWith: null };
  const factory: MailTransportFactory = () => ({
    sendMail: async (options) => {
      if (mail.failWith) throw new Error(mail.failWith);
      mail.sent.push(options);
      return {};
    },
  });

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(MAIL_TRANSPORT_FACTORY)
    .useValue(factory)
    .compile();
  const app = moduleRef.createNestApplication();
  configureApp(app);
  await app.init();
  return { app, prisma: app.get(PrismaService), mail, idle: () => app.get(MailService).idle() };
}

// Deixa o envio de e-mail pronto para uso nos testes (SMTP falso, senha criptografada)
export async function configureMail(
  ctx: TestCtx,
  over: Partial<{
    enabled: boolean;
    host: string;
    port: number;
    secure: string;
    username: string;
    password: string | null;
    fromName: string;
    fromAddress: string;
    appBaseUrl: string;
  }> = {},
): Promise<void> {
  const { password = 'senha-de-app', ...rest } = over;
  const data = {
    enabled: true,
    host: 'smtp.test',
    port: 587,
    secure: 'starttls',
    username: 'envio@itgames.test',
    fromName: 'ITGames',
    fromAddress: 'envio@itgames.test',
    appBaseUrl: 'http://localhost:3000',
    passwordEnc: password === null ? null : encryptSecret(password),
    ...rest,
  };
  await ctx.prisma.mailSettings.upsert({ where: { id: 1 }, update: data, create: { id: 1, ...data } });
}
```

(Remover as linhas antigas de `TestCtx`/`createTestApp`; manter `resetDb`, `createUser` etc. e os imports já existentes.)

- [ ] **Step 3: Escrever o teste do service que falha**

Criar `itgames-api/test/mail-service.e2e-spec.ts`:

```ts
import { MailService } from '../src/modules/mail/mail.service';
import { configureMail, createTestApp, resetDb, TestCtx } from './helpers';

describe('MailService (e2e)', () => {
  let ctx: TestCtx;
  let mail: MailService;
  const vars = { nome: 'Ana', campeonato: 'Summer', categoria: 'RX', equipe: 'Time A', numero: '#1101', valor: 'R$ 10,00' };

  beforeAll(async () => {
    ctx = await createTestApp();
    mail = ctx.app.get(MailService);
  });
  afterAll(async () => {
    await ctx.app.close();
  });
  beforeEach(async () => {
    await resetDb(ctx.prisma);
    ctx.mail.sent.length = 0;
    ctx.mail.failWith = null;
  });

  const logs = () => ctx.prisma.emailLog.findMany({ orderBy: { createdAt: 'asc' } });

  it('sem configuração, grava skipped e não chama o transporte', async () => {
    const r = await mail.send('registration_confirmed', 'ana@x.com', vars);
    expect(r.status).toBe('skipped');
    expect(ctx.mail.sent).toHaveLength(0);
    const [log] = await logs();
    expect(log).toMatchObject({ type: 'registration_confirmed', toAddress: 'ana@x.com', status: 'skipped' });
  });

  it('configurado, envia com remetente, destinatário e assunto renderizados e grava sent', async () => {
    await configureMail(ctx);
    const r = await mail.send('registration_confirmed', 'ana@x.com', vars);
    expect(r.status).toBe('sent');
    expect(ctx.mail.sent).toHaveLength(1);
    expect(ctx.mail.sent[0]).toMatchObject({
      from: '"ITGames" <envio@itgames.test>',
      to: 'ana@x.com',
      subject: 'Inscrição recebida — Summer',
    });
    expect(ctx.mail.sent[0].text).toContain('equipe Time A');
    expect((await logs())[0]).toMatchObject({ status: 'sent', error: null });
  });

  it('envio geral desligado grava skipped', async () => {
    await configureMail(ctx, { enabled: false });
    expect((await mail.send('payment_confirmed', 'ana@x.com', vars)).status).toBe('skipped');
    expect(ctx.mail.sent).toHaveLength(0);
  });

  it('tipo desligado grava skipped; template editado vale no envio', async () => {
    await configureMail(ctx);
    await ctx.prisma.mailTemplate.create({
      data: { type: 'payment_confirmed', enabled: false, subject: 'X', body: 'Y' },
    });
    expect((await mail.send('payment_confirmed', 'ana@x.com', vars)).status).toBe('skipped');

    await ctx.prisma.mailTemplate.update({
      where: { type: 'payment_confirmed' },
      data: { enabled: true, subject: 'Pago {{numero}}', body: 'Valeu, {{nome}}' },
    });
    await mail.send('payment_confirmed', 'ana@x.com', vars);
    expect(ctx.mail.sent[0]).toMatchObject({ subject: 'Pago #1101', text: 'Valeu, Ana' });
  });

  it('falha do transporte grava failed, não lança e não vaza a senha', async () => {
    await configureMail(ctx, { password: 'senha-super-secreta' });
    ctx.mail.failWith = 'auth falhou para senha-super-secreta';
    const r = await mail.send('payment_confirmed', 'ana@x.com', vars);
    expect(r.status).toBe('failed');
    const [log] = await logs();
    expect(log.status).toBe('failed');
    expect(log.error).toContain('auth falhou');
    expect(log.error).not.toContain('senha-super-secreta');
    expect(JSON.stringify(r)).not.toContain('senha-super-secreta');
  });

  it('senha ilegível (chave trocada) vira skipped com motivo, sem lançar', async () => {
    await configureMail(ctx);
    await ctx.prisma.mailSettings.update({ where: { id: 1 }, data: { passwordEnc: 'lixo:lixo:lixo' } });
    const r = await mail.send('payment_confirmed', 'ana@x.com', vars);
    expect(r.status).toBe('skipped');
    expect((await logs())[0].error).toMatch(/senha/i);
  });

  it('conteúdo malicioso: HTML escapado no corpo e quebra de linha removida do assunto', async () => {
    await configureMail(ctx);
    await mail.send('registration_confirmed', 'ana@x.com', {
      ...vars,
      equipe: '<script>alert(1)</script>',
      campeonato: 'Summer\r\nBcc: alguem@x.com',
    });
    const sent = ctx.mail.sent[0];
    expect(sent.html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(sent.html).not.toContain('<script>');
    expect(sent.subject).not.toMatch(/[\r\n]/);
  });

  it('dispatch roda em segundo plano e idle() espera terminar', async () => {
    await configureMail(ctx);
    mail.dispatch('payment_confirmed', 'ana@x.com', vars);
    await mail.idle();
    expect(ctx.mail.sent).toHaveLength(1);
  });

  it('opts.redact não grava as variáveis (payload nulo)', async () => {
    await configureMail(ctx);
    await mail.send('payment_confirmed', 'ana@x.com', vars, { redact: true });
    expect((await logs())[0].payload).toBeNull();
    await mail.send('payment_confirmed', 'ana@x.com', vars);
    expect((await logs())[1].payload).toMatchObject({ nome: 'Ana' });
  });
});
```

- [ ] **Step 4: Rodar e ver falhar**

```bash
cd D:/Projects/fitness/itgames/itgames-api && npx jest --config ./test/jest-e2e.json --runInBand mail-service
```

Expected: FAIL — módulo `mail.service` inexistente (e a app não sobe sem `MailModule`).

- [ ] **Step 5: Implementar `MailService`**

Criar `itgames-api/src/modules/mail/mail.service.ts`:

```ts
import { Inject, Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { decryptSecret } from './mail.crypto';
import { DEFAULT_TEMPLATES, MailType, renderHtml, renderText } from './mail.templates';
import { MAIL_TRANSPORT_FACTORY, MailTransportFactory } from './mail.transport';

export interface SettingsRow {
  enabled: boolean;
  host: string;
  port: number;
  secure: string;
  username: string;
  passwordEnc: string | null;
  fromName: string;
  fromAddress: string;
  appBaseUrl: string;
}

export const DEFAULT_SETTINGS: SettingsRow = {
  enabled: false,
  host: 'smtp.gmail.com',
  port: 587,
  secure: 'starttls',
  username: '',
  passwordEnc: null,
  fromName: 'ITGames',
  fromAddress: '',
  appBaseUrl: '',
};

export interface SendOptions {
  // não grava as variáveis no log (ex.: link de redefinição de senha)
  redact?: boolean;
  // ignora os interruptores (envio geral e do tipo); ainda exige configuração completa. Usado no "Testar envio"
  force?: boolean;
  // template fixo, para o tipo especial 'test'
  subject?: string;
  body?: string;
}

export interface SendResult {
  status: 'sent' | 'failed' | 'skipped';
  error?: string;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly pending = new Set<Promise<unknown>>();

  constructor(
    private readonly prisma: PrismaService,
    @Inject(MAIL_TRANSPORT_FACTORY) private readonly transportFactory: MailTransportFactory,
  ) {}

  // ── Configuração ──────────────────────────────────────────────────────────

  async getSettings(): Promise<SettingsRow> {
    const row = await this.prisma.mailSettings.findUnique({ where: { id: 1 } });
    return row ?? { ...DEFAULT_SETTINGS };
  }

  isConfigured(s: SettingsRow): boolean {
    return !!(s.host && s.port && s.username && s.passwordEnc && s.fromAddress);
  }

  async getTemplate(type: MailType) {
    const row = await this.prisma.mailTemplate.findUnique({ where: { type } });
    if (row) return { enabled: row.enabled, subject: row.subject, body: row.body, custom: true };
    const def = DEFAULT_TEMPLATES[type];
    return { enabled: true, subject: def.subject, body: def.body, custom: false };
  }

  // ── Rastreio de envios em segundo plano ──────────────────────────────────

  track(promise: Promise<unknown>): void {
    const safe = promise.catch((err) => this.logger.error(`Falha em tarefa de e-mail: ${err?.message ?? err}`));
    this.pending.add(safe);
    void safe.finally(() => this.pending.delete(safe));
  }

  async idle(): Promise<void> {
    while (this.pending.size > 0) {
      await Promise.all([...this.pending]);
    }
  }

  dispatch(type: MailType | 'test', to: string, vars: Record<string, string>, opts: SendOptions = {}): void {
    this.track(this.send(type, to, vars, opts));
  }

  // ── Envio ─────────────────────────────────────────────────────────────────

  async recordSkipped(type: string, to: string, reason: string): Promise<void> {
    await this.writeLog({ type, toAddress: to, subject: '', status: 'skipped', error: reason });
  }

  // Nunca lança: o resultado vai para o log e para o retorno
  async send(
    type: MailType | 'test',
    to: string,
    vars: Record<string, string>,
    opts: SendOptions = {},
  ): Promise<SendResult> {
    let subject = '';
    const payload = opts.redact || type === 'test' ? undefined : (vars as Prisma.InputJsonValue);
    try {
      const settings = await this.getSettings();
      const tpl =
        type === 'test'
          ? { enabled: true, subject: opts.subject ?? '', body: opts.body ?? '' }
          : await this.getTemplate(type);
      // assunto em uma linha só: bloqueia injeção de cabeçalhos por quebra de linha
      subject = renderText(tpl.subject, vars).replace(/[\r\n]+/g, ' ').trim();

      const base = { type, toAddress: to, subject, payload };
      if (!opts.force && (!settings.enabled || !tpl.enabled)) {
        return await this.finish({ ...base, status: 'skipped' });
      }
      if (!this.isConfigured(settings)) {
        return await this.finish({ ...base, status: 'skipped', error: 'Configuração de SMTP incompleta' });
      }
      const pass = settings.passwordEnc ? decryptSecret(settings.passwordEnc) : null;
      if (!pass) {
        return await this.finish({ ...base, status: 'skipped', error: 'Senha SMTP não definida ou ilegível' });
      }

      try {
        await this.transportFactory({
          host: settings.host,
          port: settings.port,
          secure: settings.secure === 'ssl' ? 'ssl' : 'starttls',
          user: settings.username,
          pass,
        }).sendMail({
          from: `"${settings.fromName.replace(/["\r\n]/g, '')}" <${settings.fromAddress}>`,
          to,
          subject,
          text: renderText(tpl.body, vars),
          html: renderHtml(tpl.body, vars),
        });
        return await this.finish({ ...base, status: 'sent' });
      } catch (err: any) {
        const message = String(err?.message ?? err).split(pass).join('***').slice(0, 500);
        return await this.finish({ ...base, status: 'failed', error: message });
      }
    } catch (err: any) {
      this.logger.error(`Erro inesperado ao enviar e-mail (${type}): ${err?.message ?? err}`);
      return { status: 'failed', error: 'Erro interno ao enviar e-mail' };
    }
  }

  private async finish(entry: {
    type: string;
    toAddress: string;
    subject: string;
    status: 'sent' | 'failed' | 'skipped';
    error?: string;
    payload?: Prisma.InputJsonValue;
  }): Promise<SendResult> {
    await this.writeLog(entry);
    return { status: entry.status, ...(entry.error ? { error: entry.error } : {}) };
  }

  private async writeLog(entry: {
    type: string;
    toAddress: string;
    subject: string;
    status: string;
    error?: string;
    payload?: Prisma.InputJsonValue;
  }): Promise<void> {
    try {
      await this.prisma.emailLog.create({
        data: {
          type: entry.type,
          toAddress: entry.toAddress,
          subject: entry.subject,
          status: entry.status,
          error: entry.error ?? null,
          ...(entry.payload !== undefined && { payload: entry.payload }),
        },
      });
    } catch (err: any) {
      this.logger.error(`Não foi possível gravar o log de e-mail: ${err?.message ?? err}`);
    }
  }
}
```

- [ ] **Step 6: Módulo global e registro**

Criar `itgames-api/src/modules/mail/mail.module.ts`:

```ts
import { Global, Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { MailService } from './mail.service';
import { MAIL_TRANSPORT_FACTORY, nodemailerFactory } from './mail.transport';

@Global()
@Module({
  imports: [PrismaModule],
  providers: [MailService, { provide: MAIL_TRANSPORT_FACTORY, useValue: nodemailerFactory }],
  exports: [MailService],
})
export class MailModule {}
```

Em `itgames-api/src/app.module.ts`: `import { MailModule } from './modules/mail/mail.module';` e adicionar `MailModule,` em `imports` (depois de `BackupModule`).

- [ ] **Step 7: Rodar o teste**

```bash
cd D:/Projects/fitness/itgames/itgames-api && npx jest --config ./test/jest-e2e.json --runInBand mail-service
```

Expected: PASS (8 testes).

- [ ] **Step 8: Suíte inteira**

```bash
cd D:/Projects/fitness/itgames/itgames-api && npx tsc --noEmit -p tsconfig.json && npx jest --config ./test/jest-e2e.json --runInBand
```

Expected: tsc sem erros, todas as suítes PASS (o helper novo não quebra os testes existentes).

- [ ] **Step 9: Commit (somente se o usuário pedir)**

```bash
git add itgames-api/src/modules/mail itgames-api/src/app.module.ts itgames-api/test/helpers.ts itgames-api/test/mail-service.e2e-spec.ts
git commit -m "feat(mail): MailService with encrypted SMTP settings, logging and injectable transport"
```

---

### Task 3: API de configuração (`/mail/*`)

**Files:**
- Create: `itgames-api/src/modules/mail/dto/update-mail-settings.dto.ts`
- Create: `itgames-api/src/modules/mail/dto/update-mail-template.dto.ts`
- Modify: `itgames-api/src/modules/mail/mail.service.ts` (métodos de admin)
- Create: `itgames-api/src/modules/mail/mail.controller.ts`
- Modify: `itgames-api/src/modules/mail/mail.module.ts` (registrar controller)
- Test: `itgames-api/test/mail-admin.e2e-spec.ts`

**Interfaces:**
- Consumes (Task 2): `MailService.getSettings/isConfigured/getTemplate/send`, `SettingsRow`, `DEFAULT_SETTINGS`; (Task 1) `encryptSecret`, `DEFAULT_TEMPLATES`, `SAMPLE_VARS`, `MAIL_TYPES`, `isMailType`, `renderText`, `renderHtml`.
- Produces (`MailService`):
  - `getPublicSettings(): Promise<PublicSettings>` (`SettingsRow` sem `passwordEnc`, com `passwordSet: boolean`).
  - `saveSettings(dto: UpdateMailSettingsDto): Promise<PublicSettings>`.
  - `sendTest(toEmail: string): Promise<{ ok: boolean; error?: string }>`.
  - `listTemplates()`, `saveTemplate(type, dto)`, `resetTemplate(type)`, `previewTemplate(type, draft?)`.
  - `listLogs(q: { status?: string; limit?: number })`, `resendLog(id: string)`.
- Endpoints: ver spec. Respostas: `GET /mail/templates` → `Array<{ type, label, variables, enabled, subject, body, custom, defaultSubject, defaultBody }>`; `POST /mail/templates/:type/preview` body `{ subject?, body? }` → `{ subject, html }`; `GET /mail/logs` → `EmailLog[]` (mais recentes primeiro); `POST /mail/logs/:id/resend` → `{ status, error? }`.

- [ ] **Step 1: Escrever o teste que falha**

Criar `itgames-api/test/mail-admin.e2e-spec.ts`:

```ts
import * as request from 'supertest';
import { bearer, configureMail, createTestApp, createUser, login, resetDb, TestCtx } from './helpers';

describe('Mail admin (e2e)', () => {
  let ctx: TestCtx;
  let tAdmin: string;
  let tOrg: string;
  let tAthlete: string;
  const http = () => request(ctx.app.getHttpServer());

  beforeAll(async () => {
    ctx = await createTestApp();
  });
  afterAll(async () => {
    await ctx.app.close();
  });
  beforeEach(async () => {
    await resetDb(ctx.prisma);
    ctx.mail.sent.length = 0;
    ctx.mail.failWith = null;
    await createUser(ctx.prisma, { email: 'admin@t.com', role: 'SUPER_ADMIN' });
    await createUser(ctx.prisma, { email: 'org@t.com', role: 'ORGANIZER' });
    await createUser(ctx.prisma, { email: 'atl@t.com', role: 'ATHLETE' });
    tAdmin = await login(ctx.app, 'admin@t.com');
    tOrg = await login(ctx.app, 'org@t.com');
    tAthlete = await login(ctx.app, 'atl@t.com');
  });

  const settingsBody = {
    enabled: true,
    host: 'smtp.gmail.com',
    port: 587,
    secure: 'starttls',
    username: 'envio@itgames.com.br',
    password: 'abcd efgh ijkl mnop',
    fromName: 'ITGames',
    fromAddress: 'envio@itgames.com.br',
    appBaseUrl: 'https://arena.itgames.com.br/',
  };

  describe('permissões', () => {
    const routes: Array<[string, string]> = [
      ['get', '/mail/settings'],
      ['put', '/mail/settings'],
      ['post', '/mail/settings/test'],
      ['get', '/mail/templates'],
      ['get', '/mail/logs'],
    ];
    it.each(routes)('%s %s: anônimo 401; atleta e organizador 403', async (method, path) => {
      await (http() as any)[method](path).expect(401);
      await (http() as any)[method](path).set(bearer(tAthlete)).expect(403);
      await (http() as any)[method](path).set(bearer(tOrg)).expect(403);
    });
  });

  describe('configurações', () => {
    it('sem nada salvo devolve os padrões e passwordSet false', async () => {
      const res = await http().get('/mail/settings').set(bearer(tAdmin)).expect(200);
      expect(res.body).toMatchObject({ enabled: false, host: 'smtp.gmail.com', port: 587, passwordSet: false });
    });

    it('PUT salva, criptografa a senha e nunca a devolve; normaliza appBaseUrl', async () => {
      const res = await http().put('/mail/settings').set(bearer(tAdmin)).send(settingsBody).expect(200);
      expect(res.body.passwordSet).toBe(true);
      expect(res.body.password).toBeUndefined();
      expect(res.body.passwordEnc).toBeUndefined();
      expect(res.body.appBaseUrl).toBe('https://arena.itgames.com.br');
      expect(JSON.stringify(res.body)).not.toContain('abcd efgh');

      const row = await ctx.prisma.mailSettings.findUnique({ where: { id: 1 } });
      expect(row.passwordEnc).toBeTruthy();
      expect(row.passwordEnc).not.toContain('abcd');

      const get = await http().get('/mail/settings').set(bearer(tAdmin)).expect(200);
      expect(JSON.stringify(get.body)).not.toContain('abcd efgh');
      expect(get.body.passwordSet).toBe(true);
    });

    it('PUT sem password (ou vazio) mantém a senha salva', async () => {
      await http().put('/mail/settings').set(bearer(tAdmin)).send(settingsBody).expect(200);
      const before = (await ctx.prisma.mailSettings.findUnique({ where: { id: 1 } })).passwordEnc;
      const { password, ...semSenha } = settingsBody;
      await http().put('/mail/settings').set(bearer(tAdmin)).send({ ...semSenha, port: 465, secure: 'ssl' }).expect(200);
      await http().put('/mail/settings').set(bearer(tAdmin)).send({ ...semSenha, password: '' }).expect(200);
      const after = await ctx.prisma.mailSettings.findUnique({ where: { id: 1 } });
      expect(after.passwordEnc).toBe(before);
    });

    it('enabled true com configuração incompleta retorna 400; desligado aceita parcial', async () => {
      const res = await http()
        .put('/mail/settings')
        .set(bearer(tAdmin))
        .send({ enabled: true, host: 'smtp.gmail.com' })
        .expect(400);
      expect(res.body.message).toMatch(/incompleta|obrigat/i);
      await http().put('/mail/settings').set(bearer(tAdmin)).send({ enabled: false, host: 'smtp.gmail.com' }).expect(200);
    });

    it('valida porta, segurança, e-mail do remetente e URL base', async () => {
      const put = (over: object) => http().put('/mail/settings').set(bearer(tAdmin)).send({ ...settingsBody, ...over });
      await put({ port: 0 }).expect(400);
      await put({ port: 70000 }).expect(400);
      await put({ secure: 'tls' }).expect(400);
      await put({ fromAddress: 'sem-arroba' }).expect(400);
      await put({ appBaseUrl: 'ftp://x.com' }).expect(400);
      await put({ appBaseUrl: 'javascript:alert(1)' }).expect(400);
      await put({ appBaseUrl: 'http://localhost:3000' }).expect(200);
    });
  });

  describe('testar envio', () => {
    it('sem configuração completa devolve ok false com o motivo', async () => {
      const res = await http().post('/mail/settings/test').set(bearer(tAdmin)).expect(200);
      expect(res.body.ok).toBe(false);
      expect(res.body.error).toMatch(/incompleta|senha/i);
    });

    it('envia ao e-mail do admin logado mesmo com o envio geral desligado', async () => {
      await configureMail(ctx, { enabled: false });
      const res = await http().post('/mail/settings/test').set(bearer(tAdmin)).expect(200);
      expect(res.body).toEqual({ ok: true });
      expect(ctx.mail.sent).toHaveLength(1);
      expect(ctx.mail.sent[0].to).toBe('admin@t.com');
    });

    it('devolve o erro real do SMTP quando falha', async () => {
      await configureMail(ctx);
      ctx.mail.failWith = 'Invalid login: 535 5.7.8 Username and Password not accepted';
      const res = await http().post('/mail/settings/test').set(bearer(tAdmin)).expect(200);
      expect(res.body.ok).toBe(false);
      expect(res.body.error).toContain('535');
    });
  });

  describe('templates', () => {
    it('lista os 6 tipos com padrão, variáveis e custom false', async () => {
      const res = await http().get('/mail/templates').set(bearer(tAdmin)).expect(200);
      expect(res.body).toHaveLength(6);
      const reset = res.body.find((t: any) => t.type === 'password_reset');
      expect(reset).toMatchObject({ enabled: true, custom: false });
      expect(reset.variables).toEqual(expect.arrayContaining(['nome', 'link', 'validade']));
      expect(reset.subject).toBe(reset.defaultSubject);
    });

    it('PUT edita, DELETE restaura o padrão; tipo desconhecido 404; corpo vazio 400', async () => {
      const put = await http()
        .put('/mail/templates/payment_confirmed')
        .set(bearer(tAdmin))
        .send({ enabled: false, subject: 'Pago!', body: 'Oi {{nome}}' })
        .expect(200);
      expect(put.body).toMatchObject({ custom: true, enabled: false, subject: 'Pago!' });

      await http().put('/mail/templates/nao_existe').set(bearer(tAdmin)).send({ subject: 'a', body: 'b' }).expect(404);
      await http().put('/mail/templates/payment_confirmed').set(bearer(tAdmin)).send({ subject: '', body: 'b' }).expect(400);
      await http().put('/mail/templates/payment_confirmed').set(bearer(tAdmin)).send({ subject: 'a', body: '' }).expect(400);

      const del = await http().delete('/mail/templates/payment_confirmed').set(bearer(tAdmin)).expect(200);
      expect(del.body).toMatchObject({ custom: false, enabled: true });
      expect(del.body.subject).toBe(del.body.defaultSubject);
    });

    it('preview renderiza com dados de exemplo e escapa HTML; aceita rascunho', async () => {
      const res = await http()
        .post('/mail/templates/payment_confirmed/preview')
        .set(bearer(tAdmin))
        .send({ subject: 'Olá {{nome}}', body: '<b>{{equipe}}</b>' })
        .expect(201);
      expect(res.body.subject).toBe('Olá Maria Souza');
      expect(res.body.html).toBe('&lt;b&gt;Dupla Dinâmica&lt;/b&gt;');
    });
  });

  describe('logs', () => {
    it('lista do mais recente ao mais antigo, filtra por status e respeita o limite', async () => {
      await ctx.prisma.emailLog.createMany({
        data: [
          { type: 'payment_confirmed', toAddress: 'a@x.com', subject: 's1', status: 'sent', createdAt: new Date('2026-01-01') },
          { type: 'payment_confirmed', toAddress: 'b@x.com', subject: 's2', status: 'failed', error: 'boom', createdAt: new Date('2026-01-02') },
          { type: 'payment_confirmed', toAddress: 'c@x.com', subject: 's3', status: 'sent', createdAt: new Date('2026-01-03') },
        ],
      });
      const all = await http().get('/mail/logs').set(bearer(tAdmin)).expect(200);
      expect(all.body.map((l: any) => l.toAddress)).toEqual(['c@x.com', 'b@x.com', 'a@x.com']);
      const failed = await http().get('/mail/logs?status=failed').set(bearer(tAdmin)).expect(200);
      expect(failed.body).toHaveLength(1);
      const limited = await http().get('/mail/logs?limit=2').set(bearer(tAdmin)).expect(200);
      expect(limited.body).toHaveLength(2);
    });

    it('reenviar usa o payload gravado e o template atual; sem payload retorna 400; inexistente 404', async () => {
      await configureMail(ctx);
      const log = await ctx.prisma.emailLog.create({
        data: {
          type: 'payment_confirmed',
          toAddress: 'ana@x.com',
          subject: 'x',
          status: 'failed',
          error: 'timeout',
          payload: { nome: 'Ana', campeonato: 'Summer', categoria: 'RX', equipe: 'Time A', numero: '#1101' },
        },
      });
      const res = await http().post(`/mail/logs/${log.id}/resend`).set(bearer(tAdmin)).expect(201);
      expect(res.body.status).toBe('sent');
      expect(ctx.mail.sent[0]).toMatchObject({ to: 'ana@x.com', subject: 'Pagamento confirmado — Summer' });

      const noPayload = await ctx.prisma.emailLog.create({
        data: { type: 'password_reset', toAddress: 'ana@x.com', subject: 'x', status: 'sent' },
      });
      const bad = await http().post(`/mail/logs/${noPayload.id}/resend`).set(bearer(tAdmin)).expect(400);
      expect(bad.body.message).toMatch(/reenviar/i);
      await http().post('/mail/logs/00000000-0000-0000-0000-000000000000/resend').set(bearer(tAdmin)).expect(404);
    });
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
cd D:/Projects/fitness/itgames/itgames-api && npx jest --config ./test/jest-e2e.json --runInBand mail-admin
```

Expected: FAIL — rotas `/mail/*` retornam 404.

- [ ] **Step 3: DTOs**

`itgames-api/src/modules/mail/dto/update-mail-settings.dto.ts`:

```ts
import { IsBoolean, IsEmail, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, ValidateIf } from 'class-validator';

export class UpdateMailSettingsDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  host?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(65535)
  port?: number;

  @IsOptional()
  @IsIn(['starttls', 'ssl'], { message: 'Segurança inválida. Use starttls ou ssl' })
  secure?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  username?: string;

  // Ausente ou vazio mantém a senha atual
  @IsOptional()
  @IsString()
  @MaxLength(255)
  password?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  fromName?: string;

  @ValidateIf((o) => o.fromAddress !== undefined && o.fromAddress !== '')
  @IsEmail({}, { message: 'E-mail do remetente inválido' })
  fromAddress?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  appBaseUrl?: string;
}
```

`itgames-api/src/modules/mail/dto/update-mail-template.dto.ts`:

```ts
import { IsBoolean, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateMailTemplateDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsString()
  @IsNotEmpty({ message: 'O assunto não pode ficar vazio' })
  @MaxLength(200)
  subject: string;

  @IsString()
  @IsNotEmpty({ message: 'O corpo não pode ficar vazio' })
  @MaxLength(5000)
  body: string;
}

export class PreviewMailTemplateDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  subject?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  body?: string;
}
```

- [ ] **Step 4: Métodos de admin no `MailService`**

Em `mail.service.ts` adicionar os imports (`BadRequestException`, `NotFoundException` de `@nestjs/common`; `encryptSecret` de `./mail.crypto`; `DEFAULT_TEMPLATES`, `isMailType`, `MAIL_TYPES`, `SAMPLE_VARS` de `./mail.templates`; os DTOs) e, dentro da classe, após `getTemplate`:

```ts
  // ── Administração (tela do super admin) ──────────────────────────────────

  private present(s: SettingsRow) {
    const { passwordEnc, ...rest } = s;
    return { ...rest, passwordSet: !!passwordEnc };
  }

  async getPublicSettings() {
    return this.present(await this.getSettings());
  }

  private normalizeBaseUrl(raw: string): string {
    const value = raw.trim();
    if (!value) return '';
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      throw new BadRequestException('URL base inválida. Use o formato https://seu-dominio.com.br');
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new BadRequestException('A URL base deve começar com http:// ou https://');
    }
    return `${url.origin}${url.pathname}`.replace(/\/+$/, '');
  }

  async saveSettings(dto: UpdateMailSettingsDto) {
    const current = await this.getSettings();
    const next: SettingsRow = {
      enabled: dto.enabled ?? current.enabled,
      host: dto.host?.trim() ?? current.host,
      port: dto.port ?? current.port,
      secure: dto.secure ?? current.secure,
      username: dto.username?.trim() ?? current.username,
      passwordEnc: dto.password ? encryptSecret(dto.password) : current.passwordEnc,
      fromName: dto.fromName?.trim() ?? current.fromName,
      fromAddress: dto.fromAddress?.trim() ?? current.fromAddress,
      appBaseUrl: dto.appBaseUrl !== undefined ? this.normalizeBaseUrl(dto.appBaseUrl) : current.appBaseUrl,
    };

    if (next.enabled && !this.isConfigured(next)) {
      throw new BadRequestException(
        'Configuração incompleta: informe servidor, porta, usuário, senha e e-mail do remetente antes de ativar o envio.',
      );
    }

    const row = await this.prisma.mailSettings.upsert({
      where: { id: 1 },
      update: next,
      create: { id: 1, ...next },
    });
    return this.present(row);
  }

  // "Testar envio": ignora os interruptores, mas exige configuração completa. Devolve o erro real do SMTP.
  async sendTest(toEmail: string): Promise<{ ok: boolean; error?: string }> {
    const result = await this.send('test', toEmail, {}, {
      force: true,
      redact: true,
      subject: 'Teste de envio — ITGames',
      body: 'Este é um e-mail de teste do ITGames.\n\nSe você recebeu esta mensagem, a configuração de envio está correta.',
    });
    return result.status === 'sent' ? { ok: true } : { ok: false, error: result.error ?? 'Envio não realizado' };
  }

  async listTemplates() {
    const rows = await this.prisma.mailTemplate.findMany();
    const byType = new Map(rows.map((r) => [r.type, r]));
    return MAIL_TYPES.map((type) => this.presentTemplate(type, byType.get(type)));
  }

  private presentTemplate(
    type: (typeof MAIL_TYPES)[number],
    row?: { enabled: boolean; subject: string; body: string } | null,
  ) {
    const def = DEFAULT_TEMPLATES[type];
    return {
      type,
      label: def.label,
      variables: def.variables,
      enabled: row ? row.enabled : true,
      subject: row ? row.subject : def.subject,
      body: row ? row.body : def.body,
      custom: !!row,
      defaultSubject: def.subject,
      defaultBody: def.body,
    };
  }

  private assertType(type: string): asserts type is (typeof MAIL_TYPES)[number] {
    if (!isMailType(type)) throw new NotFoundException('Tipo de e-mail não encontrado');
  }

  async saveTemplate(type: string, dto: UpdateMailTemplateDto) {
    this.assertType(type);
    const row = await this.prisma.mailTemplate.upsert({
      where: { type },
      update: { enabled: dto.enabled ?? true, subject: dto.subject, body: dto.body },
      create: { type, enabled: dto.enabled ?? true, subject: dto.subject, body: dto.body },
    });
    return this.presentTemplate(type, row);
  }

  async resetTemplate(type: string) {
    this.assertType(type);
    await this.prisma.mailTemplate.deleteMany({ where: { type } });
    return this.presentTemplate(type, null);
  }

  async previewTemplate(type: string, draft: { subject?: string; body?: string } = {}) {
    this.assertType(type);
    const current = await this.getTemplate(type);
    const vars = SAMPLE_VARS[type];
    return {
      subject: renderText(draft.subject ?? current.subject, vars).replace(/[\r\n]+/g, ' ').trim(),
      html: renderHtml(draft.body ?? current.body, vars),
    };
  }

  async listLogs(q: { status?: string; limit?: number }) {
    const limit = Math.min(Math.max(Number(q.limit) || 50, 1), 200);
    return this.prisma.emailLog.findMany({
      where: q.status ? { status: q.status } : {},
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  // Reenvia com as variáveis gravadas e o template atual. Sem payload (reset de senha, teste) não dá.
  async resendLog(id: string) {
    const log = await this.prisma.emailLog.findUnique({ where: { id } });
    if (!log) throw new NotFoundException('Registro de envio não encontrado');
    if (!log.payload || !isMailType(log.type)) {
      throw new BadRequestException('Este e-mail não pode ser reenviado (não guarda os dados do envio).');
    }
    return this.send(log.type, log.toAddress, log.payload as Record<string, string>);
  }
```

(Importar os tipos dos DTOs: `import { UpdateMailSettingsDto } from './dto/update-mail-settings.dto'; import { UpdateMailTemplateDto } from './dto/update-mail-template.dto';`)

- [ ] **Step 5: Controller**

Criar `itgames-api/src/modules/mail/mail.controller.ts`:

```ts
import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/role.enum';
import { AuthUser } from '../../common/types/auth-user';
import { PreviewMailTemplateDto, UpdateMailTemplateDto } from './dto/update-mail-template.dto';
import { UpdateMailSettingsDto } from './dto/update-mail-settings.dto';
import { MailService } from './mail.service';

@ApiTags('mail')
@ApiBearerAuth()
@Roles(UserRole.SUPER_ADMIN)
@Controller('mail')
export class MailController {
  constructor(private readonly mail: MailService) {}

  @Get('settings')
  @ApiOperation({ summary: 'Super Admin: configuração de envio (a senha nunca é devolvida)' })
  getSettings() {
    return this.mail.getPublicSettings();
  }

  @Put('settings')
  @ApiOperation({ summary: 'Super Admin: salvar configuração SMTP (senha ausente/vazia mantém a atual)' })
  saveSettings(@Body() dto: UpdateMailSettingsDto) {
    return this.mail.saveSettings(dto);
  }

  @Post('settings/test')
  @ApiOperation({ summary: 'Super Admin: enviar e-mail de teste para o próprio e-mail' })
  async test(@CurrentUser() user: AuthUser) {
    return this.mail.sendTest(user.email);
  }

  @Get('templates')
  @ApiOperation({ summary: 'Super Admin: tipos de e-mail com texto atual e padrão' })
  listTemplates() {
    return this.mail.listTemplates();
  }

  @Put('templates/:type')
  @ApiOperation({ summary: 'Super Admin: editar um tipo de e-mail' })
  saveTemplate(@Param('type') type: string, @Body() dto: UpdateMailTemplateDto) {
    return this.mail.saveTemplate(type, dto);
  }

  @Delete('templates/:type')
  @ApiOperation({ summary: 'Super Admin: restaurar o texto padrão de um tipo' })
  resetTemplate(@Param('type') type: string) {
    return this.mail.resetTemplate(type);
  }

  @Post('templates/:type/preview')
  @ApiOperation({ summary: 'Super Admin: prévia com dados de exemplo (aceita rascunho)' })
  preview(@Param('type') type: string, @Body() dto: PreviewMailTemplateDto) {
    return this.mail.previewTemplate(type, dto);
  }

  @Get('logs')
  @ApiOperation({ summary: 'Super Admin: histórico de envios' })
  listLogs(@Query('status') status?: string, @Query('limit') limit?: string) {
    return this.mail.listLogs({ status, limit: limit ? parseInt(limit, 10) : undefined });
  }

  @Post('logs/:id/resend')
  @ApiOperation({ summary: 'Super Admin: reenviar um e-mail do histórico' })
  resend(@Param('id') id: string) {
    return this.mail.resendLog(id);
  }
}
```

Em `mail.module.ts` adicionar `controllers: [MailController],` e o import do controller.

- [ ] **Step 6: Rodar o teste**

```bash
cd D:/Projects/fitness/itgames/itgames-api && npx jest --config ./test/jest-e2e.json --runInBand mail-admin
```

Expected: PASS. Ajustes comuns: `GET /mail/logs/…/resend` com id não-UUID dá erro de Prisma (500); o teste de 404 usa UUID válido. Se o `IsInt` rejeitar `port` string, o `ValidationPipe` já tem `transform: true`.

- [ ] **Step 7: Suíte inteira + tipos**

```bash
cd D:/Projects/fitness/itgames/itgames-api && npx tsc --noEmit -p tsconfig.json && npx jest --config ./test/jest-e2e.json --runInBand
```

Expected: tsc limpo, tudo PASS.

- [ ] **Step 8: Commit (somente se o usuário pedir)**

```bash
git add itgames-api/src/modules/mail itgames-api/test/mail-admin.e2e-spec.ts
git commit -m "feat(mail): super admin API for SMTP settings, templates and send log"
```

---

### Task 4: Recuperação de senha

**Files:**
- Create: `itgames-api/src/common/utils/rate-limit.ts`
- Create: `itgames-api/src/modules/auth/dto/forgot-password.dto.ts`
- Create: `itgames-api/src/modules/auth/dto/reset-password.dto.ts`
- Modify: `itgames-api/src/modules/auth/auth.service.ts` (injeta `MailService`; `forgotPassword`, `resetPassword`)
- Modify: `itgames-api/src/modules/auth/auth.controller.ts` (2 rotas públicas)
- Test: `itgames-api/test/password-reset.e2e-spec.ts`

**Interfaces:**
- Consumes (Task 2): `MailService.send/track/recordSkipped/getSettings`, `ctx.mail`, `ctx.idle`, `configureMail`.
- Produces:
  - `class RateLimiter { hit(key: string, max: number, windowMs: number): boolean; clear(): void }`.
  - `AuthService.forgotPassword(email: string, ip: string): { message: string }` (campo privado `resetLimiter: RateLimiter`), `AuthService.resetPassword(token: string, newPassword: string): Promise<{ message: string }>`.
  - Env `PASSWORD_RESET_MAX_PER_HOUR` (padrão 3), lida a cada chamada.
  - Rotas: `POST /auth/forgot-password` `{ email }` → 200 `{ message }`; `POST /auth/reset-password` `{ token, newPassword }` → 200 `{ message }` ou 400.

- [ ] **Step 1: Escrever o teste que falha**

Criar `itgames-api/test/password-reset.e2e-spec.ts`:

```ts
import { createHash } from 'crypto';
import * as request from 'supertest';
import { AuthService } from '../src/modules/auth/auth.service';
import { configureMail, createTestApp, createUser, DEFAULT_PASSWORD, resetDb, TestCtx } from './helpers';

describe('Recuperação de senha (e2e)', () => {
  let ctx: TestCtx;
  const http = () => request(ctx.app.getHttpServer());
  const MSG = 'Se o e-mail estiver cadastrado, você receberá as instruções para redefinir a senha.';

  const forgot = (email: string) => http().post('/auth/forgot-password').send({ email });
  const tokenFromMail = (): string => {
    const last = ctx.mail.sent[ctx.mail.sent.length - 1];
    const m = last.text.match(/token=([a-f0-9]+)/);
    return m![1];
  };

  beforeAll(async () => {
    ctx = await createTestApp();
    process.env.PASSWORD_RESET_MAX_PER_HOUR = '100';
  });
  afterAll(async () => {
    delete process.env.PASSWORD_RESET_MAX_PER_HOUR;
    await ctx.app.close();
  });
  beforeEach(async () => {
    await resetDb(ctx.prisma);
    (ctx.app.get(AuthService) as any).resetLimiter.clear();
    ctx.mail.sent.length = 0;
    ctx.mail.failWith = null;
    await configureMail(ctx);
    await createUser(ctx.prisma, { email: 'ana@t.com', role: 'ATHLETE', name: 'Ana Souza' });
  });

  it('e-mail existente e inexistente recebem a mesma resposta 200', async () => {
    const a = await forgot('ana@t.com').expect(200);
    const b = await forgot('nao-existe@t.com').expect(200);
    expect(a.body).toEqual({ message: MSG });
    expect(b.body).toEqual({ message: MSG });
    await ctx.idle();
    expect(ctx.mail.sent).toHaveLength(1);
    expect(ctx.mail.sent[0].to).toBe('ana@t.com');
  });

  it('o e-mail traz link com token, usa appBaseUrl e o assunto padrão; o log não guarda o link', async () => {
    await forgot('ANA@t.com ').expect(200);
    await ctx.idle();
    const mail = ctx.mail.sent[0];
    expect(mail.subject).toBe('Redefinição de senha — ITGames');
    expect(mail.text).toContain('Olá, Ana Souza!');
    expect(mail.text).toMatch(/http:\/\/localhost:3000\/redefinir-senha\?token=[a-f0-9]{64}/);
    const [log] = await ctx.prisma.emailLog.findMany({ where: { type: 'password_reset' } });
    expect(log.payload).toBeNull();
    expect(JSON.stringify(log)).not.toMatch(/[a-f0-9]{64}/);
  });

  it('o banco guarda só o hash do token', async () => {
    await forgot('ana@t.com').expect(200);
    await ctx.idle();
    const raw = tokenFromMail();
    const rows = await ctx.prisma.passwordResetToken.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0].tokenHash).toBe(createHash('sha256').update(raw).digest('hex'));
    expect(rows[0].tokenHash).not.toBe(raw);
    expect(rows[0].expiresAt.getTime()).toBeGreaterThan(Date.now() + 50 * 60 * 1000);
  });

  it('token válido troca a senha, permite login, zera mustChangePassword e só serve uma vez', async () => {
    await ctx.prisma.user.update({ where: { email: 'ana@t.com' }, data: { mustChangePassword: true } });
    await forgot('ana@t.com').expect(200);
    await ctx.idle();
    const token = tokenFromMail();

    await http().post('/auth/reset-password').send({ token, newPassword: 'NovaSenha@123' }).expect(200);
    await http().post('/auth/login').send({ email: 'ana@t.com', password: 'NovaSenha@123' }).expect(200);
    await http().post('/auth/login').send({ email: 'ana@t.com', password: DEFAULT_PASSWORD }).expect(401);
    const user = await ctx.prisma.user.findUnique({ where: { email: 'ana@t.com' } });
    expect(user.mustChangePassword).toBe(false);

    const again = await http().post('/auth/reset-password').send({ token, newPassword: 'OutraSenha@123' }).expect(400);
    expect(again.body.message).toMatch(/inválido ou expirado/i);
  });

  it('token inválido, vazio, adulterado ou expirado retorna 400 com a mesma mensagem', async () => {
    await forgot('ana@t.com').expect(200);
    await ctx.idle();
    const token = tokenFromMail();

    const msgs: string[] = [];
    for (const t of ['', 'abc', token.slice(0, -1) + (token.endsWith('0') ? '1' : '0')]) {
      const res = await http().post('/auth/reset-password').send({ token: t, newPassword: 'NovaSenha@123' }).expect(400);
      msgs.push(res.body.message);
    }
    await ctx.prisma.passwordResetToken.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });
    const expired = await http().post('/auth/reset-password').send({ token, newPassword: 'NovaSenha@123' }).expect(400);
    msgs.push(expired.body.message);
    expect(msgs.filter((m) => /inválido ou expirado/i.test(m))).toHaveLength(msgs.length);
  });

  it('senha curta retorna 400 e não consome o token', async () => {
    await forgot('ana@t.com').expect(200);
    await ctx.idle();
    const token = tokenFromMail();
    await http().post('/auth/reset-password').send({ token, newPassword: '1234567' }).expect(400);
    await http().post('/auth/reset-password').send({ token, newPassword: 'NovaSenha@123' }).expect(200);
  });

  it('usar um token invalida os outros pendentes do mesmo usuário', async () => {
    await forgot('ana@t.com').expect(200);
    await ctx.idle();
    const first = tokenFromMail();
    await forgot('ana@t.com').expect(200);
    await ctx.idle();
    const second = tokenFromMail();
    expect(second).not.toBe(first);

    await http().post('/auth/reset-password').send({ token: second, newPassword: 'NovaSenha@123' }).expect(200);
    await http().post('/auth/reset-password').send({ token: first, newPassword: 'OutraSenha@123' }).expect(400);
  });

  it('limite: a 4ª solicitação na hora responde 200 mas não envia', async () => {
    process.env.PASSWORD_RESET_MAX_PER_HOUR = '3';
    try {
      for (let i = 0; i < 4; i++) {
        const res = await forgot('ana@t.com').expect(200);
        expect(res.body).toEqual({ message: MSG });
      }
      await ctx.idle();
      expect(ctx.mail.sent).toHaveLength(3);
    } finally {
      process.env.PASSWORD_RESET_MAX_PER_HOUR = '100';
    }
  });

  it('envio desligado: responde 200, não envia e registra skipped sem criar token útil', async () => {
    await configureMail(ctx, { enabled: false });
    await forgot('ana@t.com').expect(200);
    await ctx.idle();
    expect(ctx.mail.sent).toHaveLength(0);
    const logs = await ctx.prisma.emailLog.findMany({ where: { type: 'password_reset' } });
    expect(logs.map((l) => l.status)).toEqual(['skipped']);
  });

  it('sem URL base configurada registra skipped e não cria token', async () => {
    await configureMail(ctx, { appBaseUrl: '' });
    await forgot('ana@t.com').expect(200);
    await ctx.idle();
    expect(ctx.mail.sent).toHaveLength(0);
    expect(await ctx.prisma.passwordResetToken.count()).toBe(0);
    const [log] = await ctx.prisma.emailLog.findMany({ where: { type: 'password_reset' } });
    expect(log).toMatchObject({ status: 'skipped' });
    expect(log.error).toMatch(/URL base/i);
  });

  it('falha de SMTP não afeta a resposta', async () => {
    ctx.mail.failWith = 'ECONNREFUSED';
    await forgot('ana@t.com').expect(200);
    await ctx.idle();
    const [log] = await ctx.prisma.emailLog.findMany({ where: { type: 'password_reset' } });
    expect(log.status).toBe('failed');
  });

  it('corpo sem e-mail ou com tipo errado retorna 400', async () => {
    await http().post('/auth/forgot-password').send({}).expect(400);
    await http().post('/auth/forgot-password').send({ email: 123 }).expect(400);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
cd D:/Projects/fitness/itgames/itgames-api && npx jest --config ./test/jest-e2e.json --runInBand password-reset
```

Expected: FAIL — rotas 404.

- [ ] **Step 3: `RateLimiter`**

Criar `itgames-api/src/common/utils/rate-limit.ts`:

```ts
// Contador em memória por chave, em janela deslizante. Reiniciar a API zera tudo (aceitável nesta versão).
export class RateLimiter {
  private readonly hits = new Map<string, number[]>();

  // Registra uma tentativa; devolve false quando passou do limite dentro da janela
  hit(key: string, max: number, windowMs: number): boolean {
    const now = Date.now();
    const recent = (this.hits.get(key) ?? []).filter((t) => now - t < windowMs);
    recent.push(now);
    this.hits.set(key, recent);
    return recent.length <= max;
  }

  clear(): void {
    this.hits.clear();
  }
}
```

- [ ] **Step 4: DTOs**

`itgames-api/src/modules/auth/dto/forgot-password.dto.ts`:

```ts
import { IsNotEmpty, IsString } from 'class-validator';

export class ForgotPasswordDto {
  @IsString()
  @IsNotEmpty()
  email: string;
}
```

`itgames-api/src/modules/auth/dto/reset-password.dto.ts`:

```ts
import { IsString, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @IsString()
  token: string;

  @IsString()
  @MinLength(8, { message: 'A nova senha deve ter no mínimo 8 caracteres' })
  newPassword: string;
}
```

- [ ] **Step 5: `AuthService`**

Em `auth.service.ts` adicionar imports: `createHash, randomBytes` de `crypto`; `MailService` de `../../modules/mail/mail.service`  (caminho: `'../mail/mail.service'`); `RateLimiter` de `'../../common/utils/rate-limit'`. Alterar o construtor e acrescentar os métodos:

```ts
  private readonly resetLimiter = new RateLimiter();

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly mail: MailService,
  ) {}
```

(manter o resto da classe) e, antes de `buildAuthResponse`:

```ts
  private static readonly RESET_MESSAGE =
    'Se o e-mail estiver cadastrado, você receberá as instruções para redefinir a senha.';

  // Resposta idêntica exista a conta ou não; o trabalho real roda em segundo plano
  forgotPassword(email: string, ip: string): { message: string } {
    const normalized = (email || '').toLowerCase().trim();
    const max = Number(process.env.PASSWORD_RESET_MAX_PER_HOUR) || 3;
    const hour = 60 * 60 * 1000;
    const okEmail = this.resetLimiter.hit(`e:${normalized}`, max, hour);
    const okIp = this.resetLimiter.hit(`i:${ip}`, max, hour);
    if (normalized && okEmail && okIp) {
      this.mail.track(this.sendResetEmail(normalized));
    }
    return { message: AuthService.RESET_MESSAGE };
  }

  private async sendResetEmail(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) return;

    const { appBaseUrl } = await this.mail.getSettings();
    if (!appBaseUrl) {
      await this.mail.recordSkipped('password_reset', user.email, 'URL base do sistema não configurada');
      return;
    }

    const token = randomBytes(32).toString('hex');
    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: createHash('sha256').update(token).digest('hex'),
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });
    await this.mail.send(
      'password_reset',
      user.email,
      { nome: user.name, link: `${appBaseUrl}/redefinir-senha?token=${token}`, validade: '1 hora' },
      { redact: true },
    );
  }

  async resetPassword(token: string, newPassword: string) {
    const row = token
      ? await this.prisma.passwordResetToken.findUnique({
          where: { tokenHash: createHash('sha256').update(token).digest('hex') },
        })
      : null;
    if (!row || row.usedAt || row.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException('Link inválido ou expirado. Solicite uma nova recuperação de senha.');
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: row.userId }, data: { passwordHash, mustChangePassword: false } }),
      this.prisma.passwordResetToken.updateMany({
        where: { userId: row.userId, usedAt: null },
        data: { usedAt: new Date() },
      }),
    ]);
    return { message: 'Senha redefinida. Faça login com a nova senha.' };
  }
```

- [ ] **Step 6: Rotas públicas**

Em `auth.controller.ts`: importar `Req` de `@nestjs/common`, `Request` de `express`, e os dois DTOs. Adicionar após `login`:

```ts
  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Pedir o link de redefinição de senha (resposta idêntica exista a conta ou não)' })
  forgotPassword(@Body() dto: ForgotPasswordDto, @Req() req: Request) {
    return this.authService.forgotPassword(dto.email, req.ip ?? '');
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Definir a nova senha com o token recebido por e-mail' })
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto.token, dto.newPassword);
  }
```

- [ ] **Step 7: Rodar o teste**

```bash
cd D:/Projects/fitness/itgames/itgames-api && npx jest --config ./test/jest-e2e.json --runInBand password-reset
```

Expected: PASS (11 testes).

- [ ] **Step 8: Suíte inteira + tipos**

```bash
cd D:/Projects/fitness/itgames/itgames-api && npx tsc --noEmit -p tsconfig.json && npx jest --config ./test/jest-e2e.json --runInBand
```

Expected: tsc limpo e tudo PASS (`AuthModule` recebe `MailService` do `MailModule` global).

- [ ] **Step 9: Commit (somente se o usuário pedir)**

```bash
git add itgames-api/src/common/utils/rate-limit.ts itgames-api/src/modules/auth itgames-api/test/password-reset.e2e-spec.ts
git commit -m "feat(auth): password recovery by e-mail with single-use hashed tokens"
```

---

### Task 5: Gatilhos de e-mail (inscrição, pagamento, cancelamento, status do campeonato)

**Files:**
- Create: `itgames-api/src/modules/mail/mail-notifier.service.ts`
- Modify: `itgames-api/src/modules/mail/mail.module.ts` (provider/export `MailNotifier`)
- Modify: `itgames-api/src/modules/events/events.service.ts` (injeta `MailNotifier`; 3 chamadas)
- Test: `itgames-api/test/mail-triggers.e2e-spec.ts`

**Interfaces:**
- Consumes (Task 2): `MailService.dispatch/track`. 
- Produces (`MailNotifier`, todos fire-and-forget que nunca lançam):
  - `registrationCreated(gameCode: string, registrationCode: number): void`
  - `paymentConfirmed(gameCode: string, registrationCode: number): void`
  - `registrationCancelled(gameCode: string, registrationCode: number): void`
  - `gameStatusChanged(gameCode: string, status: string): void` (só `live` e `blocked` enviam)
- `EventsService` passa a receber `MailNotifier` no construtor.

- [ ] **Step 1: Escrever o teste que falha**

Criar `itgames-api/test/mail-triggers.e2e-spec.ts`:

```ts
import * as request from 'supertest';
import {
  bearer,
  configureMail,
  CPF_A,
  CPF_B,
  createCategoryFixture,
  createGameFixture,
  createTestApp,
  createUser,
  login,
  resetDb,
  TestCtx,
} from './helpers';

describe('Gatilhos de e-mail (e2e)', () => {
  let ctx: TestCtx;
  let orgA: { id: string };
  let orgB: { id: string };
  let tAdmin: string;
  let tOrgA: string;
  let tCaptain: string;
  const http = () => request(ctx.app.getHttpServer());

  const recipients = () => ctx.mail.sent.map((m) => m.to).sort();
  const subjects = () => ctx.mail.sent.map((m) => m.subject);

  // dupla masculina: capitão (CPF_A) + parceiro (CPF_B)
  const registerPair = async (extra: object = {}) => {
    const res = await http()
      .post('/events/G1/registrations')
      .set(bearer(tCaptain))
      .send({ categoryId: 2, teamName: 'Dupla Teste', athletes: [{ cpf: CPF_A }, { cpf: CPF_B }], ...extra });
    await ctx.idle();
    return res;
  };

  beforeAll(async () => {
    ctx = await createTestApp();
  });
  afterAll(async () => {
    await ctx.app.close();
  });
  beforeEach(async () => {
    await resetDb(ctx.prisma);
    ctx.mail.sent.length = 0;
    ctx.mail.failWith = null;
    await configureMail(ctx);

    await createUser(ctx.prisma, { email: 'admin@t.com', role: 'SUPER_ADMIN' });
    orgA = await createUser(ctx.prisma, { email: 'orga@t.com', role: 'ORGANIZER', name: 'Org A' });
    orgB = await createUser(ctx.prisma, { email: 'orgb@t.com', role: 'ORGANIZER', name: 'Org B' });
    await createUser(ctx.prisma, { email: 'cap@t.com', role: 'ATHLETE', cpf: CPF_A, name: 'Capitão Teste' });
    await createUser(ctx.prisma, { email: 'par@t.com', role: 'ATHLETE', cpf: CPF_B, name: 'Parceiro Teste' });
    tAdmin = await login(ctx.app, 'admin@t.com');
    tOrgA = await login(ctx.app, 'orga@t.com');
    tCaptain = await login(ctx.app, 'cap@t.com');

    await createGameFixture(ctx.prisma, 'G1', { status: 'live', organizerIds: [orgA.id, orgB.id] });
    await createCategoryFixture(ctx.prisma, 'G1', 1);
    await createCategoryFixture(ctx.prisma, 'G1', 2);
    await ctx.prisma.category.update({
      where: { code_gamesId: { code: 2, gamesId: 'G1' } },
      data: { maxAthlete: 2, teamType: 'pair', amount: 150 },
    });
    // organizador B suspenso neste campeonato
    await ctx.prisma.gameOrganizer.update({
      where: { gameCode_userId: { gameCode: 'G1', userId: orgB.id } },
      data: { active: false },
    });
  });

  describe('inscrição', () => {
    it('confirma ao capitão e ao parceiro e avisa só o organizador ativo', async () => {
      const res = await registerPair();
      expect(res.status).toBe(201);
      expect(recipients()).toEqual(['cap@t.com', 'orga@t.com', 'par@t.com']);

      const toCaptain = ctx.mail.sent.find((m) => m.to === 'cap@t.com')!;
      expect(toCaptain.subject).toBe('Inscrição recebida — Campeonato G1');
      expect(toCaptain.text).toContain('Olá, Capitão Teste!');
      expect(toCaptain.text).toContain('Dupla Teste');
      expect(toCaptain.text).toContain(res.body.registration.number);
      expect(toCaptain.text).toMatch(/R\$\s?150,00/);

      const toOrg = ctx.mail.sent.find((m) => m.to === 'orga@t.com')!;
      expect(toOrg.subject).toBe('Nova inscrição em Campeonato G1');
      expect(toOrg.text).toContain('Capitão Teste, Parceiro Teste');
      expect(recipients()).not.toContain('orgb@t.com'); // suspenso não recebe
    });

    it('SMTP fora do ar: a inscrição continua 201 e o log mostra failed', async () => {
      ctx.mail.failWith = 'ECONNREFUSED';
      const res = await registerPair();
      expect(res.status).toBe(201);
      const logs = await ctx.prisma.emailLog.findMany();
      expect(logs).toHaveLength(3);
      expect(logs.every((l) => l.status === 'failed')).toBe(true);
    });

    it('envio desligado: a inscrição continua 201 e tudo vira skipped', async () => {
      await configureMail(ctx, { enabled: false });
      const res = await registerPair();
      expect(res.status).toBe(201);
      expect(ctx.mail.sent).toHaveLength(0);
      const logs = await ctx.prisma.emailLog.findMany();
      expect(logs.every((l) => l.status === 'skipped')).toBe(true);
    });

    it('inscrição recusada (400) não envia nenhum e-mail', async () => {
      const res = await http()
        .post('/events/G1/registrations')
        .set(bearer(tCaptain))
        .send({ categoryId: 2, teamName: 'X', athletes: [{ cpf: CPF_A }] });
      await ctx.idle();
      expect(res.status).toBe(400);
      expect(ctx.mail.sent).toHaveLength(0);
    });

    it('nome de equipe com HTML sai escapado no e-mail', async () => {
      await registerPair({ teamName: '<img src=x onerror=alert(1)>' });
      const html = ctx.mail.sent.map((m) => m.html).join('\n');
      expect(html).not.toContain('<img');
      expect(html).toContain('&lt;img');
    });
  });

  describe('pagamento e cancelamento', () => {
    const patch = (code: number, body: object, token = tOrgA) =>
      http().patch(`/events/G1/registrations/${code}/status`).set(bearer(token)).send(body);

    it('pagamento confirmado avisa os integrantes uma única vez, só quando o status muda', async () => {
      const code = (await registerPair()).body.registration.code;
      ctx.mail.sent.length = 0;

      await patch(code, { status: 'paid' }).expect(200);
      await ctx.idle();
      expect(recipients()).toEqual(['cap@t.com', 'par@t.com']);
      expect(subjects()[0]).toBe('Pagamento confirmado — Campeonato G1');

      await patch(code, { status: 'paid' }).expect(200);
      await patch(code, { check: true }).expect(200);
      await ctx.idle();
      expect(ctx.mail.sent).toHaveLength(2);
    });

    it('cancelamento avisa integrantes e organizadores ativos, uma única vez', async () => {
      const code = (await registerPair()).body.registration.code;
      ctx.mail.sent.length = 0;

      await patch(code, { status: 'cancelled' }).expect(200);
      await ctx.idle();
      expect(recipients()).toEqual(['cap@t.com', 'orga@t.com', 'par@t.com']);
      expect(subjects().every((s) => s === 'Inscrição cancelada — Campeonato G1')).toBe(true);

      await patch(code, { status: 'cancelled' }).expect(200);
      await ctx.idle();
      expect(ctx.mail.sent).toHaveLength(3);
    });

    it('mudar só o valor ou o check não envia nada', async () => {
      const code = (await registerPair()).body.registration.code;
      ctx.mail.sent.length = 0;
      await patch(code, { amount: 99 }).expect(200);
      await patch(code, { check: true }).expect(200);
      await ctx.idle();
      expect(ctx.mail.sent).toHaveLength(0);
    });
  });

  describe('status do campeonato', () => {
    const setStatus = (status: string) => http().patch('/events/G1/status').set(bearer(tAdmin)).send({ status });

    it('bloquear e liberar avisam só os organizadores ativos', async () => {
      await setStatus('blocked').expect(200);
      await ctx.idle();
      expect(recipients()).toEqual(['orga@t.com']);
      expect(ctx.mail.sent[0].subject).toBe('Campeonato G1 foi bloqueado');

      ctx.mail.sent.length = 0;
      await setStatus('live').expect(200);
      await ctx.idle();
      expect(ctx.mail.sent[0].subject).toBe('Campeonato G1 foi liberado');
    });

    it('draft e repetir o mesmo status não enviam', async () => {
      await setStatus('draft').expect(200);
      await setStatus('live').expect(200); // já estava live? não: foi para draft antes, então este envia
      await ctx.idle();
      ctx.mail.sent.length = 0;
      await setStatus('live').expect(200); // repetição
      await ctx.idle();
      expect(ctx.mail.sent).toHaveLength(0);
    });

    it('template desligado de um alerta não envia', async () => {
      await ctx.prisma.mailTemplate.create({
        data: { type: 'alert_game_status', enabled: false, subject: 'x', body: 'y' },
      });
      await setStatus('blocked').expect(200);
      await ctx.idle();
      expect(ctx.mail.sent).toHaveLength(0);
    });
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
cd D:/Projects/fitness/itgames/itgames-api && npx jest --config ./test/jest-e2e.json --runInBand mail-triggers
```

Expected: FAIL — nenhum e-mail enviado (`recipients()` vazio).

- [ ] **Step 3: Implementar `MailNotifier`**

Criar `itgames-api/src/modules/mail/mail-notifier.service.ts`:

```ts
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { MailService } from './mail.service';
import { MailType } from './mail.templates';

interface Recipient {
  email: string;
  name: string;
}

const brl = (value: number | null | undefined) =>
  `R$ ${(value ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Resolve destinatários e dispara os e-mails do sistema. Tudo em segundo plano e sem lançar.
@Injectable()
export class MailNotifier {
  private readonly logger = new Logger(MailNotifier.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  registrationCreated(gameCode: string, registrationCode: number): void {
    this.mail.track(
      this.safely('registrationCreated', async () => {
        const ctx = await this.loadRegistration(gameCode, registrationCode);
        if (!ctx) return;
        await this.fanOut('registration_confirmed', ctx.members, ctx.vars);
        await this.fanOut('alert_new_registration', await this.activeOrganizers(gameCode), ctx.vars);
      }),
    );
  }

  paymentConfirmed(gameCode: string, registrationCode: number): void {
    this.mail.track(
      this.safely('paymentConfirmed', async () => {
        const ctx = await this.loadRegistration(gameCode, registrationCode);
        if (!ctx) return;
        await this.fanOut('payment_confirmed', ctx.members, ctx.vars);
      }),
    );
  }

  registrationCancelled(gameCode: string, registrationCode: number): void {
    this.mail.track(
      this.safely('registrationCancelled', async () => {
        const ctx = await this.loadRegistration(gameCode, registrationCode);
        if (!ctx) return;
        const recipients = [...ctx.members, ...(await this.activeOrganizers(gameCode))];
        await this.fanOut('alert_registration_cancelled', recipients, ctx.vars);
      }),
    );
  }

  // Só liberar (live) e bloquear (blocked) geram alerta
  gameStatusChanged(gameCode: string, status: string): void {
    const label = status === 'live' ? 'liberado' : status === 'blocked' ? 'bloqueado' : null;
    if (!label) return;
    this.mail.track(
      this.safely('gameStatusChanged', async () => {
        const game = await this.prisma.game.findUnique({ where: { code: gameCode }, select: { name: true } });
        if (!game) return;
        await this.fanOut('alert_game_status', await this.activeOrganizers(gameCode), {
          campeonato: game.name,
          status: label,
        });
      }),
    );
  }

  // ── internos ──────────────────────────────────────────────────────────────

  private async safely(name: string, fn: () => Promise<void>): Promise<void> {
    try {
      await fn();
    } catch (err: any) {
      this.logger.error(`Falha ao preparar e-mails (${name}): ${err?.message ?? err}`);
    }
  }

  // Um e-mail por destinatário (sem repetir o mesmo endereço), cada um com o seu {{nome}}
  private async fanOut(type: MailType, recipients: Recipient[], vars: Record<string, string>): Promise<void> {
    const seen = new Set<string>();
    for (const r of recipients) {
      const key = r.email.toLowerCase();
      if (!r.email || seen.has(key)) continue;
      seen.add(key);
      await this.mail.send(type, r.email, { ...vars, nome: r.name });
    }
  }

  private async activeOrganizers(gameCode: string): Promise<Recipient[]> {
    const links = await this.prisma.gameOrganizer.findMany({
      where: { gameCode, active: true },
      select: { user: { select: { email: true, name: true } } },
    });
    return links.map((l) => l.user);
  }

  private async loadRegistration(gameCode: string, registrationCode: number) {
    const reg = await this.prisma.registration.findUnique({
      where: { code_gameCode: { code: registrationCode, gameCode } },
      include: { athletes: true, category: true, game: { select: { name: true } } },
    });
    if (!reg) return null;

    // os integrantes são identificados pelo CPF; o e-mail vem do cadastro de cada um
    const cpfs = reg.athletes.map((a) => a.cpf).filter((c): c is string => !!c);
    const users = cpfs.length
      ? await this.prisma.user.findMany({ where: { cpf: { in: cpfs } }, select: { email: true, name: true } })
      : [];

    return {
      members: users,
      vars: {
        campeonato: reg.game.name,
        categoria: reg.category.name,
        equipe: reg.team,
        numero: reg.number ?? `#${reg.code}`,
        valor: brl(reg.amount),
        integrantes: reg.athletes.map((a) => a.name).join(', '),
      },
    };
  }
}
```

- [ ] **Step 4: Registrar no módulo**

`mail.module.ts`: `providers: [MailService, MailNotifier, {...}]`, `exports: [MailService, MailNotifier]`, e `import { MailNotifier } from './mail-notifier.service';`.

- [ ] **Step 5: Ligar nos serviços de eventos**

Em `events.service.ts`: `import { MailNotifier } from '../mail/mail-notifier.service';` e o construtor:

```ts
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: GameAccessService,
    private readonly notifier: MailNotifier,
  ) {}
```

a) `registerTeam`: logo depois do `const registration = await this.prisma.registration.create({...});` e antes do `return`:

```ts
    this.notifier.registrationCreated(dto.gameCode, uniqueCode);
```

b) `updateRegistrationStatus`: trocar `return this.prisma.$transaction(async (tx) => {` por `const result = await this.prisma.$transaction(async (tx) => {` e, após o fechamento da transação (`});`), acrescentar:

```ts

    // e-mails só quando o status realmente muda (repetir a mesma ação não reenvia)
    if (cancelling) {
      this.notifier.registrationCancelled(gameCode, registrationCode);
    } else if (dto.status === 'paid' && existing.status !== 'paid') {
      this.notifier.paymentConfirmed(gameCode, registrationCode);
    }
    return result;
```

c) `updateGameStatus`: substituir o `return this.prisma.game.update({...})` por:

```ts
    const updated = await this.prisma.game.update({
      where: { code },
      data: { status },
    });
    if (existing.status !== status) this.notifier.gameStatusChanged(code, status);
    return updated;
```

(Conferir o corpo atual de `updateGameStatus` — termina em `data: { status }, });` — e preservar qualquer `include`/`select` que ele tenha.)

- [ ] **Step 6: Rodar o teste**

```bash
cd D:/Projects/fitness/itgames/itgames-api && npx jest --config ./test/jest-e2e.json --runInBand mail-triggers
```

Expected: PASS. Observação: no teste "draft e repetir…", o primeiro `setStatus('draft')` parte de `live` (muda) e o `setStatus('live')` seguinte muda de novo; só a repetição final não envia.

- [ ] **Step 7: Suíte inteira + tipos**

```bash
cd D:/Projects/fitness/itgames/itgames-api && npx tsc --noEmit -p tsconfig.json && npx jest --config ./test/jest-e2e.json --runInBand
```

Expected: tsc limpo, tudo PASS. Os testes antigos de inscrição passam porque, sem SMTP configurado, os envios viram `skipped`.

- [ ] **Step 8: Commit (somente se o usuário pedir)**

```bash
git add itgames-api/src/modules/mail itgames-api/src/modules/events/events.service.ts itgames-api/test/mail-triggers.e2e-spec.ts
git commit -m "feat(mail): registration, payment, cancellation and game status e-mails"
```

---

### Task 6: Frontend — aba "E-mails" no admin

**Files:**
- Modify: `itgames-platform/src/lib/api-client.ts` (tipos + métodos)
- Create: `itgames-platform/src/components/admin/MailServerCard.tsx`
- Create: `itgames-platform/src/components/admin/MailTemplatesCard.tsx`
- Create: `itgames-platform/src/components/admin/MailLogsCard.tsx`
- Create: `itgames-platform/src/components/admin/MailSettingsPanel.tsx`
- Modify: `itgames-platform/src/app/admin/page.tsx` (aba)

**Interfaces:**
- Consumes (Task 3): endpoints `/mail/*`.
- Produces (`api-client`): tipos `MailSettings`, `MailTemplateInfo`, `MailLogEntry`; métodos `getMailSettings()`, `saveMailSettings(data)`, `testMailSettings()`, `listMailTemplates()`, `saveMailTemplate(type, data)`, `resetMailTemplate(type)`, `previewMailTemplate(type, draft)`, `listMailLogs(status?)`, `resendMailLog(id)`, `forgotPassword(email)`, `resetPassword(token, newPassword)`.

> O frontend não tem suíte de testes automatizados (só `lint`/`tsc`). A verificação desta task é `tsc` + `lint` + conferência manual guiada no Step 8.

- [ ] **Step 1: Tipos e métodos no `api-client`**

Em `itgames-platform/src/lib/api-client.ts`, após a interface `OrganizerUser`, adicionar:

```ts
export interface MailSettings {
  enabled: boolean;
  host: string;
  port: number;
  secure: 'starttls' | 'ssl';
  username: string;
  fromName: string;
  fromAddress: string;
  appBaseUrl: string;
  passwordSet: boolean;
}

export interface MailTemplateInfo {
  type: string;
  label: string;
  variables: string[];
  enabled: boolean;
  subject: string;
  body: string;
  custom: boolean;
  defaultSubject: string;
  defaultBody: string;
}

export interface MailLogEntry {
  id: string;
  type: string;
  toAddress: string;
  subject: string;
  status: 'sent' | 'failed' | 'skipped';
  error: string | null;
  createdAt: string;
}
```

E dentro da classe `ApiClient`, logo após `changePassword` (ou junto aos métodos de auth):

```ts
  // Recuperação de senha (público)
  async forgotPassword(email: string): Promise<{ message: string }> {
    return this.strict('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }, false);
  }

  async resetPassword(token: string, newPassword: string): Promise<{ message: string }> {
    return this.strict(
      '/auth/reset-password',
      { method: 'POST', body: JSON.stringify({ token, newPassword }) },
      false,
    );
  }

  // E-mails (super admin)
  async getMailSettings(): Promise<MailSettings> {
    return this.strict<MailSettings>('/mail/settings');
  }

  async saveMailSettings(data: Partial<MailSettings> & { password?: string }): Promise<MailSettings> {
    return this.strict<MailSettings>('/mail/settings', { method: 'PUT', body: JSON.stringify(data) });
  }

  async testMailSettings(): Promise<{ ok: boolean; error?: string }> {
    return this.strict('/mail/settings/test', { method: 'POST' });
  }

  async listMailTemplates(): Promise<MailTemplateInfo[]> {
    return this.strict<MailTemplateInfo[]>('/mail/templates');
  }

  async saveMailTemplate(
    type: string,
    data: { enabled: boolean; subject: string; body: string },
  ): Promise<MailTemplateInfo> {
    return this.strict<MailTemplateInfo>(`/mail/templates/${type}`, { method: 'PUT', body: JSON.stringify(data) });
  }

  async resetMailTemplate(type: string): Promise<MailTemplateInfo> {
    return this.strict<MailTemplateInfo>(`/mail/templates/${type}`, { method: 'DELETE' });
  }

  async previewMailTemplate(
    type: string,
    draft: { subject: string; body: string },
  ): Promise<{ subject: string; html: string }> {
    return this.strict(`/mail/templates/${type}/preview`, { method: 'POST', body: JSON.stringify(draft) });
  }

  async listMailLogs(status?: string): Promise<MailLogEntry[]> {
    return this.strict<MailLogEntry[]>(`/mail/logs${status ? `?status=${status}` : ''}`);
  }

  async resendMailLog(id: string): Promise<{ status: string; error?: string }> {
    return this.strict(`/mail/logs/${id}/resend`, { method: 'POST' });
  }
```

- [ ] **Step 2: `MailServerCard.tsx`**

```tsx
'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Send } from 'lucide-react';
import { toast } from 'sonner';
import { apiClient, ApiError, MailSettings } from '@/lib/api-client';

const inputClass =
  'w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-700 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500';

interface Props {
  onSaved: () => void;
}

export function MailServerCard({ onSaved }: Props) {
  const [form, setForm] = useState<MailSettings | null>(null);
  const [password, setPassword] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; error?: string } | null>(null);

  const load = useCallback(async () => {
    try {
      setForm(await apiClient.getMailSettings());
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Falha ao carregar a configuração de e-mail');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (!form) {
    return <div className="glass-panel rounded-3xl p-6 border border-zinc-800 text-xs text-zinc-500">Carregando...</div>;
  }

  const set = <K extends keyof MailSettings>(key: K, value: MailSettings[K]) => setForm({ ...form, [key]: value });

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const saved = await apiClient.saveMailSettings({
        enabled: form.enabled,
        host: form.host,
        port: Number(form.port),
        secure: form.secure,
        username: form.username,
        fromName: form.fromName,
        fromAddress: form.fromAddress,
        appBaseUrl: form.appBaseUrl,
        ...(password ? { password } : {}),
      });
      setForm(saved);
      setPassword('');
      toast.success('Configuração de e-mail salva');
      onSaved();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Falha ao salvar a configuração');
    } finally {
      setIsSaving(false);
    }
  };

  const handleTest = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const result = await apiClient.testMailSettings();
      setTestResult(result);
      if (result.ok) toast.success('E-mail de teste enviado para o seu endereço');
      onSaved();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Falha ao testar o envio');
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <form onSubmit={handleSave} className="glass-panel rounded-3xl p-6 border border-zinc-800 space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-base font-bold text-white">Servidor de envio (SMTP)</h3>
          <p className="text-xs text-zinc-400 mt-1 max-w-xl">
            Google Workspace: servidor <strong>smtp.gmail.com</strong>, porta <strong>587</strong> (STARTTLS) ou{' '}
            <strong>465</strong> (SSL), usuário e <strong>senha de app</strong> (exige verificação em duas etapas). O
            remetente deve ser a própria conta ou um alias dela.
          </p>
        </div>
        <label className="flex items-center gap-2 text-xs font-bold text-zinc-300 shrink-0">
          <input type="checkbox" checked={form.enabled} onChange={(e) => set('enabled', e.target.checked)} />
          Envio de e-mails ativo
        </label>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
        <div className="sm:col-span-2">
          <label className="font-bold text-zinc-300 block mb-1">Servidor</label>
          <input className={inputClass} value={form.host} onChange={(e) => set('host', e.target.value)} />
        </div>
        <div>
          <label className="font-bold text-zinc-300 block mb-1">Porta</label>
          <input
            className={inputClass}
            type="number"
            value={form.port}
            onChange={(e) => set('port', Number(e.target.value))}
          />
        </div>
        <div>
          <label className="font-bold text-zinc-300 block mb-1">Segurança</label>
          <select
            className={inputClass}
            value={form.secure}
            onChange={(e) => set('secure', e.target.value as 'starttls' | 'ssl')}
          >
            <option value="starttls">STARTTLS (587)</option>
            <option value="ssl">SSL (465)</option>
          </select>
        </div>
        <div>
          <label className="font-bold text-zinc-300 block mb-1">Usuário</label>
          <input
            className={inputClass}
            value={form.username}
            placeholder="envio@seudominio.com.br"
            onChange={(e) => set('username', e.target.value)}
          />
        </div>
        <div>
          <label className="font-bold text-zinc-300 block mb-1">Senha de app</label>
          <input
            className={inputClass}
            type="password"
            autoComplete="new-password"
            value={password}
            placeholder={form.passwordSet ? '•••••••• (definida — deixe vazio para manter)' : 'Cole a senha de app'}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <div>
          <label className="font-bold text-zinc-300 block mb-1">Nome do remetente</label>
          <input className={inputClass} value={form.fromName} onChange={(e) => set('fromName', e.target.value)} />
        </div>
        <div>
          <label className="font-bold text-zinc-300 block mb-1">E-mail do remetente</label>
          <input
            className={inputClass}
            type="email"
            value={form.fromAddress}
            placeholder="envio@seudominio.com.br"
            onChange={(e) => set('fromAddress', e.target.value)}
          />
        </div>
        <div className="sm:col-span-2">
          <label className="font-bold text-zinc-300 block mb-1">URL do sistema (usada nos links dos e-mails)</label>
          <input
            className={inputClass}
            value={form.appBaseUrl}
            placeholder="https://arena.seudominio.com.br"
            onChange={(e) => set('appBaseUrl', e.target.value)}
          />
        </div>
      </div>

      {testResult && (
        <div
          className={`p-3 rounded-xl text-xs border ${
            testResult.ok
              ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300'
              : 'bg-red-500/10 border-red-500/40 text-red-300'
          }`}
        >
          {testResult.ok ? 'Teste enviado com sucesso.' : `Falha no teste: ${testResult.error}`}
        </div>
      )}

      <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-800">
        <button
          type="button"
          onClick={handleTest}
          disabled={isTesting}
          className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold flex items-center gap-1.5 disabled:opacity-50"
          title="Salve antes de testar: o teste usa a configuração salva"
        >
          <Send className="w-3.5 h-3.5" />
          {isTesting ? 'Enviando...' : 'Testar envio'}
        </button>
        <button
          type="submit"
          disabled={isSaving}
          className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-black font-black text-xs disabled:opacity-50"
        >
          {isSaving ? 'Salvando...' : 'Salvar'}
        </button>
      </div>
    </form>
  );
}
```

- [ ] **Step 3: `MailTemplatesCard.tsx`**

```tsx
'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { apiClient, ApiError, MailTemplateInfo } from '@/lib/api-client';

const inputClass =
  'w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-700 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500';

function TemplateEditor({ tpl, onChanged }: { tpl: MailTemplateInfo; onChanged: () => void }) {
  const [enabled, setEnabled] = useState(tpl.enabled);
  const [subject, setSubject] = useState(tpl.subject);
  const [body, setBody] = useState(tpl.body);
  const [preview, setPreview] = useState<{ subject: string; html: string } | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const run = async (fn: () => Promise<void>, errorMessage: string) => {
    setIsBusy(true);
    try {
      await fn();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : errorMessage);
    } finally {
      setIsBusy(false);
    }
  };

  const save = () =>
    run(async () => {
      await apiClient.saveMailTemplate(tpl.type, { enabled, subject, body });
      toast.success('Texto salvo');
      onChanged();
    }, 'Falha ao salvar o texto');

  const restore = () =>
    run(async () => {
      const def = await apiClient.resetMailTemplate(tpl.type);
      setEnabled(def.enabled);
      setSubject(def.subject);
      setBody(def.body);
      setPreview(null);
      toast.success('Texto padrão restaurado');
      onChanged();
    }, 'Falha ao restaurar o texto padrão');

  const showPreview = () =>
    run(async () => setPreview(await apiClient.previewMailTemplate(tpl.type, { subject, body })), 'Falha ao gerar a prévia');

  return (
    <div className="p-4 rounded-2xl bg-zinc-950/80 border border-zinc-800 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h4 className="text-sm font-bold text-white">{tpl.label}</h4>
          {tpl.custom && (
            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-purple-500/20 text-purple-300">
              Editado
            </span>
          )}
        </div>
        <label className="flex items-center gap-2 text-xs font-bold text-zinc-300">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          Enviar este e-mail
        </label>
      </div>

      <div>
        <label className="text-[11px] font-bold text-zinc-400 block mb-1">Assunto</label>
        <input className={inputClass} value={subject} onChange={(e) => setSubject(e.target.value)} />
      </div>
      <div>
        <label className="text-[11px] font-bold text-zinc-400 block mb-1">Mensagem</label>
        <textarea className={`${inputClass} font-mono min-h-[140px]`} value={body} onChange={(e) => setBody(e.target.value)} />
      </div>
      <p className="text-[11px] text-zinc-500">
        Variáveis disponíveis:{' '}
        {tpl.variables.map((v) => (
          <code key={v} className="mr-1.5 px-1 py-0.5 rounded bg-zinc-800 text-amber-300">{`{{${v}}}`}</code>
        ))}
      </p>

      {preview && (
        <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800 text-xs space-y-1">
          <div className="text-zinc-400">
            Assunto: <strong className="text-white">{preview.subject}</strong>
          </div>
          {/* o HTML da prévia já vem escapado pela API (só <br> é marcação) */}
          <div className="text-zinc-200" dangerouslySetInnerHTML={{ __html: preview.html }} />
        </div>
      )}

      <div className="flex items-center justify-end gap-2">
        {tpl.custom && (
          <button
            type="button"
            onClick={restore}
            disabled={isBusy}
            className="px-3 py-2 rounded-xl text-xs font-semibold text-zinc-400 hover:text-white"
          >
            Restaurar padrão
          </button>
        )}
        <button
          type="button"
          onClick={showPreview}
          disabled={isBusy}
          className="px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold"
        >
          Prévia
        </button>
        <button
          type="button"
          onClick={save}
          disabled={isBusy}
          className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-black font-black text-xs disabled:opacity-50"
        >
          Salvar
        </button>
      </div>
    </div>
  );
}

export function MailTemplatesCard() {
  const [templates, setTemplates] = useState<MailTemplateInfo[] | null>(null);

  const load = useCallback(async () => {
    try {
      setTemplates(await apiClient.listMailTemplates());
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Falha ao carregar os tipos de e-mail');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="glass-panel rounded-3xl p-6 border border-zinc-800 space-y-4">
      <h3 className="text-base font-bold text-white">Tipos de e-mail</h3>
      {!templates && <div className="text-xs text-zinc-500">Carregando...</div>}
      {templates?.map((tpl) => (
        // a key inclui custom/updated para remontar o editor depois de salvar/restaurar
        <TemplateEditor key={`${tpl.type}-${tpl.custom}-${tpl.subject.length}-${tpl.body.length}`} tpl={tpl} onChanged={load} />
      ))}
    </div>
  );
}
```

- [ ] **Step 4: `MailLogsCard.tsx`**

```tsx
'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { apiClient, ApiError, MailLogEntry } from '@/lib/api-client';

const STATUS_STYLE: Record<string, string> = {
  sent: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  failed: 'bg-red-500/15 text-red-300 border-red-500/30',
  skipped: 'bg-zinc-700/40 text-zinc-300 border-zinc-600',
};
const STATUS_LABEL: Record<string, string> = { sent: 'Enviado', failed: 'Falhou', skipped: 'Ignorado' };

interface Props {
  // muda quando algo foi salvo/testado, para recarregar a lista
  refreshKey: number;
}

export function MailLogsCard({ refreshKey }: Props) {
  const [logs, setLogs] = useState<MailLogEntry[]>([]);
  const [filter, setFilter] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setLogs(await apiClient.listMailLogs(filter || undefined));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Falha ao carregar o histórico');
    } finally {
      setIsLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const resend = async (id: string) => {
    try {
      const res = await apiClient.resendMailLog(id);
      if (res.status === 'sent') toast.success('E-mail reenviado');
      else toast.error(`Não foi possível reenviar: ${res.error ?? res.status}`);
      load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Falha ao reenviar');
    }
  };

  return (
    <div className="glass-panel rounded-3xl p-6 border border-zinc-800 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-base font-bold text-white">Histórico de envios</h3>
        <div className="flex items-center gap-2">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="bg-zinc-950 border border-zinc-700 text-xs text-white rounded-xl px-3 py-2"
          >
            <option value="">Todos</option>
            <option value="failed">Falharam</option>
            <option value="sent">Enviados</option>
            <option value="skipped">Ignorados</option>
          </select>
          <button onClick={load} className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300" title="Atualizar">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs text-left">
          <thead className="text-zinc-500 uppercase text-[10px]">
            <tr>
              <th className="py-2 pr-3">Data</th>
              <th className="py-2 pr-3">Tipo</th>
              <th className="py-2 pr-3">Destinatário</th>
              <th className="py-2 pr-3">Status</th>
              <th className="py-2" />
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={5} className="py-3 text-zinc-500">Carregando...</td>
              </tr>
            )}
            {!isLoading && logs.length === 0 && (
              <tr>
                <td colSpan={5} className="py-3 text-zinc-500">Nenhum envio registrado.</td>
              </tr>
            )}
            {logs.map((l) => (
              <tr key={l.id} className="border-t border-zinc-800 align-top">
                <td className="py-2 pr-3 text-zinc-400 whitespace-nowrap">{new Date(l.createdAt).toLocaleString('pt-BR')}</td>
                <td className="py-2 pr-3 text-zinc-200">{l.type}</td>
                <td className="py-2 pr-3 text-zinc-300 font-mono">{l.toAddress}</td>
                <td className="py-2 pr-3">
                  <span className={`px-2 py-0.5 rounded border text-[10px] font-bold ${STATUS_STYLE[l.status] ?? ''}`}>
                    {STATUS_LABEL[l.status] ?? l.status}
                  </span>
                  {l.error && <div className="text-[11px] text-red-300 mt-1 max-w-xs break-words">{l.error}</div>}
                </td>
                <td className="py-2 text-right">
                  {l.status !== 'sent' && (
                    <button
                      onClick={() => resend(l.id)}
                      className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[11px] font-bold"
                    >
                      Reenviar
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: `MailSettingsPanel.tsx`**

```tsx
'use client';

import React, { useState } from 'react';
import { MailLogsCard } from './MailLogsCard';
import { MailServerCard } from './MailServerCard';
import { MailTemplatesCard } from './MailTemplatesCard';

// Aba "E-mails" do admin (só super admin): servidor, tipos de e-mail e histórico
export function MailSettingsPanel() {
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="space-y-6">
      <MailServerCard onSaved={() => setRefreshKey((k) => k + 1)} />
      <MailTemplatesCard />
      <MailLogsCard refreshKey={refreshKey} />
    </div>
  );
}
```

- [ ] **Step 6: Aba no `admin/page.tsx`**

a) import (junto ao de `OrganizersPanel`): `import { MailSettingsPanel } from '@/components/admin/MailSettingsPanel';` (usar o mesmo estilo de import dos vizinhos).

b) tipo do estado (linha ~71): acrescentar `| 'email'` ao union de `adminTab`.

c) guarda de papel (linha ~144): `if (userRole !== 'SUPER_ADMIN' && (adminTab === 'organizers_mgmt' || adminTab === 'saas_owner' || adminTab === 'email'))`.

d) botão: dentro do bloco `{userRole === 'SUPER_ADMIN' && (<> ... </>)}`, depois do botão "Organizadores":

```tsx
              <button
                onClick={() => setAdminTab('email')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                  adminTab === 'email'
                    ? 'bg-amber-500 text-black shadow-md shadow-amber-500/20'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                E-mails
              </button>
```

e) conteúdo: depois da linha `{adminTab === 'organizers_mgmt' && userRole === 'SUPER_ADMIN' && <OrganizersPanel />}`:

```tsx
      {adminTab === 'email' && userRole === 'SUPER_ADMIN' && <MailSettingsPanel />}
```

- [ ] **Step 7: Tipos e lint**

```bash
cd D:/Projects/fitness/itgames/itgames-platform && npx tsc --noEmit && npx eslint src/components/admin/Mail*.tsx src/lib/api-client.ts src/app/admin/page.tsx
```

Expected: `tsc` sem erros; eslint sem **novos** erros (anotar avisos pré-existentes do `admin/page.tsx`).

- [ ] **Step 8: Verificação manual (stack local)**

```bash
cd D:/Projects/fitness/itgames && docker compose up -d --build api frontend
```

No navegador (http://localhost:3000/admin), logado como super admin: abrir a aba **E-mails**; salvar uma configuração incompleta com "ativo" marcado → ver o erro de configuração incompleta; salvar completa (qualquer SMTP, ex.: `smtp.gmail.com` com dados falsos) → "Testar envio" mostra o **erro real** do servidor e o histórico ganha uma linha `Falhou`; editar um texto → Prévia → Salvar → "Editado" → Restaurar padrão. Como organizador/atleta, a aba não aparece e `GET /mail/settings` retorna 403.

- [ ] **Step 9: Commit (somente se o usuário pedir)**

```bash
git add itgames-platform/src/lib/api-client.ts itgames-platform/src/components/admin itgames-platform/src/app/admin/page.tsx
git commit -m "feat(admin): e-mail settings tab with server, templates and send history"
```

---

### Task 7: Frontend — "Esqueci minha senha" e redefinição

**Files:**
- Create: `itgames-platform/src/components/auth/ForgotPasswordModal.tsx`
- Create: `itgames-platform/src/app/redefinir-senha/page.tsx`
- Modify: `itgames-platform/src/app/login/page.tsx` (link + modal)

**Interfaces:**
- Consumes (Task 6): `apiClient.forgotPassword(email)`, `apiClient.resetPassword(token, newPassword)`.

- [ ] **Step 1: `ForgotPasswordModal.tsx`**

```tsx
'use client';

import React, { useState } from 'react';
import { Mail, X } from 'lucide-react';
import { toast } from 'sonner';
import { apiClient, ApiError } from '@/lib/api-client';

interface Props {
  initialEmail?: string;
  onClose: () => void;
}

export function ForgotPasswordModal({ initialEmail = '', onClose }: Props) {
  const [email, setEmail] = useState(initialEmail);
  const [isSending, setIsSending] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      toast.error('Informe o seu e-mail');
      return;
    }
    setIsSending(true);
    try {
      await apiClient.forgotPassword(email.trim());
      setSent(true);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Não foi possível enviar o pedido. Tente novamente.');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-zinc-900 border border-zinc-700 rounded-3xl p-6 space-y-4 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-black text-white">Esqueci minha senha</h3>
            <p className="text-xs text-zinc-400">Enviaremos um link para você criar uma nova senha.</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        {sent ? (
          <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/40 text-sm text-emerald-300">
            Se o e-mail estiver cadastrado, você receberá as instruções em instantes. Confira também a caixa de spam.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="relative">
              <Mail className="w-4 h-4 text-zinc-500 absolute left-3 top-3" />
              <input
                type="email"
                required
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu.email@exemplo.com"
                className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-zinc-950 border border-zinc-700 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500"
              />
            </div>
            <button
              type="submit"
              disabled={isSending}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-black font-black text-xs disabled:opacity-50"
            >
              {isSending ? 'Enviando...' : 'Enviar link de redefinição'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Página `/redefinir-senha`**

Criar `itgames-platform/src/app/redefinir-senha/page.tsx`:

```tsx
'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { KeyRound, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { apiClient, ApiError } from '@/lib/api-client';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [done, setDone] = useState(false);

  // o token vem na URL (?token=...); lido no cliente, como na tela de login
  useEffect(() => {
    setToken(new URLSearchParams(window.location.search).get('token') || '');
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      toast.error('A nova senha deve ter no mínimo 8 caracteres');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('A confirmação não confere com a nova senha');
      return;
    }
    setIsLoading(true);
    try {
      await apiClient.resetPassword(token || '', newPassword);
      setDone(true);
      toast.success('Senha redefinida! Faça login com a nova senha.');
      setTimeout(() => router.push('/login'), 2500);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Não foi possível redefinir a senha');
    } finally {
      setIsLoading(false);
    }
  };

  const inputClass =
    'w-full pl-9 pr-3 py-2.5 rounded-xl bg-zinc-950 border border-zinc-700 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500';

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md space-y-5 p-8 rounded-3xl bg-zinc-900 border border-zinc-800 shadow-2xl">
        <div className="space-y-1 text-center">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center">
            <KeyRound className="w-7 h-7" />
          </div>
          <h1 className="text-xl font-black text-white">Redefinir senha</h1>
          <p className="text-xs text-zinc-400">Escolha uma nova senha com no mínimo 8 caracteres.</p>
        </div>

        {token === null ? null : !token ? (
          <div className="space-y-3 text-center">
            <p className="text-sm text-red-300">Link inválido. Peça um novo link na tela de login.</p>
            <Link href="/login" className="text-xs font-bold text-amber-400 underline">
              Ir para o login
            </Link>
          </div>
        ) : done ? (
          <p className="text-sm text-emerald-300 text-center">Senha redefinida. Redirecionando para o login...</p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="relative">
              <Lock className="w-4 h-4 text-zinc-500 absolute left-3 top-3" />
              <input
                type="password"
                required
                autoComplete="new-password"
                placeholder="Nova senha"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className={inputClass}
              />
            </div>
            <div className="relative">
              <Lock className="w-4 h-4 text-zinc-500 absolute left-3 top-3" />
              <input
                type="password"
                required
                autoComplete="new-password"
                placeholder="Confirmar nova senha"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={inputClass}
              />
            </div>
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-black font-black text-xs disabled:opacity-50"
            >
              {isLoading ? 'Salvando...' : 'Redefinir senha'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Link e modal no login**

Em `itgames-platform/src/app/login/page.tsx`:

a) import: `import { ForgotPasswordModal } from '@/components/auth/ForgotPasswordModal';`

b) estado, junto aos de login: `const [showForgot, setShowForgot] = useState(false);`

c) no formulário de login, logo abaixo do campo de senha (dentro do `div className="space-y-3"` do login, após o bloco da senha), adicionar:

```tsx
              <div className="text-right">
                <button
                  type="button"
                  onClick={() => setShowForgot(true)}
                  className="text-[11px] font-bold text-amber-400 hover:text-amber-300 underline"
                >
                  Esqueci minha senha
                </button>
              </div>
```

d) antes do `</div>` final do componente, renderizar o modal:

```tsx
      {showForgot && <ForgotPasswordModal initialEmail={loginEmail} onClose={() => setShowForgot(false)} />}
```

(Localizar o campo de senha do login: o bloco com `value={loginPassword}`; inserir o link imediatamente depois do `</div>` que fecha esse campo.)

- [ ] **Step 4: Tipos e lint**

```bash
cd D:/Projects/fitness/itgames/itgames-platform && npx tsc --noEmit && npx eslint src/components/auth/ForgotPasswordModal.tsx src/app/redefinir-senha/page.tsx src/app/login/page.tsx
```

Expected: sem erros novos.

- [ ] **Step 5: Verificação manual (stack local, após configurar um SMTP real)**

Com a stack rebuildada: em `/login` clicar em "Esqueci minha senha", informar o e-mail do atleta de teste (`teste.parceiro@itgames.local` — as contas de teste criadas anteriormente, ou qualquer conta existente) → mensagem genérica de sucesso; conferir na aba **E-mails → Histórico** a linha `password_reset` (Enviado/Falhou/Ignorado conforme o SMTP). Com SMTP real: abrir o link recebido (`/redefinir-senha?token=...`), definir nova senha, logar. Abrir `/redefinir-senha` sem token → "Link inválido".

- [ ] **Step 6: Commit (somente se o usuário pedir)**

```bash
git add itgames-platform/src/components/auth itgames-platform/src/app/redefinir-senha itgames-platform/src/app/login/page.tsx
git commit -m "feat(auth): forgot password modal and reset page"
```

---

### Task 8: Implantação, spec e verificação final

**Files:**
- Modify: `docker-compose.yml`, `docker-compose.portainer.yml` (serviço `api`: `MAIL_ENCRYPTION_KEY`)
- Modify: `.env.example`
- Modify: `docs/superpowers/specs/2026-10-06-configuracao-de-emails-design.md` (tweaks)

**Interfaces:** nenhuma nova.

- [ ] **Step 1: Postgres de teste descartável (só para rodar os e2e)**

```bash
docker run -d --name itgames-test-pg -p 5433:5432 -e POSTGRES_USER=itgames_user -e POSTGRES_PASSWORD=itgames_password -e POSTGRES_DB=itgames_test postgres:18-alpine
```

Aguardar ~8 s. (Se já existir um `itgames-test-pg` de outra rodada: `docker rm -f itgames-test-pg` antes.) Esse container é descartável e **nunca** aponta para o banco real.

- [ ] **Step 2: Variável de ambiente nos composes**

Em `docker-compose.yml` e `docker-compose.portainer.yml`, no `environment` do serviço `api`, depois de `JWT_SECRET`:

```yaml
      MAIL_ENCRYPTION_KEY: "${MAIL_ENCRYPTION_KEY:-}"
```

Em `.env.example`, na seção de segurança (depois de `JWT_SECRET`):

```
# Chave que criptografa a senha SMTP guardada no banco (aba "E-mails" do admin).
# Se vazia, usa o JWT_SECRET. Trocar esta chave invalida a senha SMTP salva (é preciso digitá-la de novo).
MAIL_ENCRYPTION_KEY=
```

- [ ] **Step 3: Ajustar a spec**

Em `docs/superpowers/specs/2026-10-06-configuracao-de-emails-design.md`:
- Tabela "Variáveis por tipo": acrescentar `nome` às variáveis de `alert_new_registration` (`nome`, `campeonato`, `categoria`, `equipe`, `numero`, `integrantes`) e de `alert_game_status` (`nome`, `campeonato`, `status`), e nas linhas de `alert_registration_cancelled` já há `nome`.
- Seção Endpoints, `POST /mail/logs/:id/resend`: acrescentar "Não reenvia e-mails sem dados gravados (`password_reset` e teste): responde 400."
- Seção Dados, `email_logs.payload`: acrescentar "nulo em `password_reset` (o link tem token) e no teste".

- [ ] **Step 4: Verificação completa**

```bash
cd D:/Projects/fitness/itgames/itgames-api && npx tsc --noEmit -p tsconfig.json && npx jest --config ./test/jest-e2e.json --runInBand
cd ../itgames-platform && npx tsc --noEmit
```

Expected: tsc limpo nos dois; todas as suítes e2e PASS (as 10 antigas + 4 novas de e-mail/reset = mail-utils, mail-service, mail-admin, password-reset, mail-triggers).

- [ ] **Step 5: Rebuild da stack local e checagem no banco real (somente leitura)**

```bash
cd D:/Projects/fitness/itgames && docker compose up -d --build api frontend
docker logs itgames-api 2>&1 | grep -E "in sync|rodando"
docker exec itgames-postgres psql -U itgames_user -d itgames_db -c "\dt" | grep -E "mail_|email_logs|password_reset"
docker exec itgames-postgres psql -U itgames_user -d itgames_db -tc "select (select count(*) from users) u, (select count(*) from games) g"
```

Expected: "Your database is now in sync with your Prisma schema", as 4 tabelas novas listadas e as contagens de `users` e `games` **iguais às de antes** (nenhum dado perdido).

- [ ] **Step 6: Limpeza**

```bash
docker rm -f itgames-test-pg
```

- [ ] **Step 7: Commit (somente se o usuário pedir)**

```bash
git add docker-compose.yml docker-compose.portainer.yml .env.example docs/superpowers/specs/2026-10-06-configuracao-de-emails-design.md
git commit -m "chore(mail): MAIL_ENCRYPTION_KEY env and spec adjustments"
```

---

## Self-Review

**Cobertura da spec**
- Dados (4 tabelas, cifra, tipos, padrões no código, restaurar = apagar linha): Task 1 (schema/crypto/templates) + Task 3 (`resetTemplate`).
- `MailService` (skipped/sent/failed, sem await, nunca lança, transporte a cada envio, escape, Gmail): Task 2.
- Endpoints `/mail/*` e `/auth/*`: Tasks 3 e 4 (inclui "teste devolve erro real", `password` ausente mantém, `enabled` exige completo).
- Gatilhos (inscrição, pagamento só na mudança, cancelamento, `live`/`blocked`, só organizadores ativos): Task 5.
- Frontend (aba, servidor, tipos, histórico, link e página de reset): Tasks 6 e 7.
- Erros/segurança (senha nunca sai, `appBaseUrl`, resposta uniforme, escape): Global Constraints + testes das Tasks 2–5.
- Implantação (`nodemailer`, `MAIL_ENCRYPTION_KEY`, só tabelas novas): Tasks 1 e 8.
- Rate limit em memória: Task 4. Limite por IP e e-mail, configurável por env para testes.

**Pontos que divergem/refinam a spec (já refletidos na Task 8, Step 3)**
- `nome` agora existe em todos os tipos de alerta (cada destinatário recebe o próprio nome).
- `password_reset` e `test` não gravam payload e **não podem ser reenviados** (o link tem token).
- Reenvio de `skipped` por configuração: permitido quando há payload.

**Consistência de tipos/nomes:** `MailType`/`MAIL_TYPES`/`isMailType` (Task 1) usados em Tasks 2, 3 e 5; `send(type, to, vars, opts)` e `dispatch` (Task 2) usados em 3, 4, 5; `track`/`idle` (Task 2) usados em 4 e 5; `ctx.mail`/`ctx.idle`/`configureMail` (Task 2) usados em 3, 4, 5; `resetLimiter` (campo privado do `AuthService`, Task 4) é acessado no teste via `as any`; `MailNotifier` (Task 5) injetado em `EventsService`; métodos do `api-client` (Task 6) usados em 6 e 7.

**Placeholders:** nenhum "TBD". Os dois pontos que pedem conferência no arquivo real (corpo atual de `updateGameStatus`; local exato do campo de senha no login) trazem a instrução e o trecho a inserir.
