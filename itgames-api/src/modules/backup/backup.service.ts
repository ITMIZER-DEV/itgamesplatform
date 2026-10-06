import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class BackupService {
  constructor(private prisma: PrismaService) {}

  async exportSnapshot() {
    const users = await this.prisma.user.findMany({ include: { athleteProfile: true } });
    const games = await this.prisma.game.findMany({ include: { organizers: true } });
    const categories = await this.prisma.category.findMany();
    const events = await this.prisma.event.findMany();
    const workouts = await this.prisma.workout.findMany();
    const registrations = await this.prisma.registration.findMany({ include: { athletes: true } });
    const heats = await this.prisma.heat.findMany({ include: { slots: true } });
    const scores = await this.prisma.score.findMany();
    const auditLogs = await this.prisma.auditLog.findMany();

    return {
      exportedAt: new Date().toISOString(),
      version: '1.4.0',
      users,
      games,
      categories,
      events,
      workouts,
      registrations,
      heats,
      scores,
      auditLogs,
    };
  }

  async importSnapshot(data: any) {
    if (!data || typeof data !== 'object') {
      throw new Error('Formato de snapshot JSON inválido.');
    }

    const summary = {
      users: 0,
      games: 0,
      categories: 0,
      workouts: 0,
      registrations: 0,
      heats: 0,
      scores: 0,
    };

    // 1. Usuários
    if (Array.isArray(data.users)) {
      for (const u of data.users) {
        const { athleteProfile, organizedGames, ...userData } = u;
        const user = await this.prisma.user.upsert({
          where: { email: userData.email },
          update: userData,
          create: userData,
        });
        summary.users++;

        if (athleteProfile) {
          const { id: _, userId: __, ...profData } = athleteProfile;
          await this.prisma.athleteProfile.upsert({
            where: { userId: user.id },
            update: profData,
            create: { ...profData, userId: user.id },
          });
        }
      }
    }

    // 2. Games
    if (Array.isArray(data.games)) {
      for (const g of data.games) {
        const { organizers, registrations, categories, heats, auditLogs, ...gameData } = g;
        await this.prisma.game.upsert({
          where: { code: gameData.code },
          update: gameData,
          create: gameData,
        });
        summary.games++;
      }
    }

    // 3. Categorias
    if (Array.isArray(data.categories)) {
      for (const c of data.categories) {
        await this.prisma.category.upsert({
          where: { code_gamesId: { code: c.code, gamesId: c.gamesId } },
          update: c,
          create: c,
        });
        summary.categories++;
      }
    }

    // 4. Workouts
    if (Array.isArray(data.workouts)) {
      for (const w of data.workouts) {
        await this.prisma.workout.upsert({
          where: { code_game: { code: w.code, game: w.game } },
          update: w,
          create: w,
        });
        summary.workouts++;
      }
    }

    // 5. Inscrições e Atletas
    if (Array.isArray(data.registrations)) {
      for (const r of data.registrations) {
        const { athletes, scores, laneSlots, ...regData } = r;
        await this.prisma.registration.upsert({
          where: { code_gameCode: { code: regData.code, gameCode: regData.gameCode } },
          update: regData,
          create: regData,
        });
        summary.registrations++;

        if (Array.isArray(athletes)) {
          for (const a of athletes) {
            await this.prisma.athlete.upsert({
              where: { code_team: { code: a.code, team: a.team } },
              update: a,
              create: a,
            });
          }
        }
      }
    }

    // 6. Baterias
    if (Array.isArray(data.heats)) {
      for (const h of data.heats) {
        const { slots, ...heatData } = h;
        await this.prisma.heat.upsert({
          where: { id: heatData.id },
          update: heatData,
          create: heatData,
        });
        summary.heats++;

        if (Array.isArray(slots)) {
          for (const s of slots) {
            await this.prisma.laneSlot.upsert({
              where: { id: s.id },
              update: s,
              create: s,
            });
          }
        }
      }
    }

    // 7. Scores
    if (Array.isArray(data.scores)) {
      for (const sc of data.scores) {
        const { auditLogs, ...scoreData } = sc;
        await this.prisma.score.upsert({
          where: { team_event: { codeTeam: scoreData.codeTeam, idEvent: scoreData.idEvent, game: scoreData.game } },
          update: scoreData,
          create: scoreData,
        });
        summary.scores++;
      }
    }

    return {
      message: 'Snapshot restaurado com sucesso!',
      summary,
    };
  }
}
