import { IsIn, IsISO8601, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export const TSHIRT_SIZES = ['PP', 'P', 'M', 'G', 'GG', 'XG', 'XGG'] as const;

// E-mail, papel e senha não entram aqui: o ValidationPipe (whitelist) descarta qualquer campo fora desta lista
export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'Informe o nome' })
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  phoneNumber?: string;

  // Só pode ser definido uma vez (conta sem CPF); depois fica fixo
  @IsOptional()
  @IsString()
  @MaxLength(20)
  cpf?: string;

  @IsOptional()
  @IsISO8601({ strict: true }, { message: 'Data de nascimento inválida. Use o formato AAAA-MM-DD' })
  birthDate?: string;

  @IsOptional()
  @IsIn(['M', 'F'], { message: 'Gênero inválido. Use M ou F' })
  gender?: string;

  @IsOptional()
  @IsIn(TSHIRT_SIZES as unknown as string[], { message: 'Tamanho de camiseta inválido' })
  tshirtSize?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  boxOrGym?: string;
}
