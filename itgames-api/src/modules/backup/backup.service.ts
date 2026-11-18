import { Injectable, ForbiddenException, ConflictException, Logger, BadRequestException } from '@nestjs/common';
import { OfficialLockService } from '../official/official-lock.service';
import { PrismaService } from '../../prisma/prisma.service';
import { normalizeCpf } from '../../common/utils/cpf';

@Injectable()
export class BackupService {
  private readonly logger = new Logger(BackupService.name);

  constructor(
    private prisma: PrismaService,
    private readonly lock: OfficialLockService,
  ) {}

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
      version: '1.6.2',
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

  async importSnapshot(data: any, actorRole?: string) {
    // restaurar sobrescreve súmulas: com cálculo oficial ativo, só o SUPER_ADMIN pode
    if (actorRole !== 'SUPER_ADMIN' && (await this.lock.anyConfirmedAnywhere())) {
      throw new ConflictException('Há WODs com cálculo oficial ativo. Reverta o cálculo oficial antes de importar o backup (ou peça ao Super Admin).');
    }

    if (!data || typeof data !== 'object') {
      throw new BadRequestException('Formato de snapshot JSON inválido.');
    }

    const summary = {
      users: 0,
      games: 0,
      categories: 0,
      events: 0,
      workouts: 0,
      registrations: 0,
      heats: 0,
      scores: 0,
    };

    // 1. Usuários
    if (Array.isArray(data.users)) {
      for (const u of data.users) {
        try {
          const { athleteProfile, organizedGames, ...userData } = u;
          const targetEmail = userData.email?.toLowerCase().trim();
          const targetCpf = userData.cpf ? normalizeCpf(userData.cpf) : null;
          const targetId = userData.id;

          if (!targetEmail) continue;

          // Localiza usuário por ID, E-mail ou CPF para evitar quebra de chave única (unique constraint)
          const existingUser = await this.prisma.user.findFirst({
            where: {
              OR: [
                ...(targetId ? [{ id: targetId }] : []),
                { email: targetEmail },
                ...(targetCpf ? [{ cpf: targetCpf }] : []),
              ],
            },
          });

          const { id: _, ...fieldsToUpsert } = userData;
          fieldsToUpsert.email = targetEmail;
          if (targetCpf) fieldsToUpsert.cpf = targetCpf;
          if (fieldsToUpsert.createdAt) fieldsToUpsert.createdAt = new Date(fieldsToUpsert.createdAt);
          if (fieldsToUpsert.updatedAt) fieldsToUpsert.updatedAt = new Date(fieldsToUpsert.updatedAt);

          let user;
          if (existingUser) {
            user = await this.prisma.user.update({
              where: { id: existingUser.id },
              data: fieldsToUpsert,
            });
          } else {
            user = await this.prisma.user.create({
              data: {
                ...fieldsToUpsert,
                ...(targetId ? { id: targetId } : {}),
              },
            });
          }
          summary.users++;

          if (athleteProfile) {
            const { id: __, userId: ___, ...profData } = athleteProfile;
            if (profData.birthDate) profData.birthDate = new Date(profData.birthDate);
            await this.prisma.athleteProfile.upsert({
              where: { userId: user.id },
              update: profData,
              create: { ...profData, userId: user.id },
            });
          }
        } catch (uErr: any) {
          this.logger.warn(`Erro ao importar usuário ${u?.email || u?.id}: ${uErr.message}`);
        }
      }
    }

    // 2. Games
    if (Array.isArray(data.games)) {
      for (const g of data.games) {
        try {
          const { organizers, registrations, categories, heats, auditLogs, ...gameData } = g;
          if (gameData.createdAt) gameData.createdAt = new Date(gameData.createdAt);
          if (gameData.updatedAt) gameData.updatedAt = new Date(gameData.updatedAt);
          await this.prisma.game.upsert({
            where: { code: gameData.code },
            update: gameData,
            create: gameData,
          });
          summary.games++;
        } catch (gErr: any) {
          this.logger.warn(`Erro ao importar campeonato ${g?.code}: ${gErr.message}`);
        }
      }
    }

    // 3. Categorias
    if (Array.isArray(data.categories)) {
      for (const c of data.categories) {
        try {
          const { registrations, scores, game, ...catData } = c;
          await this.prisma.category.upsert({
            where: { code_gamesId: { code: catData.code, gamesId: catData.gamesId } },
            update: catData,
            create: catData,
          });
          summary.categories++;
        } catch (cErr: any) {
          this.logger.warn(`Erro ao importar categoria ${c?.code}: ${cErr.message}`);
        }
      }
    }

    // 4. Eventos
    if (Array.isArray(data.events)) {
      for (const ev of data.events) {
        try {
          const { scores, categoryRef, ...evData } = ev;
          await this.prisma.event.upsert({
            where: { idEvent_game: { idEvent: evData.idEvent, game: evData.game } },
            update: evData,
            create: evData,
          });
          summary.events++;
        } catch (evErr: any) {
          this.logger.warn(`Erro ao importar evento de prova ${ev?.idEvent}: ${evErr.message}`);
        }
      }
    }

    // 5. Workouts
    if (Array.isArray(data.workouts)) {
      for (const w of data.workouts) {
        try {
          const { scores, ...workoutData } = w;
          await this.prisma.workout.upsert({
            where: { code_game: { code: workoutData.code, game: workoutData.game } },
            update: workoutData,
            create: workoutData,
          });
          summary.workouts++;
        } catch (wErr: any) {
          this.logger.warn(`Erro ao importar workout ${w?.code}: ${wErr.message}`);
        }
      }
    }

    // 6. Inscrições e Atletas
    if (Array.isArray(data.registrations)) {
      for (const r of data.registrations) {
        try {
          const { athletes, scores, laneSlots, category, game, ...regData } = r;
          if (regData.status === undefined || regData.status === null) {
            regData.status = 'paid';
          }
          await this.prisma.registration.upsert({
            where: { code_gameCode: { code: regData.code, gameCode: regData.gameCode } },
            update: regData,
            create: regData,
          });
          summary.registrations++;

          if (Array.isArray(athletes)) {
            const importedAthleteCodes = athletes.map((a: any) => a.code);
            await this.prisma.athlete.deleteMany({
              where: {
                team: regData.code,
                game: regData.gameCode,
                code: { notIn: importedAthleteCodes },
              },
            });

            for (const a of athletes) {
              try {
                const { registration, ...athleteData } = a;
                if (athleteData.birthDate) athleteData.birthDate = new Date(athleteData.birthDate);
                await this.prisma.athlete.upsert({
                  where: { code_team: { code: athleteData.code, team: athleteData.team } },
                  update: athleteData,
                  create: athleteData,
                });
              } catch (aErr: any) {
                this.logger.warn(`Erro ao importar atleta ${a?.code} da equipe ${a?.team}: ${aErr.message}`);
              }
            }
          }
        } catch (rErr: any) {
          this.logger.warn(`Erro ao importar inscrição #${r?.code}: ${rErr.message}`);
        }
      }
    }

    // 7. Baterias
    if (Array.isArray(data.heats)) {
      for (const h of data.heats) {
        try {
          const { slots, game, ...heatData } = h;
          if (heatData.scheduledTime) heatData.scheduledTime = new Date(heatData.scheduledTime);
          await this.prisma.heat.upsert({
            where: { id: heatData.id },
            update: heatData,
            create: heatData,
          });
          summary.heats++;

          if (Array.isArray(slots)) {
            for (const s of slots) {
              try {
                const { heat, registration, ...slotData } = s;
                await this.prisma.laneSlot.upsert({
                  where: { id: slotData.id },
                  update: slotData,
                  create: slotData,
                });
              } catch (sErr: any) {
                this.logger.warn(`Erro ao importar raia ${s?.id}: ${sErr.message}`);
              }
            }
          }
        } catch (hErr: any) {
          this.logger.warn(`Erro ao importar bateria ${h?.id}: ${hErr.message}`);
        }
      }
    }

    // 8. Scores
    if (Array.isArray(data.scores)) {
      for (const sc of data.scores) {
        try {
          const { auditLogs, registration, event, ...scoreData } = sc;
          if (scoreData.timestamp) scoreData.timestamp = new Date(scoreData.timestamp);
          await this.prisma.score.upsert({
            where: { team_event: { codeTeam: scoreData.codeTeam, idEvent: scoreData.idEvent, game: scoreData.game } },
            update: scoreData,
            create: scoreData,
          });
          summary.scores++;
        } catch (scErr: any) {
          this.logger.warn(`Erro ao importar score time ${sc?.codeTeam} prova ${sc?.idEvent}: ${scErr.message}`);
        }
      }
    }

    // 9. Espelhamento Exato: Purga / Sincronização de Entidades Obsoletas
    // Garante que o banco de dados fique 100% idêntico ao snapshot restaurado
    const targetGameCodes = new Set<string>();
    if (Array.isArray(data.games)) {
      data.games.forEach((g: any) => { if (g.code) targetGameCodes.add(g.code); });
    }
    if (Array.isArray(data.categories)) {
      data.categories.forEach((c: any) => { if (c.gamesId) targetGameCodes.add(c.gamesId); });
    }
    if (Array.isArray(data.registrations)) {
      data.registrations.forEach((r: any) => { if (r.gameCode) targetGameCodes.add(r.gameCode); });
    }

    for (const gameCode of targetGameCodes) {
      try {
        // 9.1 Sincronizar Inscrições (remover do banco inscrições que não constam no snapshot)
        if (Array.isArray(data.registrations)) {
          const importedRegCodes = data.registrations
            .filter((r: any) => r.gameCode === gameCode)
            .map((r: any) => r.code);

          const obsoleteRegs = await this.prisma.registration.findMany({
            where: {
              gameCode,
              code: { notIn: importedRegCodes },
            },
            select: { code: true, team: true },
          });

          for (const obsReg of obsoleteRegs) {
            try {
              await this.prisma.registration.delete({
                where: { code_gameCode: { code: obsReg.code, gameCode } },
              });
              this.logger.log(`[Backup Sync] Inscrição removida do banco (não constante no snapshot): #${obsReg.code} (${obsReg.team})`);
            } catch (err: any) {
              this.logger.warn(`[Backup Sync] Não foi possível remover inscrição #${obsReg.code}: ${err.message}`);
            }
          }
        }

        // 9.2 Sincronizar Categorias (remover do banco categorias que não constam no snapshot)
        if (Array.isArray(data.categories)) {
          const importedCatCodes = data.categories
            .filter((c: any) => c.gamesId === gameCode)
            .map((c: any) => c.code);

          const obsoleteCats = await this.prisma.category.findMany({
            where: {
              gamesId: gameCode,
              code: { notIn: importedCatCodes },
            },
            select: { code: true, name: true },
          });

          for (const obsCat of obsoleteCats) {
            try {
              await this.prisma.category.delete({
                where: { code_gamesId: { code: obsCat.code, gamesId: gameCode } },
              });
              this.logger.log(`[Backup Sync] Categoria removida do banco (não constante no snapshot): #${obsCat.code} (${obsCat.name})`);
            } catch (err: any) {
              this.logger.warn(`[Backup Sync] Não foi possível remover categoria #${obsCat.code}: ${err.message}`);
            }
          }
        }

        // 9.3 Sincronizar Workouts
        if (Array.isArray(data.workouts)) {
          const importedWodCodes = data.workouts
            .filter((w: any) => w.game === gameCode)
            .map((w: any) => w.code);

          await this.prisma.workout.deleteMany({
            where: {
              game: gameCode,
              code: { notIn: importedWodCodes },
            },
          });
        }

        // 9.4 Sincronizar Eventos
        if (Array.isArray(data.events)) {
          const importedEvIds = data.events
            .filter((ev: any) => ev.game === gameCode)
            .map((ev: any) => ev.idEvent);

          await this.prisma.event.deleteMany({
            where: {
              game: gameCode,
              idEvent: { notIn: importedEvIds },
            },
          });
        }

        // 9.5 Sincronizar Heats
        if (Array.isArray(data.heats)) {
          const importedHeatIds = data.heats
            .filter((h: any) => (h.gameCode || h.game) === gameCode)
            .map((h: any) => h.id);

          await this.prisma.heat.deleteMany({
            where: {
              gameCode,
              id: { notIn: importedHeatIds },
            },
          });
        }

        // 9.6 Sincronizar Scores
        if (Array.isArray(data.scores)) {
          const importedScoreCodes = data.scores
            .filter((s: any) => s.game === gameCode)
            .map((s: any) => s.code)
            .filter(Boolean);

          await this.prisma.score.deleteMany({
            where: {
              game: gameCode,
              code: { notIn: importedScoreCodes },
            },
          });
        }
      } catch (syncErr: any) {
        this.logger.warn(`[Backup Sync] Erro ao sincronizar espelhamento para ${gameCode}: ${syncErr.message}`);
      }
    }

    return {
      message: 'Snapshot restaurado com sucesso!',
      summary,
    };
  }
}
