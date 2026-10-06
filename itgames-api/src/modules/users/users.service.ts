import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { UserRole } from '../../common/enums/role.enum';
import { generateTemporaryPassword } from '../../common/utils/temporary-password';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateOrganizerDto } from './dto/create-organizer.dto';
import { UpdateOrganizerDto } from './dto/update-organizer.dto';

const ORGANIZER_SELECT = {
  id: true,
  name: true,
  email: true,
  phoneNumber: true,
  role: true,
  mustChangePassword: true,
  createdAt: true,
} as const;

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
}
