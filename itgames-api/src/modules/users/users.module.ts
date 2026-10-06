import { Module } from '@nestjs/common';
import { AthletesAdminController } from './athletes-admin.controller';
import { AthletesController } from './athletes.controller';
import { AthletesService } from './athletes.service';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  controllers: [UsersController, AthletesController, AthletesAdminController],
  providers: [UsersService, AthletesService],
})
export class UsersModule {}
