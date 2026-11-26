import { BadRequestException, Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { GameAccessService } from '../../common/access/game-access.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/role.enum';
import { AuthUser } from '../../common/types/auth-user';
import { HeatsService } from './heats.service';

@ApiTags('Baterias & Raias')
@ApiBearerAuth()
@Controller('heats')
export class HeatsController {
  constructor(
    private readonly heatsService: HeatsService,
    private readonly access: GameAccessService,
  ) {}

  @Roles(UserRole.ORGANIZER)
  @Post('generate')
  @ApiOperation({ summary: 'Gerar baterias e raias automaticamente com opção de Seeding de Final' })
  async generateHeats(
    @Body()
    body: {
      gameCode: string;
      categoryId: number;
      workoutCode: number;
      totalLanes: number;
      startHour: string;
      intervalMinutes: number;
      isFinalSeeding?: boolean;
    },
    @CurrentUser() user: AuthUser,
  ) {
    await this.access.assertCanManage(user, body.gameCode);
    return this.heatsService.generateHeats(body);
  }

  @Roles(UserRole.ORGANIZER)
  @Post('generate-schedule')
  @ApiOperation({ summary: 'Gerar cronograma real de baterias por blocos sequenciais (1.1/1.2/1.3) e intervalo de 10 min' })
  async generateSchedule(
    @Body()
    body: {
      gameCode: string;
      totalLanes: number;
      startHour: string;
      intervalMinutes?: number;
      subWodRestMinutes?: number;
      categoryTransitionMinutes?: number;
      wodTransitionMinutes?: number;
      minPerHeat?: number;
      categoryId?: number;
      isFinalSeeding?: boolean;
      arenas?: 1 | 2;
      afternoonStart?: string;
      minRestMinutes?: number;
    },
    @CurrentUser() user: AuthUser,
  ) {
    await this.access.assertCanManage(user, body.gameCode);
    return this.heatsService.generateSchedule(body);
  }

  @Roles(UserRole.ORGANIZER)
  @Post('retime-schedule')
  @ApiOperation({
    summary: 'Recalcular só horários e arenas das baterias existentes (1 ou 2 arenas), sem mexer em duplas e raias',
  })
  async retimeSchedule(
    @Body()
    body: {
      gameCode: string;
      arenas: 1 | 2;
      startHour?: string;
      intervalMinutes?: number;
      afternoonStart?: string;
      minRestMinutes?: number;
      apply?: boolean;
    },
    @CurrentUser() user: AuthUser,
  ) {
    await this.access.assertCanManage(user, body.gameCode);
    return this.heatsService.retimeSchedule({ ...body, arenas: Number(body.arenas) === 2 ? 2 : 1 });
  }

  @Roles(UserRole.ORGANIZER)
  @Post('swap-lanes')
  @ApiOperation({ summary: 'Trocar raias entre dois atletas de uma bateria' })
  async swapLanes(@Body() body: { slotIdA: string; slotIdB: string }, @CurrentUser() user: AuthUser) {
    const gameCodeA = await this.heatsService.gameCodeOfSlot(body.slotIdA);
    const gameCodeB = await this.heatsService.gameCodeOfSlot(body.slotIdB);
    if (gameCodeA !== gameCodeB) {
      throw new BadRequestException('As raias a trocar devem pertencer ao mesmo campeonato');
    }
    await this.access.assertCanManage(user, gameCodeA);
    return this.heatsService.swapLanes(body);
  }

  @Public()
  @Get('game/:gameCode/workout/:workoutCode')
  @ApiOperation({ summary: 'Listar baterias por evento e workout (público se o campeonato estiver live)' })
  async getHeats(
    @Param('gameCode') gameCode: string,
    @Param('workoutCode') workoutCode: string,
    @CurrentUser() user?: AuthUser,
  ) {
    await this.access.assertCanView(user, gameCode);
    return this.heatsService.findByGameAndWorkout(gameCode, Number(workoutCode));
  }

  @Roles(UserRole.JUDGE, UserRole.ORGANIZER)
  @Patch(':id/status')
  @ApiOperation({ summary: 'Atualizar status da bateria (scheduled, calling, in_progress, completed)' })
  async updateStatus(@Param('id') id: string, @Body('status') status: string, @CurrentUser() user: AuthUser) {
    const gameCode = await this.heatsService.gameCodeOfHeat(id);
    if (user.role === UserRole.ORGANIZER) {
      await this.access.assertCanManage(user, gameCode);
    }
    return this.heatsService.updateStatus(id, status);
  }
}
