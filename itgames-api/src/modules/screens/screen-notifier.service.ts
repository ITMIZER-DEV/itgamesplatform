import { Injectable } from '@nestjs/common';

export type ScreenChangeKind = 'config' | 'removed';

// Ponte sem dependências (como o LeaderboardNotifier): o serviço avisa, o websocket assina.
@Injectable()
export class ScreenNotifier {
  private listeners: ((screenId: string, kind: ScreenChangeKind) => void)[] = [];

  onChange(l: (screenId: string, kind: ScreenChangeKind) => void): void {
    this.listeners.push(l);
  }

  changed(screenId: string): void {
    this.listeners.forEach((l) => l(screenId, 'config'));
  }

  removed(screenId: string): void {
    this.listeners.forEach((l) => l(screenId, 'removed'));
  }
}
