import { Module } from '@nestjs/common';
import { EventsService } from './events.service';
import { EventsController } from './events.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { ScoringModule } from '../scoring/scoring.module';

@Module({
  imports: [PrismaModule, ScoringModule],
  controllers: [EventsController],
  providers: [EventsService],
  exports: [EventsService],
})
export class EventsModule {}
