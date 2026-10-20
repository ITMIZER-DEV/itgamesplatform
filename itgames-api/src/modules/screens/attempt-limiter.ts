// Limitador de tentativas em janela deslizante; o relógio é injetado (now em ms).
export class AttemptLimiter {
  private readonly hits = new Map<string, number[]>();

  constructor(
    private readonly max: number,
    private readonly windowMs: number,
  ) {}

  // Guarda só o que está dentro da janela; janela vazia apaga a chave (o Map não cresce sem limite).
  private store(key: string, recent: number[]): void {
    if (recent.length) this.hits.set(key, recent);
    else this.hits.delete(key);
  }

  // true = permitido; tentativas bloqueadas não consomem cota.
  hit(key: string, now: number): boolean {
    const recent = (this.hits.get(key) ?? []).filter((t) => now - t < this.windowMs);
    if (recent.length >= this.max) {
      this.store(key, recent);
      return false;
    }
    recent.push(now);
    this.store(key, recent);
    return true;
  }

  // Devolve a cota de uma tentativa já consumida em `t` (remove um timestamp igual a t).
  release(key: string, t: number): void {
    const list = this.hits.get(key);
    if (!list) return;
    const i = list.indexOf(t);
    if (i >= 0) list.splice(i, 1);
    this.store(key, list);
  }

  // Quantidade de chaves em memória (usado nos testes).
  get size(): number {
    return this.hits.size;
  }
}
