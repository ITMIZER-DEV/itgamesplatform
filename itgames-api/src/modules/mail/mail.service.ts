import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateMailSettingsDto } from './dto/update-mail-settings.dto';
import { UpdateMailTemplateDto } from './dto/update-mail-template.dto';
import { decryptSecret, encryptSecret } from './mail.crypto';
import { DEFAULT_TEMPLATES, isMailType, MAIL_TYPES, MailType, renderHtml, renderText, SAMPLE_VARS } from './mail.templates';
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
    const result = await this.send(
      'test',
      toEmail,
      {},
      {
        force: true,
        redact: true,
        subject: 'Teste de envio — ITGames',
        body: 'Este é um e-mail de teste do ITGames.\n\nSe você recebeu esta mensagem, a configuração de envio está correta.',
      },
    );
    return result.status === 'sent' ? { ok: true } : { ok: false, error: result.error ?? 'Envio não realizado' };
  }

  async listTemplates() {
    const rows = await this.prisma.mailTemplate.findMany();
    const byType = new Map(rows.map((r) => [r.type, r]));
    return MAIL_TYPES.map((type) => this.presentTemplate(type, byType.get(type)));
  }

  private presentTemplate(type: MailType, row?: { enabled: boolean; subject: string; body: string } | null) {
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

  private assertType(type: string): asserts type is MailType {
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
    const body = draft.body ?? current.body;
    return {
      subject: renderText(draft.subject ?? current.subject, vars).replace(/[\r\n]+/g, ' ').trim(),
      text: renderText(body, vars),
      html: renderHtml(body, vars),
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

  // ── Rastreio de envios em segundo plano ──────────────────────────────────

  track(promise: Promise<unknown>): void {
    const safe: Promise<unknown> = promise.catch((err) =>
      this.logger.error(`Falha em tarefa de e-mail: ${err?.message ?? err}`),
    );
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
    const payload = opts.redact || type === 'test' ? undefined : (vars as Prisma.InputJsonValue);
    try {
      const settings = await this.getSettings();
      const tpl =
        type === 'test'
          ? { enabled: true, subject: opts.subject ?? '', body: opts.body ?? '' }
          : await this.getTemplate(type);
      // assunto em uma linha só: bloqueia injeção de cabeçalhos por quebra de linha
      const subject = renderText(tpl.subject, vars).replace(/[\r\n]+/g, ' ').trim();

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
