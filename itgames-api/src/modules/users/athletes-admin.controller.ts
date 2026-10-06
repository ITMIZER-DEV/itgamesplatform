import { Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/role.enum';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiBearerAuth()
@Roles(UserRole.SUPER_ADMIN)
@Controller('users/athletes')
export class AthletesAdminController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @ApiOperation({ summary: 'Super Admin: buscar atletas por nome, e-mail ou CPF (CPF mascarado)' })
  async list(@Query('q') q?: string) {
    return this.usersService.listAthletes(q);
  }

  @Post(':id/reset-password')
  @ApiOperation({ summary: 'Super Admin: gerar senha temporária para um atleta (mostrada uma única vez)' })
  async resetPassword(@Param('id') id: string) {
    return this.usersService.resetAthletePassword(id);
  }
}
