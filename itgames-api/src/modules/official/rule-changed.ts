import { resolveRule } from '../scoring/rules';

type RuleInput = Parameters<typeof resolveRule>[0];

// Compara a regra de pontuação efetiva (já resolvida) antes e depois de uma edição do campeonato.
export function ruleChanged(before: RuleInput, after: RuleInput): boolean {
  const a = resolveRule(before);
  const b = resolveRule(after);
  return (
    a.mode !== b.mode ||
    a.tiebreak !== b.tiebreak ||
    a.pointsTable.length !== b.pointsTable.length ||
    a.pointsTable.some((v, i) => v !== b.pointsTable[i])
  );
}
