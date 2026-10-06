import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class UpdateOrganizerDto {
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
  @IsNotEmpty()
  phoneNumber?: string;
}
