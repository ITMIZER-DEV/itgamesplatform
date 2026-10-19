import { Injectable } from '@nestjs/common';

// Ponte sem dependências: quem altera placar chama changed(); o websocket assina com onChange().
// Fica separado do stream para o EventsService poder avisar sem dependência circular.
@Injectable()
export class LeaderboardNotifier {
  private listeners: ((game: string) => void)[] = [];

  onChange(listener: (game: string) => void) {
    this.listeners.push(listener);
  }

  changed(game: string) {
    this.listeners.forEach((l) => l(game));
  }
}
