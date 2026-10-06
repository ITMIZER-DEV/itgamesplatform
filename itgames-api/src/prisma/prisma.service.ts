import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    try {
      await this.$connect();
      console.log('✅ Prisma conectado ao banco PostgreSQL');
    } catch (e) {
      console.warn('⚠️ Prisma não conectou ao banco no bootstrap (modo offline/lazy)', e.message);
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
