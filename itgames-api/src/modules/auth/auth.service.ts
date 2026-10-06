import { BadRequestException, ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UserRole } from '../../common/enums/role.enum';
import { PrismaService } from '../../prisma/prisma.service';
import { ChangePasswordDto } from './dto/change-password.dto';

export interface RegisterDto {
  email: string;
  password: string;
  name: string;
  cpf?: string;
  phoneNumber?: string;
  birthDate?: string;
  gender?: string;
  boxOrGym?: string;
  tshirtSize?: string;
  emergencyContact?: string;
  emergencyPhone?: string;
}

export interface LoginDto {
  email: string;
  password: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  // Cadastro público: sempre cria ATHLETE. Organizadores são criados pelo super admin.
  async register(dto: RegisterDto) {
    if (!dto.email || !dto.password || !dto.name) {
      throw new BadRequestException('Informe nome, e-mail e senha');
    }

    const email = dto.email.toLowerCase().trim();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException('Já existe um usuário cadastrado com este e-mail');
    }

    if (dto.cpf) {
      const existingCpf = await this.prisma.user.findUnique({
        where: { cpf: dto.cpf.replace(/\D/g, '') },
      });
      if (existingCpf) {
        throw new ConflictException('Já existe um usuário cadastrado com este CPF');
      }
    }

    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash: await bcrypt.hash(dto.password, 10),
        name: dto.name,
        cpf: dto.cpf ? dto.cpf.replace(/\D/g, '') : null,
        phoneNumber: dto.phoneNumber,
        role: UserRole.ATHLETE,
        athleteProfile: {
          create: {
            birthDate: dto.birthDate ? new Date(dto.birthDate) : null,
            gender: dto.gender || 'M',
            boxOrGym: dto.boxOrGym || '',
            tshirtSize: dto.tshirtSize || 'M',
            emergencyContact: dto.emergencyContact || null,
            emergencyPhone: dto.emergencyPhone || null,
            termsAccepted: true,
          },
        },
      },
      include: { athleteProfile: true },
    });

    return this.buildAuthResponse(user);
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: (dto.email || '').toLowerCase().trim() },
      include: { athleteProfile: true },
    });

    if (!user || !(await bcrypt.compare(dto.password || '', user.passwordHash))) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    return this.buildAuthResponse(user);
  }

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        athleteProfile: true,
        organizedGames: {
          include: { game: { select: { code: true, name: true, status: true } } },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('Usuário não encontrado');
    }

    const { passwordHash, ...sanitized } = user;
    return sanitized;
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { athleteProfile: true },
    });
    if (!user) {
      throw new UnauthorizedException('Usuário não encontrado');
    }

    // 400 (e não 401): o frontend trata 401 como sessão expirada
    if (!(await bcrypt.compare(dto.currentPassword, user.passwordHash))) {
      throw new BadRequestException('Senha atual incorreta');
    }
    if (dto.currentPassword === dto.newPassword) {
      throw new BadRequestException('A nova senha deve ser diferente da atual');
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash: await bcrypt.hash(dto.newPassword, 10),
        mustChangePassword: false,
      },
      include: { athleteProfile: true },
    });

    return this.buildAuthResponse(updated);
  }

  private buildAuthResponse(user: any) {
    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        cpf: user.cpf,
        phoneNumber: user.phoneNumber,
        mustChangePassword: user.mustChangePassword,
        athleteProfile: user.athleteProfile ?? null,
      },
      accessToken: this.jwtService.sign({
        sub: user.id,
        email: user.email,
        role: user.role,
        name: user.name,
      }),
    };
  }
}
