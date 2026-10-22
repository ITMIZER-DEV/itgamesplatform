import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class UpdateAthleteDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @Transform(trim)
  @IsEmail({}, { message: 'E-mail inválido' })
  email?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  phoneNumber?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  cpf?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  gender?: string;

  @IsOptional()
  birthDate?: string | Date | null;

  @IsOptional()
  @Transform(trim)
  @IsString()
  tshirtSize?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  boxOrGym?: string;
}
