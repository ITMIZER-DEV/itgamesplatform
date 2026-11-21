import { Module } from '@nestjs/common';
import { SumulasController } from './sumulas.controller';

@Module({
  controllers: [SumulasController],
})
export class SumulasModule {}
