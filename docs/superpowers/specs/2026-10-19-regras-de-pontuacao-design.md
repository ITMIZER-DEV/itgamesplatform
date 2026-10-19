# Regras de pontuação por campeonato — design

Projeto 1 de 4 da iniciativa "painel de leaderboard + cálculo oficial" (ver "Roadmap" no fim).
Data: 2026-10-19. Código afetado: `itgames-api` (motor e configuração), `itgames-platform` (formulário do
organizador e telas de leaderboard), `itgames-tv` (consome o resultado pronto).

## Intenção

O ITGames é um sistema de competição fitness geral, não só de CrossFit. Cada campeonato precisa definir **como a
classificação é calculada**: hoje a API e a plataforma ignoram essa escolha e usam uma tabela fixa
(100, 95, 90…), "mais pontos vence", com W.O. valendo zero. O campeonato SUMMER2026 já está marcado como
"menor pontuação vence" (`isLowestPointsBetter`) e mesmo assim é classificado ao contrário.

O objetivo é um **único motor de cálculo** no servidor, que o organizador configura por campeonato e que todas as
telas (webapp, telão de TV, e futuramente o cálculo oficial) usam. Assim a mesma classificação aparece em todo lugar.

## Metas

1. O organizador escolhe, por campeonato, uma de três regras de classificação:
   - **Pontos por posição** (maior soma vence): CrossFit e ATHX. A tabela posição → pontos é editável; padrão
     100, 95, 90, 85, 80, 75, 70, 65, 60, 55, 50, 47, 44, 41, 38, 35, 32, 29, 26, 23, 20, 18, 16, 14, 12, 10, 8, 6, 4, 2, 1.
   - **Soma de posições** (menor soma vence): a posição no WOD já é o ponto.
   - **Tempo total** (menor vence): HYROX. Tempo total = soma dos tempos (corridas + estações) + penalidades.
2. O organizador escolhe o **critério de desempate** do campeonato:
   - melhor posição no último WOD (padrão, comportamento atual);
   - maior número de vitórias em WODs/estágios (ATHX);
   - melhor parcial de um exercício nomeado (HYROX: Wall Balls).
3. **W.O., súmula cancelada e equipe sem score** ficam na classificação e recebem a **última posição válida + 1**,
   com os pontos dessa posição (regra de pontos/soma de posições). Nunca zero, nunca somem da tela.
4. **Uma única fonte do cálculo:** o servidor devolve o placar já calculado; telão de TV e telas de leaderboard do
   webapp deixam de calcular por conta própria.
5. O HYROX aceita **parciais opcionais** por score (corridas e estações); só o parcial de desempate é exigido, e só
   quando há empate.

## Não metas

- Fluxo de cálculo oficial pelo juiz-chefe, travar súmula, reverter (projeto 2).
- Telas de TV com pareamento, modo provisório/oficial, congelar e anúncio final (projeto 3).
- Súmula como PWA e a digitação dos 16 parciais na interface do juiz (projeto 4). Aqui só o **campo e a regra** que os usam.
- Pontuação por equipe com regras de rodada de AMRAP (`roundsCount` continua não existindo na API; AMRAP compara
  repetições totais).

## Anti-metas (seria falha mesmo que "funcione")

- Mudar a classificação de campeonato já em andamento sem o organizador escolher. Campeonatos existentes migram
  para a regra equivalente ao que a flag `isLowestPointsBetter` já dizia, e isso fica visível no formulário.
- Perder dados: nada de `migrate reset`, `db push --accept-data-loss` contra o banco real ou apagar colunas.
  Mudanças de schema só **aditivas** (skill `no-db-reset` do projeto).
- W.O. aparecer em 1º lugar ou valer zero em qualquer regra.
- Duas contas diferentes para o mesmo campeonato em telas diferentes.

## Decisões já tomadas pelo usuário (todas as partes)

- Regra de pontos é **por campeonato**; existem as modalidades acima, inclusive HYROX e ATHX.
- Súmula cancelada **entra como W.O.**: última posição + 1, com os pontos dessa posição.
- HYROX: tempo total e penalidades obrigatórios; parciais opcionais; desempate pelo parcial do último exercício
  (Wall Balls), exigido só em caso de empate.
- ATHX: pontos acumulados por estágio (tempo: menor ganha mais; repetições/carga: maior ganha mais).
- Quando um WOD estiver calculado como oficial, a súmula **não aceita revisão nem alteração**; reverter exige o
  juiz-chefe (projeto 2). Anexar foto continua permitido (proposta, ver "Decisões do redator").

## Comportamento do cálculo

Entrada: regra do campeonato, categorias, WODs (com tipo e time cap), equipes ativas **e canceladas**, scores.
Saída: por categoria, lista ordenada de equipes com posição, total e, por WOD, resultado exibido, posição e pontos.

- **Ordenação dentro do WOD** (já existente, preservada): `for_time` — quem completou dentro do time cap vem antes,
  menor tempo + penalidade vence, depois tie-break de tempo; quem não completou compara repetições; `amrap`/`emom`
  — repetições; `max_load`/`complex` — maior carga, depois menor tempo; `hyrox_*` — menor tempo + penalidade.
- **Posição:** empates recebem a mesma posição e a seguinte não pula (ranking denso, como no sistema antigo).
  W.O./cancelada/sem score = maior posição + 1.
- **Pontos por posição:** tabela do campeonato; posição acima do fim da tabela recebe 1 ponto.
- **Soma de posições:** ponto = posição; maior = pior.
- **Tempo total:** soma de (tempo + penalidade) dos WODs do HYROX; equipes sem tempo válido (W.O., cancelada, sem
  score) vão depois de todas as que terminaram, sem tempo exibido.
- **Total e ordem:** pontos/posições → maior (pontos) ou menor (soma/tempo) vence; empate resolvido pelo critério
  de desempate escolhido; ainda empatado, mesma posição final.
- **Equipe cancelada continua na classificação** com a marca "CANCELADA" (hoje é escondida e as súmulas são
  marcadas `voided`): o motor deve considerar scores `voided` como cancelada, não como ausência.

## Configuração (organizador)

Campos novos por campeonato, todos com valor padrão que reproduz o comportamento atual, para a migração não mudar
nada sem aviso:

- tipo de regra (`points_table` | `rank_sum` | `total_time`);
- tabela de pontos por posição (usada só em `points_table`);
- critério de desempate (`last_workout` | `most_wins` | `split:<nome>`).

O campo `isLowestPointsBetter` continua existindo e sendo gravado enquanto algo o ler; novos campeonatos usam o
tipo de regra, e o formulário do admin (`itgames-platform/src/app/admin/page.tsx`) passa a editar os campos novos.
Para campeonatos existentes: `isLowestPointsBetter = true` → `rank_sum`; `false` → `points_table`; HYROX
(`eventType = hyrox`) → `total_time`.

Parciais do HYROX: cada score pode guardar uma lista opcional de parciais `{nome, segundos}`. O desempate
`split:<nome>` compara esse parcial; quem não tem o parcial perde o desempate.

## Restrições

- Stack existente: NestJS + Prisma + PostgreSQL na API; Next.js (versão com mudanças — ler
  `node_modules/next/dist/docs/` antes de mexer, conforme `itgames-platform/AGENTS.md`); Kotlin/Compose na TV.
- O motor fica na API como módulo puro (funções sem acesso a banco) com testes; o acesso a dados envolve a
  consulta que já existe em `EventsService.getLeaderboardData`.
- O motor deve aceitar um **filtro de WODs considerados** (conjunto de ids), porque o projeto 2 vai calcular o
  placar oficial só com os WODs confirmados.
- Dados públicos continuam sem informações pessoais (mesmas regras do endpoint público atual).
- Os testes e2e existentes dependem do banco `itgames_test`; os do motor devem rodar sem banco.

## Decisões do redator (conferir)

Estas escolhas foram minhas, não do usuário:

1. **Ranking denso** (1, 1, 2), como o sistema antigo, em vez do atual na plataforma (1, 1, 3). É a que mais afeta
   resultados com empate — **confirmar**.
2. Posição além do fim da tabela recebe 1 ponto (como a plataforma hoje; o antigo dava 0).
3. Anexar ou trocar **foto** de súmula calculada continua permitido.
4. A tabela de pontos é **por campeonato** (o antigo guardava por categoria); sobrescrever por categoria fica fora.
5. Migrar também as telas de leaderboard do webapp para o resultado do servidor entra neste projeto; se ficar grande,
   pode ser a última etapa do plano, antes de entregar o telão.
6. Em HYROX, equipe sem tempo válido fica depois de todas, sem tempo exibido.
7. Posição de desempate "mais vitórias" conta posições = 1 em WODs/estágios do campeonato.

## O que fica para quem constrói

Nomes de tabelas/colunas e de endpoints, formato exato do JSON do placar (manter compatível com o que o app de TV
já lê, ou versionar), forma de migrar os dados existentes sem risco, e a divisão em tarefas.

## Roadmap (para não perder o contexto)

1. **Regras de pontuação por campeonato** — este documento.
2. **Cálculo oficial pelo juiz-chefe:** preview e confirmação por categoria e WOD; guarda posição e pontos no
   momento da confirmação; reverter por WOD; WOD calculado trava a súmula (sem edição/revisão, para todos os
   perfis); histórico de quem confirmou/reverteu e quando. Referência: `itgames-next/src/lib/services/leaderboard.service.ts`
   e `ranking.service.ts`. Pendência: a regra do que acontece com cancelamento depois de calculado (WODs
   calculados ficam como estão; os demais pontuam como último + 1).
3. **Painel de TV:** cada tela se pareia por código e recebe do organizador as competições a exibir e o modo
   (**provisório**, tempo real com todas as súmulas, ou **oficial**, só WODs confirmados); **congelar** trava a tela
   e libera o modo de anúncio final (revelação interativa, de baixo para cima). O app Kotlin atual (`itgames-tv`) é a base.
4. **Súmula como PWA** no webapp do juiz, incluindo digitação dos parciais opcionais do HYROX.
