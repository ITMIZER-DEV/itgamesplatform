import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async getAuditLogs(gameCode: string) {
    return this.prisma.auditLog.findMany({
      where: { gameCode },
      include: {
        score: {
          include: {
            registration: true,
          },
        },
      },
      orderBy: { timestamp: 'desc' },
      take: 100,
    });
  }

  async createAuditLog(data: {
    gameCode: string;
    scoreId?: number;
    changedBy: string;
    role: string;
    action: string;
    oldValue?: string;
    newValue?: string;
    reason?: string;
    ipAddress?: string;
  }) {
    return this.prisma.auditLog.create({
      data,
    });
  }
}
