import { BadRequestException, ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'crypto';
import { UserRole } from '../../common/enums/role.enum';
import { isValidCpf, normalizeCpf } from '../../common/utils/cpf';
import { RateLimiter } from '../../common/utils/rate-limit';
import { PrismaService } from '../../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

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
  private readonly resetLimiter = new RateLimiter();

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly mail: MailService,
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

    // O CPF identifica o atleta nas inscrições de equipe, então é obrigatório e precisa ser válido
    const cpf = normalizeCpf(dto.cpf);
    if (!isValidCpf(cpf)) {
      throw new BadRequestException('Informe um CPF válido');
    }
    const existingCpf = await this.prisma.user.findUnique({ where: { cpf } });
    if (existingCpf) {
      throw new ConflictException('Já existe um usuário cadastrado com este CPF');
    }

    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash: await bcrypt.hash(dto.password, 10),
        name: dto.name,
        cpf,
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
    // O interceptor de LGPD mascara a chave "cpf" em toda resposta; o dono vê o próprio CPF inteiro em ownCpf
    return { ...sanitized, ownCpf: user.cpf ?? null };
  }

  private static readonly PROFILE_FIELDS = ['birthDate', 'gender', 'tshirtSize', 'boxOrGym'] as const;

  // "Meu perfil": nome, telefone, CPF (uma única vez) e dados de atleta. E-mail e papel não mudam por aqui.
  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('Usuário não encontrado');

    const userData: { name?: string; phoneNumber?: string | null; cpf?: string } = {};

    if (dto.name !== undefined) {
      const name = dto.name.trim();
      if (!name) throw new BadRequestException('Informe o nome');
      userData.name = name;
    }
    if (dto.phoneNumber !== undefined) userData.phoneNumber = dto.phoneNumber.trim() || null;

    if (dto.cpf !== undefined && dto.cpf.trim() !== '') {
      const cpf = normalizeCpf(dto.cpf);
      if (!isValidCpf(cpf)) throw new BadRequestException('CPF inválido');
      if (user.cpf && user.cpf !== cpf) {
        throw new BadRequestException(
          'O CPF não pode ser alterado depois de cadastrado. Fale com a organização se precisar corrigir.',
        );
      }
      if (!user.cpf) {
        const taken = await this.prisma.user.findUnique({ where: { cpf } });
        if (taken) throw new ConflictException('Já existe um usuário cadastrado com este CPF');
        userData.cpf = cpf;
      }
    }

    const profileData: { birthDate?: Date; gender?: string; tshirtSize?: string; boxOrGym?: string } = {};
    if (dto.birthDate !== undefined) {
      const birth = new Date(dto.birthDate);
      if (Number.isNaN(birth.getTime())) throw new BadRequestException('Data de nascimento inválida');
      if (birth.getTime() > Date.now()) throw new BadRequestException('A data de nascimento não pode ser futura');
      profileData.birthDate = birth;
    }
    if (dto.gender !== undefined) profileData.gender = dto.gender;
    if (dto.tshirtSize !== undefined) profileData.tshirtSize = dto.tshirtSize;
    if (dto.boxOrGym !== undefined) profileData.boxOrGym = dto.boxOrGym.trim();

    const hasProfile = AuthService.PROFILE_FIELDS.some((f) => dto[f] !== undefined);
    await this.prisma.$transaction(async (tx) => {
      if (Object.keys(userData).length > 0) await tx.user.update({ where: { id: userId }, data: userData });
      if (hasProfile) {
        // quem ainda não tem perfil de atleta (ex.: organizador) ganha um com os padrões do cadastro
        await tx.athleteProfile.upsert({
          where: { userId },
          update: profileData,
          create: { userId, gender: 'M', tshirtSize: 'M', boxOrGym: '', ...profileData },
        });
      }
    });

    return this.getMe(userId);
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

    this.notifyPasswordChanged(updated.email, updated.name);
    return this.buildAuthResponse(updated);
  }

  // Aviso de segurança: avisa o dono da conta que a senha foi trocada (em segundo plano, nunca bloqueia a troca)
  private notifyPasswordChanged(email: string, name: string): void {
    const quando = new Date().toLocaleString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
    this.mail.dispatch('password_changed', email, { nome: name, quando }, { redact: true });
  }

  private static readonly RESET_MESSAGE =
    'Se o e-mail estiver cadastrado, você receberá as instruções para redefinir a senha.';

  // Resposta idêntica exista a conta ou não; o trabalho real roda em segundo plano
  forgotPassword(email: string, ip: string): { message: string } {
    const normalized = (email || '').toLowerCase().trim();
    const max = Number(process.env.PASSWORD_RESET_MAX_PER_HOUR) || 3;
    const hour = 60 * 60 * 1000;
    // Por e-mail: evita encher a caixa de alguém. Por origem: teto bem mais alto, só para proteger a cota do SMTP;
    // atrás do proxy do frontend todos os usuários chegam do mesmo IP, então um teto baixo trancaria todo mundo.
    const okEmail = this.resetLimiter.hit(`e:${normalized}`, max, hour);
    const okIp = this.resetLimiter.hit(`i:${ip}`, max * 20, hour);
    if (normalized && okEmail && okIp) {
      this.mail.track(this.sendResetEmail(normalized));
    }
    return { message: AuthService.RESET_MESSAGE };
  }

  private async sendResetEmail(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) return;

    const { appBaseUrl } = await this.mail.getSettings();
    if (!appBaseUrl) {
      await this.mail.recordSkipped('password_reset', user.email, 'URL base do sistema não configurada');
      return;
    }

    const token = randomBytes(32).toString('hex');
    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: createHash('sha256').update(token).digest('hex'),
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });
    await this.mail.send(
      'password_reset',
      user.email,
      { nome: user.name, link: `${appBaseUrl}/redefinir-senha?token=${token}`, validade: '1 hora' },
      { redact: true },
    );
  }

  async resetPassword(token: string, newPassword: string) {
    const row = token
      ? await this.prisma.passwordResetToken.findUnique({
          where: { tokenHash: createHash('sha256').update(token).digest('hex') },
        })
      : null;
    if (!row || row.usedAt || row.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException('Link inválido ou expirado. Solicite uma nova recuperação de senha.');
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: row.userId }, data: { passwordHash, mustChangePassword: false } }),
      this.prisma.passwordResetToken.updateMany({
        where: { userId: row.userId, usedAt: null },
        data: { usedAt: new Date() },
      }),
    ]);
    const owner = await this.prisma.user.findUnique({ where: { id: row.userId }, select: { email: true, name: true } });
    if (owner) this.notifyPasswordChanged(owner.email, owner.name);
    return { message: 'Senha redefinida. Faça login com a nova senha.' };
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
