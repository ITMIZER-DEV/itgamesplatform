import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { OfficialLockService } from '../official/official-lock.service';
import {
  planProgramImport,
  planTemplates,
  sanitizeProgram,
  PROGRAM_KIND,
  PROGRAM_VERSION,
  ProgramPackage,
  ProgramReport,
  ProgramTarget,
} from './program-package';

@Injectable()
export class ProgramService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly lock: OfficialLockService,
  ) {}

  // Exporta só a programação do campeonato (sem scores, oficiais, inscrições ou usuários)
  async exportProgram(gameCode: string): Promise<ProgramPackage> {
    const game = await this.prisma.game.findUnique({ where: { code: gameCode }, select: { code: true, name: true } });
    if (!game) throw new NotFoundException('Campeonato não encontrado');

    const [categories, workouts, events, heats] = await Promise.all([
      this.prisma.category.findMany({ where: { gamesId: gameCode }, select: { code: true, name: true }, orderBy: { code: 'asc' } }),
      this.prisma.workout.findMany({ where: { game: gameCode }, orderBy: { code: 'asc' } }),
      this.prisma.event.findMany({ where: { game: gameCode }, orderBy: { idEvent: 'asc' } }),
      this.prisma.heat.findMany({
        where: { gameCode },
        orderBy: [{ startTime: 'asc' }, { categoryId: 'asc' }, { heatNumber: 'asc' }],
        include: { slots: { orderBy: { laneNumber: 'asc' }, include: { registration: { select: { team: true, number: true } } } } },
      }),
    ]);

    // Layouts usados pelas provas + os vinculados ao campeonato
    const usedIds = [...new Set(events.map((e) => e.sumulaTemplate).filter((x): x is string => !!x))];
    const templates = await this.prisma.sumulaTemplate.findMany({
      where: { OR: [{ id: { in: usedIds } }, { gameId: gameCode }] },
      orderBy: { id: 'asc' },
    });

    return {
      kind: PROGRAM_KIND,
      version: PROGRAM_VERSION,
      exportedAt: new Date().toISOString(),
      game,
      categories,
      workouts: workouts.map(({ game: _g, ...w }) => ({
        code: w.code,
        category: w.category,
        title: w.title,
        type: w.type,
        description: w.description,
        timeCap: w.timeCap,
        foto: w.foto,
        status: w.status,
      })),
      events: events.map((e) => ({
        idEvent: e.idEvent,
        workout: e.workout,
        category: e.category,
        title: e.title,
        description: e.description,
        status: e.status,
        sumulaTemplate: e.sumulaTemplate,
      })),
      sumulaTemplates: templates.map((t) => ({
        id: t.id,
        name: t.name,
        type: t.type,
        workoutType: t.workoutType,
        gameId: t.gameId,
        categoryId: t.categoryId,
        workoutId: t.workoutId,
        htmlContent: t.htmlContent,
        isDefault: t.isDefault,
      })),
      heats: heats.map((h) => ({
        categoryId: h.categoryId,
        workoutCode: h.workoutCode,
        heatNumber: h.heatNumber,
        startTime: h.startTime,
        arena: h.arena,
        slots: h.slots.map((s) => ({
          laneNumber: s.laneNumber,
          teamCode: s.teamCode,
          teamName: s.registration.team,
          teamNumber: s.registration.number,
        })),
      })),
    };
  }

  private async loadTarget(gameCode: string): Promise<ProgramTarget> {
    const [game, categories, registrations, workouts, events, templates, heats, scores, officialConfirmed] = await Promise.all([
      this.prisma.game.findUnique({ where: { code: gameCode }, select: { code: true } }),
      this.prisma.category.findMany({ where: { gamesId: gameCode }, select: { code: true, name: true } }),
      this.prisma.registration.findMany({ where: { gameCode }, select: { code: true, categoryId: true, team: true, status: true } }),
      this.prisma.workout.findMany({ where: { game: gameCode } }),
      this.prisma.event.findMany({ where: { game: gameCode }, select: { idEvent: true, title: true, sumulaTemplate: true, status: true } }),
      this.prisma.sumulaTemplate.findMany({ select: { id: true, gameId: true } }),
      this.prisma.heat.findMany({ where: { gameCode }, select: { status: true } }),
      this.prisma.score.groupBy({ by: ['idEvent'], where: { game: gameCode }, _count: { _all: true } }),
      this.lock.anyConfirmed(gameCode),
    ]);
    return {
      gameCode,
      gameExists: !!game,
      categories,
      registrations,
      workouts: workouts.map((w) => ({
        code: w.code,
        category: w.category,
        title: w.title,
        type: w.type,
        description: w.description,
        timeCap: w.timeCap,
        foto: w.foto,
        status: w.status,
      })),
      events,
      templates,
      heats,
      scoreCountByEvent: Object.fromEntries(scores.map((s) => [s.idEvent, s._count._all])),
      officialConfirmed,
    };
  }

  // Simula (apply=false) ou grava (apply=true). Gravação em uma transação: tudo ou nada.
  async importProgram(
    gameCode: string,
    payload: any,
    apply: boolean,
    isSuperAdmin = false,
  ): Promise<ProgramReport & { applied: boolean }> {
    let pkg: ProgramPackage;
    try {
      pkg = sanitizeProgram(payload); // só campos conhecidos, com tipos conferidos
    } catch (e: any) {
      throw new BadRequestException(e.message);
    }
    const target = await this.loadTarget(gameCode);
    const report = planProgramImport(pkg, target, isSuperAdmin);
    if (!apply || !report.canApply) return { ...report, applied: false };
    const tp = planTemplates(pkg, target, isSuperAdmin);

    await this.prisma.$transaction(
      async (tx) => {
        for (const t of [...tp.create, ...tp.update]) {
          const data = {
            name: t.name,
            type: t.type,
            workoutType: t.workoutType,
            gameId: t.gameId,
            categoryId: t.categoryId,
            workoutId: t.workoutId,
            htmlContent: t.htmlContent,
            isDefault: t.isDefault,
          };
          await tx.sumulaTemplate.upsert({ where: { id: t.id }, create: { id: t.id, ...data }, update: data });
        }
        for (const w of pkg.workouts) {
          // o campeonato vem sempre da rota, nunca do arquivo
          const data = { category: w.category, title: w.title, type: w.type, description: w.description, timeCap: w.timeCap, foto: w.foto, status: w.status };
          await tx.workout.upsert({
            where: { code_game: { code: w.code, game: gameCode } },
            create: { ...data, code: w.code, game: gameCode },
            update: data,
          });
        }
        for (const e of pkg.events) {
          const data = { workout: e.workout, category: e.category, title: e.title, description: e.description, status: e.status, sumulaTemplate: e.sumulaTemplate };
          await tx.event.upsert({
            where: { idEvent_game: { idEvent: e.idEvent, game: gameCode } },
            create: { ...data, idEvent: e.idEvent, game: gameCode },
            update: data,
          });
        }
        // Timeline: substitui todas as baterias do campeonato (as raias saem junto, em cascata)
        await tx.heat.deleteMany({ where: { gameCode } });
        for (const h of pkg.heats) {
          await tx.heat.create({
            data: {
              gameCode,
              categoryId: h.categoryId,
              workoutCode: h.workoutCode,
              heatNumber: h.heatNumber,
              startTime: h.startTime,
              arena: h.arena ?? null,
              slots: { create: h.slots.map((s) => ({ laneNumber: s.laneNumber, teamCode: s.teamCode, gameCode })) },
            },
          });
        }
      },
      { timeout: 60_000 },
    );
    return { ...report, applied: true };
  }
}
