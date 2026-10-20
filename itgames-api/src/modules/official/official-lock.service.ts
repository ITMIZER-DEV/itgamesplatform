import { ConflictException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { officialKey } from './official-logic';

export const LOCKED_MSG =
  'Este WOD já foi calculado oficialmente. O juiz-chefe precisa reverter o cálculo antes de alterar a súmula.';

// Trava da súmula: WOD com resultado oficial ativo (activeKey não nulo) não aceita alteração.
@Injectable()
export class OfficialLockService {
  constructor(private readonly prisma: PrismaService) {}

  async isLocked(game: string, category: number, event: number): Promise<boolean> {
    const n = await this.prisma.officialResult.count({ where: { activeKey: officialKey(game, category, event) } });
    return n > 0;
  }

  async assertUnlocked(game: string, category: number, event: number): Promise<void> {
    if (await this.isLocked(game, category, event)) throw new ConflictException(LOCKED_MSG);
  }

  async anyConfirmed(game: string): Promise<boolean> {
    const n = await this.prisma.officialResult.count({ where: { gameCode: game, activeKey: { not: null } } });
    return n > 0;
  }

  // Qualquer campeonato com resultado oficial ativo (usado na importação de backup, que é global)
  async anyConfirmedAnywhere(): Promise<boolean> {
    const n = await this.prisma.officialResult.count({ where: { activeKey: { not: null } } });
    return n > 0;
  }

  async anyConfirmedInCategory(game: string, category: number): Promise<boolean> {
    const n = await this.prisma.officialResult.count({
      where: { gameCode: game, categoryId: category, activeKey: { not: null } },
    });
    return n > 0;
  }

  async confirmedEventIds(game: string, category: number): Promise<number[]> {
    const rows = await this.prisma.officialResult.findMany({
      where: { gameCode: game, categoryId: category, activeKey: { not: null } },
      select: { eventId: true },
    });
    return rows.map((r) => r.eventId);
  }

  // CONTRATO DE SERIALIZAÇÃO (READ COMMITTED não enxerga OfficialResult não commitado):
  // - confirmar e reverter chamam lockEventForUpdate(tx, ...) no início da transação
  //   (FOR UPDATE na linha do evento em games_events);
  // - todo caminho que grava súmula deve abrir transação e chamar assertUnlockedInTx(tx, ...)
  //   antes de escrever (FOR SHARE na mesma linha + checagem do resultado ativo dentro da transação).
  // Assim, a gravação espera a confirmação em curso terminar e então enxerga o resultado commitado
  // (409), ou a confirmação espera a gravação terminar e então recalcula com a súmula já gravada.
  async lockEventForUpdate(tx: Prisma.TransactionClient, game: string, eventId: number): Promise<void> {
    await tx.$queryRaw`SELECT 1 FROM "games_events" WHERE "game" = ${game} AND "idEvent" = ${eventId} FOR UPDATE`;
  }

  async assertUnlockedInTx(tx: Prisma.TransactionClient, game: string, category: number, eventId: number): Promise<void> {
    await tx.$queryRaw`SELECT 1 FROM "games_events" WHERE "game" = ${game} AND "idEvent" = ${eventId} FOR SHARE`;
    const n = await tx.officialResult.count({ where: { activeKey: officialKey(game, category, eventId) } });
    if (n > 0) throw new ConflictException(LOCKED_MSG);
  }
}
