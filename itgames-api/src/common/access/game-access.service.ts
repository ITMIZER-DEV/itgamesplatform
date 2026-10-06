import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UserRole } from '../enums/role.enum';
import { AuthUser } from '../types/auth-user';

@Injectable()
export class GameAccessService {
  constructor(private readonly prisma: PrismaService) {}

  // Super admin gerencia tudo; organizador gerencia apenas campeonatos em que está vinculado e ativo (não suspenso).
  async canManage(user: AuthUser | undefined, gameCode: string): Promise<boolean> {
    if (!user) return false;
    if (user.role === UserRole.SUPER_ADMIN) return true;
    if (user.role !== UserRole.ORGANIZER) return false;
    const link = await this.prisma.gameOrganizer.findUnique({
      where: { gameCode_userId: { gameCode, userId: user.id } },
    });
    return !!link && link.active;
  }

  async assertCanManage(user: AuthUser | undefined, gameCode: string): Promise<void> {
    if (!(await this.canManage(user, gameCode))) {
      throw new ForbiddenException('Você não tem permissão para gerenciar este campeonato');
    }
  }

  // Campeonato live é público; draft/blocked só para quem gerencia (os demais veem 404).
  async assertCanView(user: AuthUser | undefined, gameCode: string): Promise<void> {
    const game = await this.prisma.game.findUnique({ where: { code: gameCode }, select: { status: true } });
    if (!game) throw new NotFoundException('Campeonato não encontrado');
    if (game.status === 'live') return;
    if (!(await this.canManage(user, gameCode))) {
      throw new NotFoundException('Campeonato não encontrado');
    }
  }
}
