import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateScoreDto } from './dto/create-score.dto';

@Injectable()
export class ScoresService {
  constructor(private readonly prisma: PrismaService) {}

  async createOrUpdateScore(dto: CreateScoreDto, actorName: string, actorRole: string, ipAddress?: string) {
    // Garantir que o Event correspondente exista
    await this.prisma.event.upsert({
      where: {
        idEvent_game: {
          idEvent: dto.idEvent,
          game: dto.game,
        },
      },
      update: {},
      create: {
        idEvent: dto.idEvent,
        game: dto.game,
        category: dto.category,
        title: `WOD ${dto.idEvent}`,
        workout: dto.idEvent,
      },
    });

    // Buscar se já existe score para este time e evento
    const existing = await this.prisma.score.findUnique({
      where: {
        team_event: {
          codeTeam: dto.codeTeam,
          idEvent: dto.idEvent,
          game: dto.game,
        },
      },
    });

    const isNew = !existing;
    const oldValue = existing ? `${existing.time || ''} ${existing.reps || ''} ${existing.weight || ''}`.trim() : null;
    const newValue = `${dto.time || ''} ${dto.reps || ''} ${dto.weight || ''}`.trim();

    const score = await this.prisma.score.upsert({
      where: {
        team_event: {
          codeTeam: dto.codeTeam,
          idEvent: dto.idEvent,
          game: dto.game,
        },
      },
      update: {
        time: dto.time,
        weight: dto.weight,
        reps: dto.reps,
        judge: dto.judge,
        photo: dto.photo,
        tieBreakTime: dto.tieBreakTime,
        penaltySeconds: dto.penaltySeconds || 0,
        isWO: dto.isWO || false,
        dateCheck: new Date().toISOString(),
        scoreStatus: 'approved_by_head_judge',
      },
      create: {
        idEvent: dto.idEvent,
        game: dto.game,
        category: dto.category,
        codeTeam: dto.codeTeam,
        time: dto.time,
        weight: dto.weight,
        reps: dto.reps,
        judge: dto.judge,
        photo: dto.photo,
        tieBreakTime: dto.tieBreakTime,
        penaltySeconds: dto.penaltySeconds || 0,
        isWO: dto.isWO || false,
        dateScore: new Date().toISOString(),
        dateCheck: new Date().toISOString(),
        scoreStatus: 'approved_by_head_judge',
      },
    });

    // Gravar Trilha de Auditoria Imutável (Audit Trail)
    await this.prisma.auditLog.create({
      data: {
        gameCode: dto.game,
        scoreId: score.code,
        changedBy: actorName,
        role: actorRole,
        action: isNew ? 'create' : 'update',
        oldValue,
        newValue,
        reason: dto.auditReason || (isNew ? 'Lançamento inicial de campo' : 'Retificação auditada'),
        ipAddress,
      },
    });

    return {
      success: true,
      message: isNew ? 'Score lançado com sucesso' : 'Score retificado e auditado',
      score,
    };
  }

  async findByGame(gameCode: string) {
    return this.prisma.score.findMany({
      where: { game: gameCode },
      include: {
        registration: {
          include: {
            athletes: true,
          },
        },
        auditLogs: true,
      },
      orderBy: { code: 'desc' },
    });
  }

  async attachPhoto(scoreCode: number, photoUrlOrBase64: string, actorName: string, actorRole: string, ipAddress?: string) {
    await this.getScoreGameCode(scoreCode);

    const score = await this.prisma.score.update({
      where: { code: scoreCode },
      data: { photo: photoUrlOrBase64 },
    });

    await this.prisma.auditLog.create({
      data: {
        gameCode: score.game,
        scoreId: score.code,
        changedBy: actorName,
        role: actorRole,
        action: 'photo_attached',
        reason: 'Foto comprovante da súmula anexada',
        ipAddress,
      },
    });

    return { success: true, score };
  }

  async getScoreGameCode(scoreCode: number): Promise<string> {
    const score = await this.prisma.score.findUnique({ where: { code: scoreCode }, select: { game: true } });
    if (!score) throw new NotFoundException('Score não encontrado');
    return score.game;
  }
}
