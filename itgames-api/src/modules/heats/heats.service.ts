import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

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
  }) {
    const {
      gameCode,
      categoryId,
      workoutCode,
      totalLanes = 6,
      startHour = '08:00',
      intervalMinutes = 15,
      isFinalSeeding = false,
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
    }

    // Remover baterias antigas deste workout
    await this.prisma.heat.deleteMany({
      where: {
        gameCode,
        categoryId,
        workoutCode,
      },
    });

    const totalHeats = Math.ceil(orderedTeams.length / totalLanes);
    const [baseH, baseM] = startHour.split(':').map(Number);
    const createdHeats = [];

    for (let h = 0; h < totalHeats; h++) {
      const heatNumber = h + 1;
      const startIndex = h * totalLanes;
      const heatTeams = orderedTeams.slice(startIndex, startIndex + totalLanes);

      const date = new Date();
      date.setHours(baseH || 9, baseM || 0, 0, 0);
      date.setMinutes(date.getMinutes() + h * intervalMinutes);
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
