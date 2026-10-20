import { Global, Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { ScoringModule } from '../scoring/scoring.module';
import { OfficialController } from './official.controller';
import { OfficialLockService } from './official-lock.service';
import { OfficialService } from './official.service';

// GameAccessService vem do AccessModule e LeaderboardNotifier do LeaderboardModule (ambos globais).
@Global()
@Module({
  imports: [PrismaModule, ScoringModule],
  controllers: [OfficialController],
  providers: [OfficialService, OfficialLockService],
  exports: [OfficialService, OfficialLockService],
})
export class OfficialModule {}
