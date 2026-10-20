// Limitador de tentativas em janela deslizante; o relógio é injetado (now em ms).
export class AttemptLimiter {
  private readonly hits = new Map<string, number[]>();

  constructor(
    private readonly max: number,
    private readonly windowMs: number,
  ) {}

  // Consulta sem consumir cota: true quando a chave já atingiu o limite na janela.
  isBlocked(key: string, now: number): boolean {
    const recent = (this.hits.get(key) ?? []).filter((t) => now - t < this.windowMs);
    return recent.length >= this.max;
  }

  // true = permitido; tentativas bloqueadas não consomem cota.
  hit(key: string, now: number): boolean {
    const recent = (this.hits.get(key) ?? []).filter((t) => now - t < this.windowMs);
    if (recent.length >= this.max) {
      this.hits.set(key, recent);
      return false;
    }
    recent.push(now);
    this.hits.set(key, recent);
    return true;
  }
}
