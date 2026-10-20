import { Injectable } from '@nestjs/common';

export type ScreenChangeKind = 'config' | 'removed';

// Ponte sem dependências (como o LeaderboardNotifier): o serviço avisa, o websocket assina.
@Injectable()
export class ScreenNotifier {
  private listeners: ((screenId: string, kind: ScreenChangeKind) => void)[] = [];
  private gameListeners: ((gameCode: string) => void)[] = [];

  onChange(l: (screenId: string, kind: ScreenChangeKind) => void): void {
    this.listeners.push(l);
  }

  changed(screenId: string): void {
    this.listeners.forEach((l) => l(screenId, 'config'));
  }

  removed(screenId: string): void {
    this.listeners.forEach((l) => l(screenId, 'removed'));
  }

  // Vínculo suspenso/reativado ou status do campeonato mudou: telões que o exibem recalculam.
  onGameChange(l: (gameCode: string) => void): void {
    this.gameListeners.push(l);
  }

  gameChanged(gameCode: string): void {
    this.gameListeners.forEach((l) => l(gameCode));
  }
}
