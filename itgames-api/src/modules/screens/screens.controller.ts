import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/role.enum';
import { AuthUser } from '../../common/types/auth-user';
import { ClaimScreenDto, FreezeScreenDto, UpdateScreenDto } from './dto/screens.dto';
import { ScreensService } from './screens.service';

@ApiTags('screens')
@ApiBearerAuth()
@Controller('screens')
export class ScreensController {
  constructor(private readonly screens: ScreensService) {}

  @Public()
  @Post('pairing')
  @ApiOperation({ summary: 'TV pede um código de pareamento (público, limitado por IP)' })
  createPairing(@Req() req: Request) {
    return this.screens.createPairing(req.ip ?? '');
  }

  @Public()
  @Get('pairing/:pairingId')
  @ApiOperation({ summary: 'TV consulta o pareamento; a credencial sai uma única vez' })
  pollPairing(@Param('pairingId') pairingId: string) {
    return this.screens.pollPairing(pairingId);
  }

  @Roles(UserRole.ORGANIZER)
  @Post('claim')
  @HttpCode(201)
  @ApiOperation({ summary: 'Resgatar o código mostrado na TV e configurar o telão' })
  claim(@CurrentUser() user: AuthUser, @Body() dto: ClaimScreenDto) {
    return this.screens.claim(user, dto);
  }

  @Roles(UserRole.ORGANIZER)
  @Get()
  @ApiOperation({ summary: 'Meus telões (todos para o super admin)' })
  list(@CurrentUser() user: AuthUser) {
    return this.screens.list(user);
  }

  // Declaradas antes de ':id' para não serem capturadas como id.
  @Roles(UserRole.ORGANIZER)
  @Post('freeze-all')
  @HttpCode(200)
  @ApiOperation({ summary: 'Congelar todos os telões que o usuário controla' })
  freezeAll(@CurrentUser() user: AuthUser, @Body() dto: FreezeScreenDto) {
    return this.screens.freezeAll(user, dto.text);
  }

  @Roles(UserRole.ORGANIZER)
  @Post('unfreeze-all')
  @HttpCode(200)
  @ApiOperation({ summary: 'Descongelar todos os telões que o usuário controla' })
  unfreezeAll(@CurrentUser() user: AuthUser) {
    return this.screens.unfreezeAll(user);
  }

  @Roles(UserRole.ORGANIZER)
  @Patch(':id')
  @ApiOperation({ summary: 'Editar nome, campeonatos, modo ou tempo de rotação' })
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateScreenDto) {
    return this.screens.update(user, id, dto);
  }

  @Roles(UserRole.ORGANIZER)
  @Post(':id/freeze')
  @HttpCode(200)
  @ApiOperation({ summary: 'Congelar o telão com os placares atuais' })
  freeze(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: FreezeScreenDto) {
    return this.screens.freeze(user, id, dto.text);
  }

  @Roles(UserRole.ORGANIZER)
  @Post(':id/unfreeze')
  @HttpCode(200)
  @ApiOperation({ summary: 'Descongelar o telão' })
  unfreeze(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.screens.unfreeze(user, id);
  }

  @Roles(UserRole.ORGANIZER)
  @Delete(':id')
  @HttpCode(200)
  @ApiOperation({ summary: 'Remover o telão (a TV volta ao pareamento)' })
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.screens.remove(user, id);
  }
}
