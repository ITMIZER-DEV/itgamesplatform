import { Injectable } from '@nestjs/common';
import { FrozenCategoryMeta, ScreenSpotlight } from './screen-message';

export type ScreenChangeKind = 'config' | 'removed';

// Ponte sem dependências (como o LeaderboardNotifier): o serviço avisa, o websocket assina.
@Injectable()
export class ScreenNotifier {
  private listeners: ((screenId: string, kind: ScreenChangeKind) => void)[] = [];
  private gameListeners: ((gameCode: string) => void)[] = [];
  private readonly spotlights = new Map<string, ScreenSpotlight>();
  private readonly categoryFreezes = new Map<string, Record<string, FrozenCategoryMeta>>();

  onChange(l: (screenId: string, kind: ScreenChangeKind) => void): void {
    this.listeners.push(l);
  }

  changed(screenId: string): void {
    this.listeners.forEach((l) => l(screenId, 'config'));
  }

  removed(screenId: string): void {
    this.spotlights.delete(screenId);
    this.categoryFreezes.delete(screenId);
    this.listeners.forEach((l) => l(screenId, 'removed'));
  }

  // Vínculo suspenso/reativado ou status do campeonato mudou: telões que o exibem recalculam.
  onGameChange(l: (gameCode: string) => void): void {
    this.gameListeners.push(l);
  }

  gameChanged(gameCode: string): void {
    this.gameListeners.forEach((l) => l(gameCode));
  }

  setSpotlight(screenId: string, spotlight: ScreenSpotlight | null): void {
    if (spotlight) {
      this.spotlights.set(screenId, spotlight);
    } else {
      this.spotlights.delete(screenId);
    }
  }

  getSpotlight(screenId: string): ScreenSpotlight | null {
    return this.spotlights.get(screenId) ?? null;
  }

  setCategoryFreezes(screenId: string, map: Record<string, FrozenCategoryMeta> | null): void {
    if (map && Object.keys(map).length > 0) {
      this.categoryFreezes.set(screenId, map);
    } else {
      this.categoryFreezes.delete(screenId);
    }
  }

  getCategoryFreezes(screenId: string): Record<string, FrozenCategoryMeta> {
    return this.categoryFreezes.get(screenId) ?? {};
  }
}
