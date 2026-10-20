import { Global, Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { ScoringModule } from '../scoring/scoring.module';
import { ScreenNotifier } from './screen-notifier.service';
import { ScreensController } from './screens.controller';
import { ScreensService } from './screens.service';

// GameAccessService vem do AccessModule (global).
@Global()
@Module({
  imports: [PrismaModule, ScoringModule],
  controllers: [ScreensController],
  providers: [ScreensService, ScreenNotifier],
  exports: [ScreensService, ScreenNotifier],
})
export class ScreensModule {}
