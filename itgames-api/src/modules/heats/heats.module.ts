import { Module } from '@nestjs/common';
import { HeatsService } from './heats.service';
import { HeatsController } from './heats.controller';

@Module({
  controllers: [HeatsController],
  providers: [HeatsService],
  exports: [HeatsService],
})
export class HeatsModule {}
