import { ConflictException, Injectable } from '@nestjs/common';
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
}
