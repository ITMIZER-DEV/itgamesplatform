import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class CreateOrganizerDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsEmail({}, { message: 'E-mail inválido' })
  email: string;

  @IsString()
  @IsNotEmpty()
  phoneNumber: string;
}
