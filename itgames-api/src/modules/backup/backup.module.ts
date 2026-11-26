import { Module } from '@nestjs/common';
import { BackupService } from './backup.service';
import { BackupController } from './backup.controller';
import { ProgramService } from './program.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [BackupController],
  providers: [BackupService, ProgramService],
  exports: [BackupService],
})
export class BackupModule {}
