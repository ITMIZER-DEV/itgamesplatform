import { Global, Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { GameAccessService } from './game-access.service';

@Global()
@Module({
  imports: [PrismaModule],
  providers: [GameAccessService],
  exports: [GameAccessService],
})
export class AccessModule {}
