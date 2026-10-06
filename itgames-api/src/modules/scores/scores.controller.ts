import { Body, Controller, Get, Param, Patch, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { GameAccessService } from '../../common/access/game-access.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/role.enum';
import { AuthUser } from '../../common/types/auth-user';
import { CreateScoreDto } from './dto/create-score.dto';
import { ScoresService } from './scores.service';

@ApiTags('Scores & Súmulas')
@ApiBearerAuth()
@Controller('scores')
export class ScoresController {
  constructor(
    private readonly scoresService: ScoresService,
    private readonly access: GameAccessService,
  ) {}

  @Roles(UserRole.JUDGE, UserRole.ORGANIZER)
  @Post()
  @ApiOperation({ summary: 'Lançar ou atualizar score com foto e auditoria' })
  @ApiResponse({ status: 201, description: 'Score processado com sucesso' })
  async createScore(@Body() dto: CreateScoreDto, @CurrentUser() user: AuthUser, @Req() req: Request) {
    if (user.role === UserRole.ORGANIZER) {
      await this.access.assertCanManage(user, dto.game);
    }
    return this.scoresService.createOrUpdateScore(dto, user.name, user.role.toLowerCase(), req.ip);
  }

  @Roles(UserRole.ORGANIZER)
  @Get('game/:gameCode')
  @ApiOperation({ summary: 'Listar scores de uma competição com histórico de auditoria' })
  async getScoresByGame(@Param('gameCode') gameCode: string, @CurrentUser() user: AuthUser) {
    await this.access.assertCanManage(user, gameCode);
    return this.scoresService.findByGame(gameCode);
  }

  @Roles(UserRole.JUDGE, UserRole.ORGANIZER)
  @Patch(':code/photo')
  @ApiOperation({ summary: 'Anexar foto da súmula de campo a um score existente' })
  async attachPhoto(
    @Param('code') code: string,
    @Body('photo') photo: string,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    const scoreCode = Number(code);
    if (user.role === UserRole.ORGANIZER) {
      await this.access.assertCanManage(user, await this.scoresService.getScoreGameCode(scoreCode));
    }
    return this.scoresService.attachPhoto(scoreCode, photo, user.name, user.role.toLowerCase(), req.ip);
  }
}
