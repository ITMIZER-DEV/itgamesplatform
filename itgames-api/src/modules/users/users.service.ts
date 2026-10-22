import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { UserRole } from '../../common/enums/role.enum';
import { isValidCpf, maskCpf, normalizeCpf } from '../../common/utils/cpf';
import { generateTemporaryPassword } from '../../common/utils/temporary-password';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateOrganizerDto } from './dto/create-organizer.dto';
import { UpdateOrganizerDto } from './dto/update-organizer.dto';
import { UpdateAthleteDto } from './dto/update-athlete.dto';

const ORGANIZER_SELECT = {
  id: true,
  name: true,
  email: true,
  phoneNumber: true,
  role: true,
  mustChangePassword: true,
  createdAt: true,
} as const;

const ATHLETE_SELECT = {
  id: true,
  name: true,
  email: true,
  phoneNumber: true,
  cpf: true,
  mustChangePassword: true,
  createdAt: true,
  athleteProfile: {
    select: {
      gender: true,
      birthDate: true,
      tshirtSize: true,
      boxOrGym: true,
    },
  },
} as const;

// Identifica o atleta pelos últimos dígitos do CPF e expõe dados de perfil para governança
function presentAthlete<T extends { cpf: string | null; athleteProfile?: any }>(user: T) {
  const { cpf, athleteProfile, ...rest } = user;
  return {
    ...rest,
    cpfMasked: cpf ? maskCpf(cpf) : null,
    cpfRaw: cpf,
    gender: athleteProfile?.gender || null,
    birthDate: athleteProfile?.birthDate || null,
    tshirtSize: athleteProfile?.tshirtSize || null,
    boxOrGym: athleteProfile?.boxOrGym || null,
  };
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async createOrganizer(dto: CreateOrganizerDto) {
    const email = dto.email.toLowerCase().trim();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException('Já existe um usuário cadastrado com este e-mail');
    }

    const temporaryPassword = generateTemporaryPassword();
    const user = await this.prisma.user.create({
      data: {
        email,
        name: dto.name.trim(),
        phoneNumber: dto.phoneNumber.trim(),
        role: UserRole.ORGANIZER,
        passwordHash: await bcrypt.hash(temporaryPassword, 10),
        mustChangePassword: true,
      },
      select: ORGANIZER_SELECT,
    });

    return { user, temporaryPassword };
  }

  async listOrganizers() {
    return this.prisma.user.findMany({
      where: { role: UserRole.ORGANIZER },
      select: { ...ORGANIZER_SELECT, _count: { select: { organizedGames: true } } },
      orderBy: { name: 'asc' },
    });
  }

  async updateOrganizer(id: string, dto: UpdateOrganizerDto) {
    const existing = await this.prisma.user.findFirst({ where: { id, role: UserRole.ORGANIZER } });
    if (!existing) {
      throw new NotFoundException('Organizador não encontrado');
    }

    const email = dto.email?.toLowerCase();
    if (email && email !== existing.email) {
      const taken = await this.prisma.user.findUnique({ where: { email } });
      if (taken) {
        throw new ConflictException('Já existe um usuário cadastrado com este e-mail');
      }
    }

    return this.prisma.user.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(email !== undefined && { email }),
        ...(dto.phoneNumber !== undefined && { phoneNumber: dto.phoneNumber }),
      },
      select: ORGANIZER_SELECT,
    });
  }

  // Busca por nome, e-mail ou CPF (com ou sem pontuação); sem termo, lista os primeiros 50
  async listAthletes(q?: string) {
    const term = (q ?? '').trim();
    const digits = normalizeCpf(term);
    const users = await this.prisma.user.findMany({
      where: {
        role: UserRole.ATHLETE,
        ...(term && {
          OR: [
            { name: { contains: term, mode: 'insensitive' as const } },
            { email: { contains: term, mode: 'insensitive' as const } },
            ...(digits.length >= 3 ? [{ cpf: { contains: digits } }] : []),
          ],
        }),
      },
      select: ATHLETE_SELECT,
      orderBy: { name: 'asc' },
      take: 50,
    });
    return users.map(presentAthlete);
  }

  async resetAthletePassword(id: string) {
    const existing = await this.prisma.user.findFirst({ where: { id, role: UserRole.ATHLETE } });
    if (!existing) {
      throw new NotFoundException('Atleta não encontrado');
    }

    const temporaryPassword = generateTemporaryPassword();
    const user = await this.prisma.user.update({
      where: { id },
      data: {
        passwordHash: await bcrypt.hash(temporaryPassword, 10),
        mustChangePassword: true,
      },
      select: ATHLETE_SELECT,
    });

    return { user: presentAthlete(user), temporaryPassword };
  }

  async resetOrganizerPassword(id: string) {
    const existing = await this.prisma.user.findFirst({ where: { id, role: UserRole.ORGANIZER } });
    if (!existing) {
      throw new NotFoundException('Organizador não encontrado');
    }

    const temporaryPassword = generateTemporaryPassword();
    const user = await this.prisma.user.update({
      where: { id },
      data: {
        passwordHash: await bcrypt.hash(temporaryPassword, 10),
        mustChangePassword: true,
      },
      select: ORGANIZER_SELECT,
    });

    return { user, temporaryPassword };
  }

  async updateAthlete(id: string, dto: UpdateAthleteDto) {
    const existing = await this.prisma.user.findFirst({
      where: { id, role: UserRole.ATHLETE },
      include: { athleteProfile: true },
    });
    if (!existing) {
      throw new NotFoundException('Atleta não encontrado');
    }

    const email = dto.email?.toLowerCase().trim();
    if (email && email !== existing.email) {
      const taken = await this.prisma.user.findUnique({ where: { email } });
      if (taken) {
        throw new ConflictException('Já existe um usuário cadastrado com este e-mail');
      }
    }

    const cpf = dto.cpf ? normalizeCpf(dto.cpf) : undefined;
    if (cpf) {
      if (!isValidCpf(cpf)) {
        throw new BadRequestException('CPF inválido');
      }
      if (cpf !== existing.cpf) {
        const taken = await this.prisma.user.findFirst({ where: { cpf, id: { not: id } } });
        if (taken) {
          throw new ConflictException('Já existe um usuário cadastrado com este CPF');
        }
      }
    }

    const userData: any = {};
    if (dto.name !== undefined) userData.name = dto.name.trim();
    if (email !== undefined) userData.email = email;
    if (dto.phoneNumber !== undefined) userData.phoneNumber = dto.phoneNumber.trim();
    if (cpf !== undefined) userData.cpf = cpf;

    if (Object.keys(userData).length > 0) {
      await this.prisma.user.update({
        where: { id },
        data: userData,
      });
    }

    const profileData: any = {};
    if (dto.gender !== undefined) {
      const g = dto.gender.toUpperCase();
      if (g === 'M' || g === 'F') profileData.gender = g;
    }
    if (dto.birthDate !== undefined) {
      profileData.birthDate = dto.birthDate ? new Date(dto.birthDate) : null;
    }
    if (dto.tshirtSize !== undefined) profileData.tshirtSize = dto.tshirtSize.trim().toUpperCase();
    if (dto.boxOrGym !== undefined) profileData.boxOrGym = dto.boxOrGym.trim();

    if (Object.keys(profileData).length > 0) {
      await this.prisma.athleteProfile.upsert({
        where: { userId: id },
        create: {
          userId: id,
          ...profileData,
        },
        update: profileData,
      });
    }

    const updated = await this.prisma.user.findUnique({
      where: { id },
      select: ATHLETE_SELECT,
    });
    return presentAthlete(updated!);
  }
}
