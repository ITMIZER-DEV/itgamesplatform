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

  // Avisa os organizadores quando uma inscrição acabou de preencher a última vaga da categoria.
  // Chamado depois de cada inscrição criada ou reativada: a contagem só sobe 1 por vez, então bate no limite uma única vez.
  categoryFullIfReached(gameCode: string, categoryCode: number): void {
    this.mail.track(
      this.safely('categoryFullIfReached', async () => {
        const category = await this.prisma.category.findUnique({
          where: { code_gamesId: { code: categoryCode, gamesId: gameCode } },
          include: { game: { select: { name: true } } },
        });
        if (!category?.maxRegistrations) return;
        const count = await this.prisma.registration.count({
          where: { gameCode, categoryId: categoryCode, OR: [{ status: null }, { status: { not: 'cancelled' } }] },
        });
        if (count !== category.maxRegistrations) return;
        await this.fanOut('alert_category_full', await this.activeOrganizers(gameCode), {
          campeonato: category.game.name,
          categoria: category.name,
          limite: String(category.maxRegistrations),
        });
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
