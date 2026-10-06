import { promises as fs } from 'fs';
import { basename, join } from 'path';
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { GameAccessService } from '../../common/access/game-access.service';
import { UserRole } from '../../common/enums/role.enum';
import { AuthUser } from '../../common/types/auth-user';
import { detectImageExtension, getUploadsDir } from '../../common/utils/uploads';
import { PrismaService } from '../../prisma/prisma.service';

export interface CreateGameDto {
  code: string;
  name: string;
  date?: string;
  description?: string;
  location?: string;
  foto?: string;
  isLowestPointsBetter?: boolean;
  showTime?: boolean;
  showWeight?: boolean;
  showReps?: boolean;
  showScoreRevision?: boolean;
  lanesCount?: number;
  eventType?: string;
  pixKey?: string;
  pixBeneficiary?: string;
}


export interface CreateCategoryDto {
  code: number;
  gamesId: string;
  name: string;
  description?: string;
  standards?: string;
  amount?: number;
  maxAthlete?: number;
  teamType?: string;
  genderRule?: string;
  minIndividualAge?: number;
  maxIndividualAge?: number;
  minTeamSumAge?: number;
  maxTeamSumAge?: number;
}

export interface CreateWorkoutDto {
  code: number;
  game: string;
  category: number;
  title: string;
  type: string;
  timeCap?: string;
  description?: string;
}

export interface CreateRegistrationDto {
  gameCode: string;
  categoryId: number;
  teamName: string;
  status?: string;
  athletes: {
    name: string;
    cpf?: string;
    phonenumber?: string;
    birthDate?: string;
    gender?: 'M' | 'F';
    tshirtSize?: string;
  }[];
}

@Injectable()
export class EventsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: GameAccessService,
  ) {}

  private readonly organizerPublicSelect = { user: { select: { id: true, name: true } } };
  private readonly organizerPrivateSelect = {
    user: { select: { id: true, name: true, email: true, phoneNumber: true } },
  };

  // Troca [{ user }] por [user] para o cliente
  private presentGame<T>(game: T) {
    const { organizers, ...rest } = game as any;
    return { ...rest, organizers: (organizers || []).map((o: any) => o.user) };
  }

  // 1. Organização de Campeonatos (Games)

  // Listagem pública: somente campeonatos liberados (live)
  async listPublicGames() {
    const games = await this.prisma.game.findMany({
      where: { status: 'live' },
      include: {
        categories: true,
        organizers: { select: this.organizerPublicSelect },
        _count: { select: { registrations: true, heats: true } },
      },
      orderBy: { code: 'asc' },
    });
    return games.map((g) => this.presentGame(g));
  }

  // Área restrita: organizador vê os seus (qualquer status); super admin vê todos
  async listMyGames(user: AuthUser) {
    const where = user.role === UserRole.SUPER_ADMIN ? {} : { organizers: { some: { userId: user.id } } };
    const games = await this.prisma.game.findMany({
      where,
      include: {
        categories: true,
        organizers: { select: this.organizerPrivateSelect },
        _count: { select: { registrations: true, heats: true } },
      },
      orderBy: { code: 'asc' },
    });
    return games.map((g) => this.presentGame(g));
  }

  async getGame(code: string, user?: AuthUser) {
    await this.access.assertCanView(user, code);
    const canManage = await this.access.canManage(user, code);

    const game = await this.prisma.game.findUnique({
      where: { code },
      include: {
        organizers: { select: canManage ? this.organizerPrivateSelect : this.organizerPublicSelect },
        categories: {
          include: {
            workouts: true,
            _count: { select: { registrations: true } },
          },
        },
        heats: {
          include: { slots: true },
        },
      },
    });
    if (!game) throw new NotFoundException('Campeonato não encontrado');
    return this.presentGame(game);
  }

  // Todo campeonato nasce em draft; apenas o super admin libera (updateGameStatus).
  async createGame(user: AuthUser, dto: CreateGameDto) {
    if (!dto.code?.trim() || !dto.name?.trim()) {
      throw new BadRequestException('Informe o código e o nome do campeonato');
    }

    const code = dto.code.toUpperCase().trim();
    const existing = await this.prisma.game.findUnique({ where: { code } });
    if (existing) {
      throw new ConflictException('Já existe um campeonato com este código');
    }

    const game = await this.prisma.game.create({
      data: {
        code,
        name: dto.name,
        date: dto.date,
        description: dto.description,
        location: dto.location,
        foto: dto.foto || null,
        status: 'draft',
        isLowestPointsBetter: dto.isLowestPointsBetter ?? false,
        showTime: dto.showTime ?? true,
        showWeight: dto.showWeight ?? true,
        showReps: dto.showReps ?? true,
        showScoreRevision: dto.showScoreRevision ?? false,
        lanesCount: dto.lanesCount || 8,
        eventType: dto.eventType || 'crossfit',
        pixKey: dto.pixKey || null,
        pixBeneficiary: dto.pixBeneficiary || null,
        ...(user.role === UserRole.ORGANIZER && { organizers: { create: [{ userId: user.id }] } }),
      },
      include: { organizers: { select: this.organizerPrivateSelect } },
    });
    return this.presentGame(game);
  }

  // O status não é editável aqui: só o super admin muda via updateGameStatus.
  async updateGame(code: string, dto: Partial<CreateGameDto>) {
    const existing = await this.prisma.game.findUnique({ where: { code } });
    if (!existing) throw new NotFoundException('Campeonato não encontrado');

    return this.prisma.game.update({
      where: { code },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.date !== undefined && { date: dto.date }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.location !== undefined && { location: dto.location }),
        ...(dto.foto !== undefined && { foto: dto.foto }),
        ...(dto.isLowestPointsBetter !== undefined && { isLowestPointsBetter: dto.isLowestPointsBetter }),
        ...(dto.showTime !== undefined && { showTime: dto.showTime }),
        ...(dto.showWeight !== undefined && { showWeight: dto.showWeight }),
        ...(dto.showReps !== undefined && { showReps: dto.showReps }),
        ...(dto.showScoreRevision !== undefined && { showScoreRevision: dto.showScoreRevision }),
        ...(dto.lanesCount !== undefined && { lanesCount: dto.lanesCount }),
        ...(dto.eventType !== undefined && { eventType: dto.eventType }),
        ...(dto.pixKey !== undefined && { pixKey: dto.pixKey }),
        ...(dto.pixBeneficiary !== undefined && { pixBeneficiary: dto.pixBeneficiary }),
      },
    });
  }

  // Super Admin: Liberar ('live'), Pausar ('draft') ou Bloquear ('blocked')
  async updateGameStatus(code: string, status: string) {
    const existing = await this.prisma.game.findUnique({ where: { code } });
    if (!existing) throw new NotFoundException('Campeonato não encontrado');

    return this.prisma.game.update({
      where: { code },
      data: { status },
    });
  }

  // Super Admin: vínculo de organizadores
  async addOrganizer(code: string, userId: string) {
    const game = await this.prisma.game.findUnique({ where: { code } });
    if (!game) throw new NotFoundException('Campeonato não encontrado');

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.role !== UserRole.ORGANIZER) {
      throw new BadRequestException('O usuário informado não é um organizador');
    }

    await this.prisma.gameOrganizer.upsert({
      where: { gameCode_userId: { gameCode: code, userId } },
      update: {},
      create: { gameCode: code, userId },
    });
    return this.listGameOrganizers(code);
  }

  async removeOrganizer(code: string, userId: string) {
    const game = await this.prisma.game.findUnique({ where: { code } });
    if (!game) throw new NotFoundException('Campeonato não encontrado');

    await this.prisma.gameOrganizer.deleteMany({ where: { gameCode: code, userId } });
    return this.listGameOrganizers(code);
  }

  private async listGameOrganizers(code: string) {
    const links = await this.prisma.gameOrganizer.findMany({
      where: { gameCode: code },
      select: this.organizerPrivateSelect,
    });
    return links.map((l) => l.user);
  }

  // Upload da imagem (banner) do campeonato: valida o conteúdo, grava em disco e guarda o caminho
  async saveBanner(code: string, file?: { buffer: Buffer }) {
    if (!file?.buffer) {
      throw new BadRequestException('Envie um arquivo de imagem no campo "file"');
    }
    const game = await this.prisma.game.findUnique({ where: { code }, select: { foto: true } });
    if (!game) throw new NotFoundException('Campeonato não encontrado');

    const ext = detectImageExtension(file.buffer);
    if (!ext) {
      throw new BadRequestException('Formato inválido. Envie uma imagem JPG, PNG ou WebP');
    }

    const dir = join(getUploadsDir(), 'banners');
    await fs.mkdir(dir, { recursive: true });
    const safeCode = code.replace(/[^A-Za-z0-9_-]/g, '_');
    const name = `${safeCode}-${Date.now()}.${ext}`;
    await fs.writeFile(join(dir, name), file.buffer);

    const foto = `/uploads/banners/${name}`;
    await this.prisma.game.update({ where: { code }, data: { foto } });

    // remove a imagem anterior, se era um arquivo enviado por aqui
    if (game.foto?.startsWith('/uploads/banners/')) {
      await fs.unlink(join(dir, basename(game.foto))).catch(() => undefined);
    }
    return { foto };
  }

  // Dados públicos (sem CPF/telefone) para o leaderboard: equipes ativas e scores homologados
  async getLeaderboardData(code: string, user?: AuthUser) {
    await this.access.assertCanView(user, code);

    const game = await this.prisma.game.findUnique({
      where: { code },
      select: { code: true, name: true, eventType: true, isLowestPointsBetter: true, location: true },
    });
    if (!game) throw new NotFoundException('Campeonato não encontrado');

    const [categories, workouts, registrations] = await Promise.all([
      this.prisma.category.findMany({
        where: { gamesId: code },
        select: { code: true, name: true, teamType: true },
        orderBy: { code: 'asc' },
      }),
      this.prisma.workout.findMany({
        where: { game: code },
        select: { code: true, category: true, title: true, type: true, timeCap: true, description: true },
        orderBy: { code: 'asc' },
      }),
      this.prisma.registration.findMany({
        where: { gameCode: code, OR: [{ status: null }, { status: { not: 'cancelled' } }] },
        select: {
          code: true,
          categoryId: true,
          team: true,
          number: true,
          athletes: { select: { name: true }, orderBy: { code: 'asc' } },
        },
        orderBy: { code: 'asc' },
      }),
    ]);

    const activeCodes = registrations.map((r) => r.code);
    const scores = await this.prisma.score.findMany({
      where: {
        game: code,
        codeTeam: { in: activeCodes },
        scoreStatus: { in: ['approved_by_head_judge', 'approved'] },
      },
      select: {
        idEvent: true,
        category: true,
        codeTeam: true,
        time: true,
        weight: true,
        reps: true,
        penaltySeconds: true,
        tieBreakTime: true,
        isWO: true,
      },
      orderBy: { code: 'asc' },
    });

    return {
      game,
      categories,
      workouts,
      teams: registrations.map((r) => ({
        code: r.code,
        categoryId: r.categoryId,
        team: r.team,
        number: r.number,
        athletes: r.athletes.map((a) => a.name),
      })),
      scores,
    };
  }

  // Super Admin: Exclusão em Cascata Completa de Dados do Campeonato
  async deleteGameCascade(code: string) {
    const existing = await this.prisma.game.findUnique({ where: { code } });
    if (!existing) throw new NotFoundException('Campeonato não encontrado para exclusão');

    // Executar exclusão em cascata rigorosa de todas as entidades filhas
    await this.prisma.$transaction(async (tx) => {
      // 1. Audit logs
      await tx.auditLog.deleteMany({ where: { gameCode: code } });
      // 2. Scores
      await tx.score.deleteMany({ where: { game: code } });
      // 3. Lane slots
      await tx.laneSlot.deleteMany({ where: { gameCode: code } });
      // 4. Heats
      await tx.heat.deleteMany({ where: { gameCode: code } });
      // 5. Atletas
      await tx.athlete.deleteMany({ where: { game: code } });
      // 6. Registrations
      await tx.registration.deleteMany({ where: { gameCode: code } });
      // 7. Events (games_events)
      await tx.event.deleteMany({ where: { game: code } });
      // 8. Workouts (games_workout)
      await tx.workout.deleteMany({ where: { game: code } });
      // 9. Categories
      await tx.category.deleteMany({ where: { gamesId: code } });
      // 10. Game
      await tx.game.delete({ where: { code } });
    });

    return {
      success: true,
      message: `Campeonato ${code} e todos os seus dados dependentes foram excluídos com sucesso em cascata.`,
    };
  }

  // 2. Categorias com Regras Avançadas
  async createCategory(dto: CreateCategoryDto) {
    let nextCode = dto.code;
    if (!nextCode) {
      const lastCat = await this.prisma.category.findFirst({
        where: { gamesId: dto.gamesId },
        orderBy: { code: 'desc' },
      });
      nextCode = (lastCat?.code || 0) + 1;
    }

    return this.prisma.category.create({
      data: {
        code: nextCode,
        gamesId: dto.gamesId,
        name: dto.name,
        description: dto.description,
        standards: dto.standards,
        amount: dto.amount !== undefined ? Number(dto.amount) : 0,
        maxAthlete: dto.maxAthlete !== undefined ? Number(dto.maxAthlete) : 1,
        teamType: dto.teamType || 'individual',
        genderRule: dto.genderRule || 'open',
        minIndividualAge: dto.minIndividualAge ? Number(dto.minIndividualAge) : null,
        maxIndividualAge: dto.maxIndividualAge ? Number(dto.maxIndividualAge) : null,
        minTeamSumAge: dto.minTeamSumAge ? Number(dto.minTeamSumAge) : null,
        maxTeamSumAge: dto.maxTeamSumAge ? Number(dto.maxTeamSumAge) : null,
      },
    });
  }

  async updateCategory(gamesId: string, categoryCode: number, dto: Partial<CreateCategoryDto>) {
    const existing = await this.prisma.category.findUnique({
      where: {
        code_gamesId: {
          code: categoryCode,
          gamesId,
        },
      },
    });

    if (!existing) {
      throw new NotFoundException(`Categoria #${categoryCode} do campeonato ${gamesId} não encontrada`);
    }

    const data: any = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.standards !== undefined) data.standards = dto.standards;
    if (dto.amount !== undefined) data.amount = Number(dto.amount);
    if (dto.maxAthlete !== undefined) data.maxAthlete = Number(dto.maxAthlete);
    if (dto.teamType !== undefined) data.teamType = dto.teamType;
    if (dto.genderRule !== undefined) data.genderRule = dto.genderRule;
    if (dto.minIndividualAge !== undefined) data.minIndividualAge = dto.minIndividualAge ? Number(dto.minIndividualAge) : null;
    if (dto.maxIndividualAge !== undefined) data.maxIndividualAge = dto.maxIndividualAge ? Number(dto.maxIndividualAge) : null;
    if (dto.minTeamSumAge !== undefined) data.minTeamSumAge = dto.minTeamSumAge ? Number(dto.minTeamSumAge) : null;
    if (dto.maxTeamSumAge !== undefined) data.maxTeamSumAge = dto.maxTeamSumAge ? Number(dto.maxTeamSumAge) : null;

    return this.prisma.category.update({
      where: {
        code_gamesId: {
          code: categoryCode,
          gamesId,
        },
      },
      data,
    });
  }

  async deleteCategory(gamesId: string, categoryCode: number) {
    return this.prisma.category.delete({
      where: {
        code_gamesId: {
          code: categoryCode,
          gamesId,
        },
      },
    });
  }

  async listCategories(gamesId: string) {
    return this.prisma.category.findMany({
      where: { gamesId },
      include: {
        workouts: true,
        _count: { select: { registrations: true } },
      },
      orderBy: { code: 'asc' },
    });
  }

  async createWorkout(dto: CreateWorkoutDto) {
    const workout = await this.prisma.workout.create({
      data: {
        code: dto.code,
        game: dto.game,
        category: dto.category,
        title: dto.title,
        type: dto.type,
        timeCap: dto.timeCap,
        description: dto.description,
      },
    });

    await this.prisma.event.upsert({
      where: {
        idEvent_game: {
          idEvent: dto.code,
          game: dto.game,
        },
      },
      update: {
        title: dto.title,
        description: dto.description,
        category: dto.category,
        workout: dto.code,
      },
      create: {
        idEvent: dto.code,
        game: dto.game,
        category: dto.category,
        title: dto.title,
        description: dto.description,
        workout: dto.code,
      },
    });

    return workout;
  }

  async listWorkouts(game: string, categoryId?: number) {
    return this.prisma.workout.findMany({
      where: {
        game,
        ...(categoryId && { category: categoryId }),
      },
      orderBy: { code: 'asc' },
    });
  }

  // 4. Inscrições com Validação Rigorosa de Regras de Time e Faixa Etária
  async registerTeam(dto: CreateRegistrationDto) {
    const game = await this.prisma.game.findUnique({
      where: { code: dto.gameCode },
      select: { status: true },
    });
    if (!game) {
      throw new NotFoundException('Campeonato não encontrado');
    }
    if (game.status !== 'live') {
      throw new BadRequestException('Inscrições indisponíveis: campeonato não liberado');
    }

    const category = await this.prisma.category.findUnique({
      where: {
        code_gamesId: {
          code: dto.categoryId,
          gamesId: dto.gameCode,
        },
      },
    });

    if (!category) {
      throw new NotFoundException('Categoria não encontrada');
    }

    // Validação de contagem de atletas
    if (category.maxAthlete && dto.athletes.length !== category.maxAthlete) {
      throw new BadRequestException(
        `Esta categoria exige exatamente ${category.maxAthlete} atleta(s). Você enviou ${dto.athletes.length}.`,
      );
    }

    // Cálculo das idades
    const currentYear = new Date().getFullYear();
    const athleteAges = dto.athletes.map((a) => {
      if (!a.birthDate) return 25; // fallback se não preenchido
      const birth = new Date(a.birthDate);
      let age = currentYear - birth.getFullYear();
      return age;
    });

    // 1. Validação de Soma de Idades (Ex: Master 110+)
    if (category.minTeamSumAge) {
      const sumAge = athleteAges.reduce((acc, age) => acc + age, 0);
      if (sumAge < category.minTeamSumAge) {
        throw new BadRequestException(
          `A soma das idades dos atletas (${sumAge} anos) não atinge o mínimo exigido de ${category.minTeamSumAge} anos para a categoria ${category.name}.`,
        );
      }
    }

    // 2. Validação de Idade Mínima Individual (Ex: Master 35+)
    if (category.minIndividualAge) {
      const underAge = athleteAges.some((age) => age < (category.minIndividualAge as number));
      if (underAge) {
        throw new BadRequestException(
          `Todos os atletas devem ter no mínimo ${category.minIndividualAge} anos de idade.`,
        );
      }
    }

    // 3. Validação de Idade Máxima Individual (Ex: Teen até 18)
    if (category.maxIndividualAge) {
      const overAge = athleteAges.some((age) => age > (category.maxIndividualAge as number));
      if (overAge) {
        throw new BadRequestException(
          `Atletas desta categoria devem ter no máximo ${category.maxIndividualAge} anos.`,
        );
      }
    }

    // 4. Validação de Gênero da Equipe
    if (category.genderRule === 'mixed_1m_1f') {
      const males = dto.athletes.filter((a) => a.gender === 'M').length;
      const females = dto.athletes.filter((a) => a.gender === 'F').length;
      if (males !== 1 || females !== 1) {
        throw new BadRequestException('A categoria exige exatamente 1 atleta masculino e 1 atleta feminino.');
      }
    } else if (category.genderRule === 'mixed_2m_2f') {
      const males = dto.athletes.filter((a) => a.gender === 'M').length;
      const females = dto.athletes.filter((a) => a.gender === 'F').length;
      if (males !== 2 || females !== 2) {
        throw new BadRequestException('A categoria exige exatamente 2 atletas masculinos e 2 femininos.');
      }
    } else if (category.genderRule === 'male') {
      const hasFemale = dto.athletes.some((a) => a.gender === 'F');
      if (hasFemale) {
        throw new BadRequestException('Esta categoria é exclusiva para atletas masculinos.');
      }
    } else if (category.genderRule === 'female') {
      const hasMale = dto.athletes.some((a) => a.gender === 'M');
      if (hasMale) {
        throw new BadRequestException('Esta categoria é exclusiva para atletas femininos.');
      }
    }

    // Gera o código de inscrição onde o 1º dígito é o código da categoria e os 3 seguintes são randômicos únicos
    const existingRegistrations = await this.prisma.registration.findMany({
      where: { gameCode: dto.gameCode },
      select: { code: true, number: true },
    });

    const existingCodes = new Set(existingRegistrations.map((r) => r.code));
    const catPrefix = Number(dto.categoryId) || 1;
    let uniqueCode = catPrefix * 1000 + Math.floor(100 + Math.random() * 900);

    // Garante 3 dígitos randômicos não repetíveis
    for (let attempt = 0; attempt < 1000; attempt++) {
      const random3 = Math.floor(100 + Math.random() * 900);
      const candidateCode = catPrefix * 1000 + random3;
      if (!existingCodes.has(candidateCode)) {
        uniqueCode = candidateCode;
        break;
      }
    }

    const registration = await this.prisma.registration.create({
      data: {
        code: uniqueCode,
        gameCode: dto.gameCode,
        categoryId: dto.categoryId,
        team: dto.teamName,
        amount: category.amount || 0,
        status: 'pending', // pagamento só é confirmado pelo organizador (PATCH .../registrations/:regCode/status)
        number: `#${uniqueCode}`,
        athletes: {
          create: dto.athletes.map((a, idx) => ({
            code: idx + 1,
            name: a.name,
            cpf: a.cpf ? a.cpf.replace(/\D/g, '') : null,
            phonenumber: a.phonenumber,
            category: dto.categoryId,
            tshirtSize: a.tshirtSize || 'M',
            gender: a.gender || 'M',
            birthDate: a.birthDate ? new Date(a.birthDate) : null,
          })),
        },
      },
      include: {
        athletes: true,
        category: true,
      },
    });

    return {
      success: true,
      message: 'Inscrição confirmada com sucesso!',
      registration,
      pixQrCode: `00020126580014BR.GOV.BCB.PIX0136${dto.gameCode}-${uniqueCode}520400005303986540${category.amount}5802BR5915ITGAMES ARENA6009SAO PAULO62070503***6304ABCD`,
    };
  }

  async listRegistrations(gameCode: string, categoryId?: number) {
    return this.prisma.registration.findMany({
      where: {
        gameCode,
        ...(categoryId && { categoryId }),
      },
      include: {
        athletes: true,
        category: true,
      },
      orderBy: { code: 'asc' },
    });
  }

  async updateRegistrationStatus(
    gameCode: string,
    registrationCode: number,
    dto: { status?: string; check?: boolean; amount?: number },
    actor: { name: string; role: string; ip?: string },
  ) {
    const existing = await this.prisma.registration.findUnique({
      where: { code_gameCode: { code: registrationCode, gameCode } },
    });

    if (!existing) {
      throw new NotFoundException(`Inscrição #${registrationCode} do campeonato ${gameCode} não encontrada`);
    }

    const data: any = {};
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.check !== undefined) data.check = dto.check;
    if (dto.amount !== undefined) data.amount = Number(dto.amount);

    const cancelling = dto.status === 'cancelled' && existing.status !== 'cancelled';

    return this.prisma.$transaction(async (tx) => {
      if (cancelling) {
        // sai das baterias e as súmulas são anuladas (mantidas como histórico, com auditoria)
        await tx.laneSlot.deleteMany({ where: { gameCode, teamCode: registrationCode } });
        const scores = await tx.score.findMany({
          where: {
            game: gameCode,
            codeTeam: registrationCode,
            OR: [{ scoreStatus: null }, { scoreStatus: { not: 'voided' } }],
          },
        });
        for (const sc of scores) {
          await tx.score.update({ where: { code: sc.code }, data: { scoreStatus: 'voided' } });
          await tx.auditLog.create({
            data: {
              gameCode,
              scoreId: sc.code,
              changedBy: actor.name,
              role: actor.role,
              action: 'void',
              oldValue: sc.scoreStatus,
              newValue: 'voided',
              reason: 'Inscrição cancelada: súmula anulada',
              ipAddress: actor.ip,
            },
          });
        }
      }

      return tx.registration.update({
        where: { code_gameCode: { code: registrationCode, gameCode } },
        data,
        include: { athletes: true, category: true },
      });
    });
  }

  // Organizador só exclui inscrição sem scores nem baterias; o super admin pode excluir sempre.
  async deleteRegistration(
    gameCode: string,
    registrationCode: number,
    actor: { name: string; role: string; role_is_super_admin: boolean; ip?: string },
  ) {
    const existing = await this.prisma.registration.findUnique({
      where: { code_gameCode: { code: registrationCode, gameCode } },
    });
    if (!existing) {
      throw new NotFoundException(`Inscrição #${registrationCode} do campeonato ${gameCode} não encontrada`);
    }

    const [scores, slots] = await Promise.all([
      this.prisma.score.count({ where: { game: gameCode, codeTeam: registrationCode } }),
      this.prisma.laneSlot.count({ where: { gameCode, teamCode: registrationCode } }),
    ]);
    if ((scores > 0 || slots > 0) && !actor.role_is_super_admin) {
      throw new ConflictException(
        'Esta inscrição já tem scores ou está em bateria. Cancele a inscrição ou peça ao Super Admin para excluir.',
      );
    }

    // Atletas, scores e vagas em bateria saem por cascata; os logs de auditoria permanecem.
    await this.prisma.$transaction([
      this.prisma.auditLog.create({
        data: {
          gameCode,
          changedBy: actor.name,
          role: actor.role,
          action: 'registration_deleted',
          oldValue: `#${registrationCode} ${existing.team}`,
          reason: `Inscrição excluída (scores: ${scores}, baterias: ${slots})`,
          ipAddress: actor.ip,
        },
      }),
      this.prisma.registration.delete({ where: { code_gameCode: { code: registrationCode, gameCode } } }),
    ]);

    return { success: true, message: `Inscrição #${registrationCode} excluída` };
  }
}
