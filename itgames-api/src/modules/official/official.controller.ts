import { Body, Controller, Get, HttpCode, Param, ParseIntPipe, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/role.enum';
import { AuthUser } from '../../common/types/auth-user';
import { RevertOfficialDto } from './dto/official.dto';
import { OfficialService } from './official.service';

@ApiTags('official')
@ApiBearerAuth()
@Controller('official')
export class OfficialController {
  constructor(private readonly official: OfficialService) {}

  @Roles(UserRole.ORGANIZER)
  @Get(':code')
  @ApiOperation({ summary: 'Situação do cálculo oficial por categoria e WOD' })
  status(@CurrentUser() user: AuthUser, @Param('code') code: string) {
    return this.official.status(code, user);
  }

  @Roles(UserRole.ORGANIZER)
  @Get(':code/history')
  @ApiOperation({ summary: 'Histórico das confirmações e reversões' })
  history(@CurrentUser() user: AuthUser, @Param('code') code: string) {
    return this.official.history(code, user);
  }

  @Roles(UserRole.ORGANIZER)
  @Get(':code/categories/:categoryId/events/:eventId/preview')
  @ApiOperation({ summary: 'Prévia do cálculo oficial (com pontos; nada é gravado)' })
  preview(
    @CurrentUser() user: AuthUser,
    @Param('code') code: string,
    @Param('categoryId', ParseIntPipe) categoryId: number,
    @Param('eventId', ParseIntPipe) eventId: number,
  ) {
    return this.official.preview(code, categoryId, eventId, user);
  }

  @Roles(UserRole.ORGANIZER)
  @Post(':code/categories/:categoryId/events/:eventId/confirm')
  @HttpCode(200)
  @ApiOperation({ summary: 'Confirmar o cálculo oficial do WOD na categoria' })
  confirm(
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
    @Param('code') code: string,
    @Param('categoryId', ParseIntPipe) categoryId: number,
    @Param('eventId', ParseIntPipe) eventId: number,
  ) {
    return this.official.confirm(code, categoryId, eventId, user, req.ip);
  }

  @Roles(UserRole.ORGANIZER)
  @Post(':code/categories/:categoryId/events/:eventId/revert')
  @HttpCode(200)
  @ApiOperation({ summary: 'Reverter o cálculo oficial (exige motivo)' })
  revert(
    @CurrentUser() user: AuthUser,
    @Param('code') code: string,
    @Param('categoryId', ParseIntPipe) categoryId: number,
    @Param('eventId', ParseIntPipe) eventId: number,
    @Body() dto: RevertOfficialDto,
  ) {
    return this.official.revert(code, categoryId, eventId, dto?.reason, user);
  }
}
