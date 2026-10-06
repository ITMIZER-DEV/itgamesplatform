import { IsBoolean, IsEmail, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, ValidateIf } from 'class-validator';

export class UpdateMailSettingsDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  host?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(65535)
  port?: number;

  @IsOptional()
  @IsIn(['starttls', 'ssl'], { message: 'Segurança inválida. Use starttls ou ssl' })
  secure?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  username?: string;

  // Ausente ou vazio mantém a senha atual
  @IsOptional()
  @IsString()
  @MaxLength(255)
  password?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  fromName?: string;

  @ValidateIf((o) => o.fromAddress !== undefined && o.fromAddress !== '')
  @IsEmail({}, { message: 'E-mail do remetente inválido' })
  fromAddress?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  appBaseUrl?: string;
}
