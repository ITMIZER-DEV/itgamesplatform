import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/role.enum';
import { UsersService } from './users.service';
import { UpdateAthleteDto } from './dto/update-athlete.dto';

@ApiTags('users')
@ApiBearerAuth()
@Roles(UserRole.SUPER_ADMIN, UserRole.ORGANIZER)
@Controller('users/athletes')
export class AthletesAdminController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @ApiOperation({ summary: 'Super Admin e Organizador: buscar atletas por nome, e-mail ou CPF (CPF mascarado)' })
  async list(@Query('q') q?: string) {
    return this.usersService.listAthletes(q);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Super Admin e Organizador: atualizar dados cadastrais do atleta (nome, email, telefone, sexo, etc.)' })
  async update(@Param('id') id: string, @Body() dto: UpdateAthleteDto) {
    return this.usersService.updateAthlete(id, dto);
  }

  @Post(':id/reset-password')
  @ApiOperation({ summary: 'Super Admin e Organizador: gerar senha temporária para um atleta (mostrada uma única vez)' })
  async resetPassword(@Param('id') id: string) {
    return this.usersService.resetAthletePassword(id);
  }
}
