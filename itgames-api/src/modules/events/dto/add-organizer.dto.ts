import { IsUUID } from 'class-validator';

export class AddOrganizerDto {
  @IsUUID()
  userId: string;
}
