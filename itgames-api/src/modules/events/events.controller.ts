import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, Req, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Request } from 'express';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { GameAccessService } from '../../common/access/game-access.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/role.enum';
import { AuthUser } from '../../common/types/auth-user';
import { AddOrganizerDto } from './dto/add-organizer.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import {
  CreateCategoryDto,
  CreateGameDto,
  CreateRegistrationDto,
  CreateWorkoutDto,
  EventsService,
} from './events.service';

@ApiTags('events')
@ApiBearerAuth()
@Controller('events')
export class EventsController {
  constructor(
    private readonly eventsService: EventsService,
    private readonly access: GameAccessService,
  ) {}

  // 1. Campeonatos
  @Public()
  @Get()
  @ApiOperation({ summary: 'Listar campeonatos liberados (live) — público' })
  async listGames() {
    return this.eventsService.listPublicGames();
  }

  // Declarada antes de ':code' para não ser capturada como código de campeonato
  @Roles(UserRole.ORGANIZER)
  @Get('mine')
  @ApiOperation({ summary: 'Meus campeonatos (organizador) ou todos (super admin)' })
  async listMyGames(@CurrentUser() user: AuthUser) {
    return this.eventsService.listMyGames(user);
  }

  @Public()
  @Get(':code')
  @ApiOperation({ summary: 'Detalhes do campeonato (draft/blocked só para quem gerencia)' })
  async getGame(@Param('code') code: string, @CurrentUser() user?: AuthUser) {
    return this.eventsService.getGame(code, user);
  }

  @Roles(UserRole.ORGANIZER)
  @Post()
  @ApiOperation({ summary: 'Criar campeonato (nasce em draft)' })
  async createGame(@CurrentUser() user: AuthUser, @Body() dto: CreateGameDto) {
    return this.eventsService.createGame(user, dto);
  }

  @Roles(UserRole.ORGANIZER)
  @Put(':code')
  @ApiOperation({ summary: 'Atualizar dados gerais do campeonato (não altera status)' })
  async updateGame(
    @Param('code') code: string,
    @Body() dto: Partial<CreateGameDto>,
    @CurrentUser() user: AuthUser,
  ) {
    await this.access.assertCanManage(user, code);
    return this.eventsService.updateGame(code, dto);
  }

  @Roles(UserRole.ORGANIZER)
  @Post(':code/banner')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } }))
  @ApiOperation({ summary: 'Enviar a imagem (banner) do campeonato: JPG, PNG ou WebP de até 5 MB' })
  async uploadBanner(
    @Param('code') code: string,
    @UploadedFile() file: { buffer: Buffer } | undefined,
    @CurrentUser() user: AuthUser,
  ) {
    await this.access.assertCanManage(user, code);
    return this.eventsService.saveBanner(code, file);
  }

  @Public()
  @Get(':code/leaderboard')
  @ApiOperation({ summary: 'Dados públicos do leaderboard (equipes ativas e scores homologados, sem dados pessoais)' })
  async getLeaderboard(@Param('code') code: string, @CurrentUser() user?: AuthUser) {
    return this.eventsService.getLeaderboardData(code, user);
  }

  @Roles(UserRole.SUPER_ADMIN)
  @Patch(':code/status')
  @ApiOperation({ summary: 'Super Admin: liberar (live), pausar (draft) ou bloquear (blocked)' })
  async updateGameStatus(@Param('code') code: string, @Body() dto: UpdateStatusDto) {
    return this.eventsService.updateGameStatus(code, dto.status);
  }

  @Roles(UserRole.SUPER_ADMIN)
  @Delete(':code')
  @ApiOperation({ summary: 'Super Admin: excluir campeonato em cascata' })
  async deleteGame(@Param('code') code: string) {
    return this.eventsService.deleteGameCascade(code);
  }

  // 2. Organizadores do campeonato
  @Roles(UserRole.SUPER_ADMIN)
  @Post(':code/organizers')
  @ApiOperation({ summary: 'Super Admin: vincular organizador ao campeonato' })
  async addOrganizer(@Param('code') code: string, @Body() dto: AddOrganizerDto) {
    return this.eventsService.addOrganizer(code, dto.userId);
  }

  @Roles(UserRole.SUPER_ADMIN)
  @Delete(':code/organizers/:userId')
  @ApiOperation({ summary: 'Super Admin: desvincular organizador do campeonato' })
  async removeOrganizer(@Param('code') code: string, @Param('userId') userId: string) {
    return this.eventsService.removeOrganizer(code, userId);
  }

  // 3. Categorias com regras de equipe
  @Public()
  @Get(':code/categories')
  @ApiOperation({ summary: 'Listar categorias de um campeonato' })
  async listCategories(@Param('code') code: string, @CurrentUser() user?: AuthUser) {
    await this.access.assertCanView(user, code);
    return this.eventsService.listCategories(code);
  }

  @Roles(UserRole.ORGANIZER)
  @Post(':code/categories')
  @ApiOperation({ summary: 'Criar categoria com regras de time e idade' })
  async createCategory(@Param('code') code: string, @Body() dto: CreateCategoryDto, @CurrentUser() user: AuthUser) {
    await this.access.assertCanManage(user, code);
    return this.eventsService.createCategory({ ...dto, gamesId: code });
  }

  @Roles(UserRole.ORGANIZER)
  @Put(':code/categories/:catCode')
  @ApiOperation({ summary: 'Atualizar categoria de um campeonato' })
  async updateCategory(
    @Param('code') code: string,
    @Param('catCode') catCode: string,
    @Body() dto: Partial<CreateCategoryDto>,
    @CurrentUser() user: AuthUser,
  ) {
    await this.access.assertCanManage(user, code);
    return this.eventsService.updateCategory(code, parseInt(catCode, 10), dto);
  }

  @Roles(UserRole.ORGANIZER)
  @Delete(':code/categories/:catCode')
  @ApiOperation({ summary: 'Excluir categoria de um campeonato' })
  async deleteCategory(@Param('code') code: string, @Param('catCode') catCode: string, @CurrentUser() user: AuthUser) {
    await this.access.assertCanManage(user, code);
    return this.eventsService.deleteCategory(code, parseInt(catCode, 10));
  }

  // 4. WODs / Workouts
  @Public()
  @Get(':code/workouts')
  @ApiOperation({ summary: 'Listar WODs de um campeonato' })
  async listWorkouts(
    @Param('code') code: string,
    @Query('categoryId') categoryId?: string,
    @CurrentUser() user?: AuthUser,
  ) {
    await this.access.assertCanView(user, code);
    return this.eventsService.listWorkouts(code, categoryId ? parseInt(categoryId, 10) : undefined);
  }

  @Roles(UserRole.ORGANIZER)
  @Post(':code/workouts')
  @ApiOperation({ summary: 'Criar WOD / Workout para categoria' })
  async createWorkout(@Param('code') code: string, @Body() dto: CreateWorkoutDto, @CurrentUser() user: AuthUser) {
    await this.access.assertCanManage(user, code);
    return this.eventsService.createWorkout({ ...dto, game: code });
  }

  // 5. Inscrições
  @Public()
  @Post(':code/registrations')
  @ApiOperation({ summary: 'Inscrição de equipe/atleta (somente em campeonato liberado)' })
  async registerTeam(@Param('code') code: string, @Body() dto: CreateRegistrationDto) {
    return this.eventsService.registerTeam({ ...dto, gameCode: code });
  }

  @Roles(UserRole.ORGANIZER)
  @Get(':code/registrations')
  @ApiOperation({ summary: 'Listar inscrições do evento (organizador do campeonato / super admin)' })
  async listRegistrations(
    @Param('code') code: string,
    @CurrentUser() user: AuthUser,
    @Query('categoryId') categoryId?: string,
  ) {
    await this.access.assertCanManage(user, code);
    return this.eventsService.listRegistrations(code, categoryId ? parseInt(categoryId, 10) : undefined);
  }

  @Roles(UserRole.ORGANIZER)
  @Patch(':code/registrations/:regCode/status')
  @ApiOperation({ summary: 'Atualizar pagamento/check-in ou cancelar uma inscrição (status cancelled anula as súmulas)' })
  async updateRegistrationStatus(
    @Param('code') code: string,
    @Param('regCode') regCode: string,
    @Body() dto: { status?: string; check?: boolean; amount?: number },
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    await this.access.assertCanManage(user, code);
    return this.eventsService.updateRegistrationStatus(code, parseInt(regCode, 10), dto, {
      name: user.name,
      role: user.role.toLowerCase(),
      ip: req.ip,
    });
  }

  @Roles(UserRole.ORGANIZER)
  @Delete(':code/registrations/:regCode')
  @ApiOperation({ summary: 'Excluir inscrição (organizador: só sem scores/baterias; super admin: sempre)' })
  async deleteRegistration(
    @Param('code') code: string,
    @Param('regCode') regCode: string,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    await this.access.assertCanManage(user, code);
    return this.eventsService.deleteRegistration(code, parseInt(regCode, 10), {
      name: user.name,
      role: user.role.toLowerCase(),
      role_is_super_admin: user.role === UserRole.SUPER_ADMIN,
      ip: req.ip,
    });
  }
}
