import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { BoardService } from './board.service';

// GameAccessService vem do AccessModule (global).
@Module({
  imports: [PrismaModule],
  providers: [BoardService],
  exports: [BoardService],
})
export class ScoringModule {}
