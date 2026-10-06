import { BadRequestException, Injectable } from '@nestjs/common';
import { UserRole } from '../../common/enums/role.enum';
import { isValidCpf, maskCpf, normalizeCpf } from '../../common/utils/cpf';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AthletesService {
  constructor(private readonly prisma: PrismaService) {}

  // Usada pela tela de inscrição para confirmar o parceiro. Não expõe dados pessoais além do primeiro nome.
  async lookupByCpf(rawCpf?: string) {
    const cpf = normalizeCpf(rawCpf);
    if (!isValidCpf(cpf)) {
      throw new BadRequestException('CPF inválido');
    }
    const user = await this.prisma.user.findFirst({
      where: { cpf, role: UserRole.ATHLETE },
      select: { name: true },
    });
    if (!user) {
      return { found: false, cpfMasked: maskCpf(cpf) };
    }
    return { found: true, firstName: user.name.trim().split(/\s+/)[0], cpfMasked: maskCpf(cpf) };
  }
}
