// Contador em memória por chave, em janela deslizante. Reiniciar a API zera tudo (aceitável nesta versão).
export class RateLimiter {
  private readonly hits = new Map<string, number[]>();

  // Registra uma tentativa; devolve false quando passou do limite dentro da janela
  hit(key: string, max: number, windowMs: number): boolean {
    const now = Date.now();
    const recent = (this.hits.get(key) ?? []).filter((t) => now - t < windowMs);
    recent.push(now);
    this.hits.set(key, recent);
    return recent.length <= max;
  }

  clear(): void {
    this.hits.clear();
  }
}
