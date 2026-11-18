import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, ValidateIf } from 'class-validator';

export class UpdateRegistrationLockDto {
  @ApiPropertyOptional({ description: 'Flag manual para bloquear ou liberar novas inscrições' })
  @IsOptional()
  @IsBoolean()
  registrationLocked?: boolean;

  @ApiPropertyOptional({ description: 'Data/hora ISO de abertura automática das inscrições (null para remover)' })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  registrationStartAt?: string | null;

  @ApiPropertyOptional({ description: 'Data/hora ISO de encerramento automático das inscrições (null para remover)' })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  registrationCloseAt?: string | null;
}
