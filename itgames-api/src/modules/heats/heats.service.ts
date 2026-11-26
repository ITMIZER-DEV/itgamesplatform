import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { planArenaSchedule, PlanOptions } from './arena-schedule';
import { categoryArenaOrder, extractWodBlockKey, parseRestMinutes, parseTimeCapMinutes } from './heat-time';
import { ACTIVE_ONLY } from '../../common/prisma-filters/active';

export { extractWodBlockKey, parseRestMinutes, parseTimeCapMinutes };

function getCenterLanesOrder(totalLanes: number): number[] {
  const center = Math.ceil(totalLanes / 2);
  const result: number[] = [];
  let left = center;
  let right = center + 1;

  while (left >= 1 || right <= totalLanes) {
    if (left >= 1) result.push(left--);
    if (right <= totalLanes) result.push(right++);
  }

  return result;
}

function formatMinutesToHHMM(totalMinutes: number): string {
  const norm = ((totalMinutes % 1440) + 1440) % 1440;
  const hh = String(Math.floor(norm / 60)).padStart(2, '0');
  const mm = String(norm % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}

function parseHourToMinutes(startHour?: string): number {
  const [hStr, mStr] = (startHour || '08:00').split(':');
  return (Number(hStr) || 8) * 60 + (Number(mStr) || 0);
}

function shuffleTeams<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function distributeTeamsIntoHeats<T>(teams: T[], maxLanes: number, minPerHeat = 2): T[][] {
  if (teams.length === 0) return [];
  const safeMax = Math.max(1, maxLanes);
  let numHeats = Math.ceil(teams.length / safeMax);

  // Evita bateria com menos que minPerHeat quando possível sem ultrapassar maxLanes
  while (numHeats > 1 && Math.floor(teams.length / numHeats) < minPerHeat && Math.ceil(teams.length / (numHeats - 1)) <= safeMax) {
    numHeats--;
  }

  const baseSize = Math.floor(teams.length / numHeats);
  const remainder = teams.length % numHeats;
  const groups: T[][] = [];
  let cursor = 0;

  for (let h = 0; h < numHeats; h++) {
    const size = baseSize + (h < remainder ? 1 : 0);
    groups.push(teams.slice(cursor, cursor + size));
    cursor += size;
  }

  return groups;
}

@Injectable()
export class HeatsService {
  constructor(private readonly prisma: PrismaService) {}

  async generateHeats(params: {
    gameCode: string;
    categoryId: number;
    workoutCode: number;
    totalLanes: number;
    startHour: string;
    intervalMinutes: number;
    isFinalSeeding?: boolean;
    minPerHeat?: number;
  }) {
    const {
      gameCode,
      categoryId,
      workoutCode,
      totalLanes = 4,
      startHour = '08:00',
      intervalMinutes = 15,
      isFinalSeeding = false,
      minPerHeat = 2,
    } = params;

    // Buscar atletas inscritos na categoria
    const registrations = await this.prisma.registration.findMany({
      where: {
        gameCode,
        categoryId,
        // inscrições canceladas não entram nas baterias
        OR: [{ status: null }, { status: { not: 'cancelled' } }],
      },
      include: {
        athletes: true,
      },
    });

    if (registrations.length === 0) {
      return { success: false, message: 'Nenhuma equipe inscrita nesta categoria' };
    }

    let orderedTeams = [...registrations];

    // Seeding de Final: ordenar do pior rank acumulado para o melhor
    // Assim, os líderes do campeonato ficam na última bateria e nas raias centrais
    if (isFinalSeeding) {
      const priorScores = await this.prisma.score.findMany({
        where: {
          game: gameCode,
          category: categoryId,
          // súmulas anuladas não contam no seeding
          OR: [{ scoreStatus: null }, { scoreStatus: { not: 'voided' } }],
        },
      });

      // Calcular soma de pontos por equipe (quanto menor a pontuação no CrossFit ou maior dependendo da regra)
      const teamPointsMap = new Map<number, number>();
      for (const reg of registrations) {
        const scores = priorScores.filter((s) => s.codeTeam === reg.code);
        const totalPoints = scores.reduce((acc, curr) => acc + (curr.point || 0), 0);
        teamPointsMap.set(reg.code, totalPoints);
      }

      // Ordenar: menores pontos primeiro (ficam nas primeiras baterias) -> líderes no final
      orderedTeams.sort((a, b) => {
        const pointsA = teamPointsMap.get(a.code) || 0;
        const pointsB = teamPointsMap.get(b.code) || 0;
        return pointsA - pointsB;
      });
    } else {
      orderedTeams = shuffleTeams(orderedTeams);
    }

    // Remover baterias antigas deste workout
    await this.prisma.heat.deleteMany({
      where: {
        gameCode,
        categoryId,
        workoutCode,
      },
    });

    const workout = await this.prisma.workout.findUnique({
      where: { code_game: { code: workoutCode, game: gameCode } },
      select: { timeCap: true },
    });
    const durationMin = parseTimeCapMinutes(workout?.timeCap, 10);

    const heatGroups = distributeTeamsIntoHeats(orderedTeams, totalLanes, minPerHeat);
    const totalHeats = heatGroups.length;
    const [baseH, baseM] = startHour.split(':').map(Number);
    const createdHeats = [];

    for (let h = 0; h < totalHeats; h++) {
      const heatNumber = h + 1;
      const heatTeams = heatGroups[h];

      const date = new Date();
      date.setHours(baseH || 8, baseM || 0, 0, 0);
      date.setMinutes(date.getMinutes() + h * (durationMin + intervalMinutes));
      const startTimeFormatted = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;

      // Se for a última bateria em Seeding de Final, aplicar distribuição de raias centrais
      let laneOrder: number[] = [];
      if (isFinalSeeding && heatNumber === totalHeats) {
        laneOrder = getCenterLanesOrder(totalLanes);
      } else {
        laneOrder = Array.from({ length: totalLanes }, (_, i) => i + 1);
      }

      const heat = await this.prisma.heat.create({
        data: {
          gameCode,
          categoryId,
          workoutCode,
          heatNumber,
          startTime: startTimeFormatted,
          status: 'scheduled',
          slots: {
            create: heatTeams.map((team, idx) => ({
              laneNumber: laneOrder[idx] || idx + 1,
              teamCode: team.code,
              gameCode,
            })),
          },
        },
        include: {
          slots: {
            include: {
              registration: {
                include: {
                  athletes: true,
                },
              },
            },
            orderBy: {
              laneNumber: 'asc',
            },
          },
        },
      });

      createdHeats.push(heat);
    }

    return {
      success: true,
      totalHeats: createdHeats.length,
      heats: createdHeats,
    };
  }

  /**
   * Montagem real do cronograma de arena:
   * - Agrupa WODs sequenciais (1.1, 1.2, 1.3 / 4.1, 4.2 / 1-A, 1-B) no mesmo bloco.
   * - Roda todas as categorias por bloco antes de passar ao próximo bloco.
   * - Mantém exatamente as mesmas baterias e raias para todas as sub-provas do bloco.
   * - Calcula horários reais: TimeCap + descanso interno (3 min) + intervalo entre baterias (10 min).
   */
  async generateSchedule(params: {
    gameCode: string;
    totalLanes: number;
    startHour: string;
    intervalMinutes?: number;
    subWodRestMinutes?: number;
    categoryTransitionMinutes?: number;
    wodTransitionMinutes?: number;
    minPerHeat?: number;
    categoryId?: number;
    isFinalSeeding?: boolean;
    /** 2 = cronograma com 2 arenas simultâneas (ondas cruzadas); padrão 1. */
    arenas?: 1 | 2;
    afternoonStart?: string;
    minRestMinutes?: number;
  }) {
    const {
      gameCode,
      totalLanes = 4,
      startHour = '08:00',
      intervalMinutes = 10,
      subWodRestMinutes = 3,
      categoryTransitionMinutes = 10,
      wodTransitionMinutes = 5,
      minPerHeat = 2,
      categoryId,
      isFinalSeeding = false,
    } = params;

    const categoriesRaw = await this.prisma.category.findMany({
      where: {
        gamesId: gameCode,
        ...(categoryId ? { code: categoryId } : {}),
      },
      include: { workouts: true },
      orderBy: { code: 'asc' },
    });

    const categories = [...categoriesRaw].sort(
      (a, b) => categoryArenaOrder(a.name, a.code) - categoryArenaOrder(b.name, b.code),
    );

    if (categories.length === 0) {
      return { success: false, message: 'Nenhuma categoria encontrada para gerar baterias.' };
    }

    // Coletar todos os blocos em ordem natural
    const blockOrder: string[] = [];
    const blockMap = new Map<string, { categoryId: number; workouts: any[] }[]>();

    for (const cat of categories) {
      const sortedWods = [...cat.workouts].sort((a, b) =>
        String(a.title || '').localeCompare(String(b.title || ''), 'pt-BR', { numeric: true, sensitivity: 'base' }),
      );
      const catBlocks = new Map<string, any[]>();
      for (const w of sortedWods) {
        const bKey = extractWodBlockKey(w.title, w.code);
        if (!catBlocks.has(bKey)) catBlocks.set(bKey, []);
        catBlocks.get(bKey)!.push(w);
        if (!blockOrder.includes(bKey)) blockOrder.push(bKey);
      }
      for (const [bKey, wods] of catBlocks.entries()) {
        if (!blockMap.has(bKey)) blockMap.set(bKey, []);
        blockMap.get(bKey)!.push({ categoryId: cat.code, workouts: wods });
      }
    }

    let arenaCursor = parseHourToMinutes(startHour);
    let totalHeatsCreated = 0;
    let totalWorkoutsProcessed = 0;

    for (let bIdx = 0; bIdx < blockOrder.length; bIdx++) {
      const bKey = blockOrder[bIdx];
      const entries = blockMap.get(bKey) || [];
      const isLastBlock = bIdx === blockOrder.length - 1;

      for (let eIdx = 0; eIdx < entries.length; eIdx++) {
        const entry = entries[eIdx];
        const isLastEntryInBlock = eIdx === entries.length - 1;
        const registrations = await this.prisma.registration.findMany({
          where: {
            gameCode,
            categoryId: entry.categoryId,
            OR: [{ status: null }, { status: { not: 'cancelled' } }],
          },
          orderBy: { code: 'asc' },
        });

        if (registrations.length === 0) continue;

        let orderedTeams = [...registrations];
        if (isFinalSeeding) {
          const priorScores = await this.prisma.score.findMany({
            where: {
              game: gameCode,
              category: entry.categoryId,
              OR: [{ scoreStatus: null }, { scoreStatus: { not: 'voided' } }],
            },
          });
          const teamPointsMap = new Map<number, number>();
          for (const reg of registrations) {
            const pts = priorScores
              .filter((s) => s.codeTeam === reg.code)
              .reduce((acc, curr) => acc + (curr.point || 0), 0);
            teamPointsMap.set(reg.code, pts);
          }
          orderedTeams.sort((a, b) => (teamPointsMap.get(a.code) || 0) - (teamPointsMap.get(b.code) || 0));
        } else {
          orderedTeams = shuffleTeams(orderedTeams);
        }

        // Limpa baterias antigas de todas as sub-provas deste bloco na categoria
        await this.prisma.heat.deleteMany({
          where: {
            gameCode,
            categoryId: entry.categoryId,
            workoutCode: { in: entry.workouts.map((w) => w.code) },
          },
        });

        const heatGroups = distributeTeamsIntoHeats(orderedTeams, totalLanes, minPerHeat);
        const totalHeats = heatGroups.length;
        totalWorkoutsProcessed += entry.workouts.length;

        for (let h = 0; h < totalHeats; h++) {
          const heatNumber = h + 1;
          const heatTeams = heatGroups[h];
          const laneOrder =
            isFinalSeeding && heatNumber === totalHeats
              ? getCenterLanesOrder(totalLanes)
              : Array.from({ length: totalLanes }, (_, i) => i + 1);

          let subCursor = arenaCursor;
          const blockStartTime = formatMinutesToHHMM(arenaCursor);

          for (let wIdx = 0; wIdx < entry.workouts.length; wIdx++) {
            const wod = entry.workouts[wIdx];
            const durationMin = parseTimeCapMinutes(wod.timeCap, 10);
            const isComboAB = entry.workouts.length > 1 && entry.workouts.every((w) => /-\s*[AB]\b/i.test(String(w.title || '')));

            await this.prisma.heat.create({
              data: {
                gameCode,
                categoryId: entry.categoryId,
                workoutCode: wod.code,
                heatNumber,
                startTime: isComboAB ? blockStartTime : formatMinutesToHHMM(subCursor),
                arena: null,
                status: 'scheduled',
                slots: {
                  create: heatTeams.map((team, idx) => ({
                    laneNumber: laneOrder[idx] || idx + 1,
                    teamCode: team.code,
                    gameCode,
                  })),
                },
              },
            });

            totalHeatsCreated += 1;
            subCursor += durationMin;
            if (wIdx < entry.workouts.length - 1) {
              // A/B: o descanso vem da prova seguinte (WOD 1-B "Rest 1'", WOD 4-B "Após 4' de Rest").
              subCursor += isComboAB
                ? parseRestMinutes(entry.workouts[wIdx + 1].description, 1)
                : subWodRestMinutes;
            }
          }

          if (h < totalHeats - 1) {
            arenaCursor = subCursor + intervalMinutes;
          } else if (!isLastEntryInBlock) {
            arenaCursor = subCursor + categoryTransitionMinutes;
          } else if (!isLastBlock) {
            arenaCursor = subCursor + wodTransitionMinutes;
          } else {
            arenaCursor = subCursor;
          }
        }
      }
    }

    if (totalHeatsCreated === 0) {
      return { success: false, message: 'Nenhuma equipe inscrita nas categorias selecionadas.' };
    }

    if (params.arenas === 2) {
      // Duplas e raias já sorteadas acima; agora distribui os horários nas 2 arenas.
      const plan = await this.retimeSchedule({
        gameCode,
        arenas: 2,
        startHour,
        intervalMinutes,
        afternoonStart: params.afternoonStart,
        minRestMinutes: params.minRestMinutes,
        apply: true,
      });
      return {
        success: plan.success,
        message: plan.message,
        totalHeats: totalHeatsCreated,
        totalWorkouts: totalWorkoutsProcessed,
        endTimeEstimated: plan.summary.end,
        summary: plan.summary,
        problems: plan.problems,
      };
    }

    return {
      success: true,
      totalHeats: totalHeatsCreated,
      totalWorkouts: totalWorkoutsProcessed,
      endTimeEstimated: formatMinutesToHHMM(arenaCursor),
    };
  }

  /**
   * Recalcula SÓ horário e arena das baterias existentes do campeonato (duplas e raias não mudam).
   * Com apply=false devolve o plano para conferência sem gravar.
   */
  async retimeSchedule(params: PlanOptions & { gameCode: string; apply?: boolean }) {
    const { gameCode, apply = false, ...opts } = params;
    const [categories, workouts, heats] = await Promise.all([
      this.prisma.category.findMany({ where: { gamesId: gameCode }, select: { code: true, name: true } }),
      this.prisma.workout.findMany({
        where: { game: gameCode, ...ACTIVE_ONLY },
        select: { code: true, category: true, title: true, timeCap: true, description: true },
      }),
      this.prisma.heat.findMany({
        where: { gameCode },
        select: { id: true, categoryId: true, workoutCode: true, heatNumber: true, slots: { select: { teamCode: true } } },
      }),
    ]);
    if (heats.length === 0) {
      return {
        success: false,
        applied: false,
        message: 'Nenhuma bateria gerada ainda. Gere as baterias primeiro.',
        summary: planArenaSchedule([], [], [], opts).summary,
        problems: [],
        items: [],
      };
    }
    const plan = planArenaSchedule(
      categories,
      workouts,
      heats.map((h) => ({ ...h, teams: h.slots.map((s) => s.teamCode) })),
      opts,
    );
    const items = plan.items.map((i) => ({
      categoryId: i.categoryId,
      categoryName: i.categoryName,
      wod: i.blockLabel,
      heatNumber: i.heatNumber,
      start: formatMinutesToHHMM(i.start),
      end: formatMinutesToHHMM(i.end),
      arena: i.arena,
      teams: i.teams.length,
    }));
    if (plan.problems.length > 0) {
      return { success: false, applied: false, message: plan.problems[0], summary: plan.summary, problems: plan.problems, items };
    }
    if (apply) {
      await this.prisma.$transaction(
        plan.items.flatMap((i) =>
          i.heatIds.map((id) =>
            this.prisma.heat.update({ where: { id }, data: { startTime: formatMinutesToHHMM(i.start), arena: i.arena } }),
          ),
        ),
      );
    }
    return { success: true, applied: apply, message: '', summary: plan.summary, problems: [], items };
  }

  async findByGameAndWorkout(gameCode: string, workoutCode: number) {
    return this.prisma.heat.findMany({
      where: {
        gameCode,
        workoutCode,
      },
      include: {
        slots: {
          include: {
            registration: {
              include: {
                athletes: { select: { code: true, name: true } },
              },
            },
          },
          orderBy: {
            laneNumber: 'asc',
          },
        },
      },
      orderBy: { heatNumber: 'asc' },
    });
  }

  async updateStatus(heatId: string, status: string) {
    return this.prisma.heat.update({
      where: { id: heatId },
      data: { status },
    });
  }

  async swapLanes(params: {
    slotIdA: string;
    slotIdB: string;
  }) {
    const { slotIdA, slotIdB } = params;

    const slotA = await this.prisma.laneSlot.findUnique({ where: { id: slotIdA } });
    const slotB = await this.prisma.laneSlot.findUnique({ where: { id: slotIdB } });

    if (!slotA || !slotB) {
      throw new NotFoundException('Slots de raia não encontrados');
    }

    const tempLane = slotA.laneNumber;

    await this.prisma.$transaction([
      this.prisma.laneSlot.update({
        where: { id: slotIdA },
        data: { laneNumber: slotB.laneNumber },
      }),
      this.prisma.laneSlot.update({
        where: { id: slotIdB },
        data: { laneNumber: tempLane },
      }),
    ]);

    return { success: true, message: 'Raias trocadas com sucesso' };
  }

  async gameCodeOfHeat(heatId: string): Promise<string> {
    const heat = await this.prisma.heat.findUnique({ where: { id: heatId }, select: { gameCode: true } });
    if (!heat) throw new NotFoundException('Bateria não encontrada');
    return heat.gameCode;
  }

  async gameCodeOfSlot(slotId: string): Promise<string> {
    const slot = await this.prisma.laneSlot.findUnique({ where: { id: slotId }, select: { gameCode: true } });
    if (!slot) throw new NotFoundException('Slot de raia não encontrado');
    return slot.gameCode;
  }
}
