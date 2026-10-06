export function normalizeCpf(value?: string | null): string {
  return (value ?? '').replace(/\D/g, '');
}

// Valida os dois dígitos verificadores; rejeita sequências repetidas (111.111.111-11 etc.)
export function isValidCpf(value?: string | null): boolean {
  const cpf = normalizeCpf(value);
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;

  const digit = (len: number) => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(cpf[i]) * (len + 1 - i);
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };

  return digit(9) === Number(cpf[9]) && digit(10) === Number(cpf[10]);
}

// Nunca devolve o CPF inteiro em mensagens ou consultas: só os 2 últimos dígitos
export function maskCpf(value?: string | null): string {
  return `***.***.***-${normalizeCpf(value).slice(-2)}`;
}
