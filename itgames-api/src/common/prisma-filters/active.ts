// Prova ativa: status true ou nulo (o padrão do banco é true). Prova inativa (status=false) sai de
// placar, listagens, baterias e chamadas, mas os dados continuam guardados.
export const ACTIVE_ONLY = { OR: [{ status: null }, { status: true }] };
