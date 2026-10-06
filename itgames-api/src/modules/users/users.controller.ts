import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/role.enum';
import { CreateOrganizerDto } from './dto/create-organizer.dto';
import { UpdateOrganizerDto } from './dto/update-organizer.dto';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiBearerAuth()
@Roles(UserRole.SUPER_ADMIN)
@Controller('users/organizers')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @ApiOperation({ summary: 'Super Admin: cadastrar organizador (retorna a senha temporária uma única vez)' })
  async create(@Body() dto: CreateOrganizerDto) {
    return this.usersService.createOrganizer(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Super Admin: listar organizadores' })
  async list() {
    return this.usersService.listOrganizers();
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Super Admin: editar nome, e-mail e telefone de um organizador' })
  async update(@Param('id') id: string, @Body() dto: UpdateOrganizerDto) {
    return this.usersService.updateOrganizer(id, dto);
  }

  @Post(':id/reset-password')
  @ApiOperation({ summary: 'Super Admin: gerar nova senha temporária para um organizador' })
  async resetPassword(@Param('id') id: string) {
    return this.usersService.resetOrganizerPassword(id);
  }
}
