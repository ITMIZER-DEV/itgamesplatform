# Cálculo oficial — andamento das tarefas

Arquivo de retomada: qualquer agente (ou pessoa) consegue continuar o projeto a partir daqui.
Atualize a linha da tarefa e faça commit só deste arquivo ao concluir cada tarefa.

- **Spec:** `docs/superpowers/specs/2026-10-20-calculo-oficial-design.md`
- **Plano (fonte dos requisitos, tarefa a tarefa):** `docs/superpowers/plans/2026-10-20-calculo-oficial.md`
- **Branch:** `feat/calculo-oficial` (a partir de `feat/telas-de-tv`, que parte de `feat/regras-pontuacao`; nenhuma ainda mergeada)
- **Método:** `superpowers:subagent-driven-development` — um implementador por tarefa, revisão de tarefa (spec + qualidade) com correção em até 5 rodadas, revisão final da branch e uma rodada única de correção. Implementadores em `sonnet`; revisões de tarefas de risco e a final em `opus`.
- **Ledger local (git-ignorado, pode não existir em outra máquina):** `.superpowers/sdd/2026-10-20-calculo-oficial/progress.md`. Em outra máquina, reconstrua o estado por este arquivo e por `git log feat/telas-de-tv..feat/calculo-oficial`.
- **Como retomar:** leia o spec, as seções *Global Constraints* e *Review Focus* do plano e a primeira tarefa abaixo que não esteja `done`. Cada tarefa tem arquivos, interfaces, testes (TDD) e comando de verificação no plano.
- **Regras que não mudam:** nunca forjar token/JWT; nunca imprimir `.env`; nunca matar processos por nome (só PID/porta); não mexer nos containers Docker; schema só aditivo (skill `no-db-reset`); e2e `*.e2e-spec.ts` só compilam (banco de teste sem credencial); `git add` só dos arquivos da tarefa; nunca commitar `itgames-platform/src/lib/arena-data.ts` (edição do usuário com linha solta `va`) nem o submódulo `itgames-server`.

| # | Tarefa | Estado | Commits |
|---|--------|--------|---------|
| 1 | Motor: entradas por WOD, `buildBoard` e visões do board | done | 52d0215 |
| 2 | Modelos do cálculo oficial e regras puras de prontidão | done | 6702837, 78c52dd |
| 3 | Módulo `official`: status, prévia, confirmar, reverter, histórico e trava | done | ad912d3, eba76c5 |
| 4 | Trava de súmula em todos os caminhos de escrita | in-progress | |
| 5 | Board por visão: parcial sem pontos, oficial e telões em modo oficial | pending | |
| 6 | Webapp: API client, helpers e modo Oficial nos Telões | pending | |
| 7 | Webapp: página "Cálculo oficial" do juiz-chefe | pending | |
| 8 | Webapp: telas públicas sem pontos no parcial e visão Oficial | pending | |
| 9 | App de TV: sem pontos no parcial e "Aguardando cálculo oficial" | pending | |
| 10 | Verificação local ponta a ponta | pending | |
| — | Revisão final da branch + rodada única de correção | pending | |
| — | Finalizar as branches (merge/PR) — decisão do usuário | pending | |

Estados: `pending` → `in-progress` → `review` → `done`.

## Pendências herdadas (não são tarefas deste projeto)
- Validação manual com banco e login reais do projeto 3 (telões): parear, resgatar, congelar, reiniciar a API.
- Decidir o merge das branches `feat/regras-pontuacao` → `feat/telas-de-tv` → `feat/calculo-oficial`.
- Projeto 3b (anúncio final interativo) e projeto 4 (súmula PWA) ainda não iniciados.
