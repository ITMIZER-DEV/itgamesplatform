import { IsIn } from 'class-validator';

export const GAME_STATUSES = ['live', 'draft', 'blocked'] as const;

export class UpdateStatusDto {
  @IsIn(GAME_STATUSES, { message: 'Status inválido. Use live, draft ou blocked' })
  status: string;
}
