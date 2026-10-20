# Cálculo oficial pelo juiz-chefe — design

Projeto 2 de 4 da iniciativa "painel de leaderboard + cálculo oficial" (roadmap em
`2026-10-19-regras-de-pontuacao-design.md`). Data: 2026-10-20.
Código afetado: `itgames-api` (cálculo oficial, travas, visibilidade), `itgames-platform` (tela do juiz-chefe e telas
públicas), `itgames-tv` (modo parcial sem pontos, modo oficial). Base: branch `feat/telas-de-tv`.

Depende dos projetos 1 (motor de pontuação, `GET /events/:code/board`) e 3 (telões; hoje o modo `official` é recusado).

## Intenção

Hoje todo placar é "parcial": calculado na hora a partir das súmulas, com pontos e totais. O campeonato precisa de um
momento **oficial**: depois que as baterias de uma categoria terminam num WOD, o **juiz-chefe** confere o resultado,
confirma o cálculo e só então a **pontuação real** passa a existir para o público. Até lá, o público acompanha a prova
(tempos, posições no WOD, uma ordem indicativa), mas sem pontos. A referência de comportamento é o "cálculo oficial"
do sistema antigo (`itgames-next`: prévia, confirmar, reverter, histórico), com o que ele não tinha: bateria encerrada
como condição, trava da súmula, papel restrito e proteção contra cálculo em duplicidade.

## Quem é o juiz-chefe

**Organizador do evento ou super admin** (decisão do usuário). Não existe papel novo. O organizador age só em
campeonatos que gerencia (vínculo ativo, como nos telões); o super admin em todos. Árbitros e atletas não calculam,
não revertem e não veem a prévia de pontos.

## Metas

1. **Cálculo oficial por categoria e WOD.** O juiz-chefe escolhe categoria e WOD, vê a **prévia** (nada gravado) e
   **confirma**. A confirmação grava, por equipe, a posição e a pontuação daquele WOD (um "instantâneo") e registra
   quem confirmou e quando.
2. **Só depois das baterias.** A confirmação só é liberada quando **todas as baterias da categoria naquele WOD** estão
   encerradas (`Heat.status = completed`). A prévia pode ser consultada antes, marcada como "baterias em andamento",
   mas confirmar é bloqueado com mensagem clara dizendo quais baterias faltam.
3. **W.O.** No cálculo, equipe ativa sem resultado válido no WOD (não compareceu à arena) é **W.O.**: recebe a última
   posição válida + 1 e os pontos dessa posição (regra já usada no motor do projeto 1). Equipe cancelada fica fora.
   A prévia lista os W.O. antes de confirmar.
4. **Trava da súmula.** WOD calculado (confirmado) trava a digitação/edição/remoção/lançamento de súmula **daquela
   categoria naquele WOD**, para todos os perfis. Só o juiz-chefe (organizador do campeonato ou super admin) pode
   **reverter**, o que destrava. Enviar foto continua permitido.
5. **Reverter.** Desfaz o cálculo daquele WOD/categoria: some a pontuação oficial dele, a súmula é destravada. Exige
   informar o **motivo** (guardado no histórico, ao contrário do sistema antigo).
6. **Sem duplicidade.** Confirmar um WOD/categoria já calculado é recusado (o sistema antigo somava de novo).
7. **Histórico.** Lista de calcular/reverter por categoria e WOD: quem, quando, motivo (reverter), quantas equipes e
   quantas W.O.
8. **Visibilidade do público (parcial x oficial).**
   - **Parcial** (webapp público, atleta, telões em modo `partial`): mostra o resultado de cada WOD como foi na
     arena (tempo, carga ou repetições) e a posição naquele WOD, e uma **ordem indicativa** da classificação geral,
     **sem** pontos, sem total de pontos, sem soma de posições e sem "tempo total" (HYROX) como classificação.
     Selo PARCIAL (já existe).
   - **Oficial** (telões em modo `official`, aba/visão oficial do webapp): mostra a **pontuação real** (pontos, soma
     de posições ou tempo total, conforme a regra do campeonato) considerando **somente os WODs confirmados**. Selo
     OFICIAL (já existe na TV).
   - A prévia com pontos é visível só para o juiz-chefe.
9. **Telões em modo Oficial.** O servidor deixa de recusar `official`; a opção na página Telões é habilitada. O
   telão oficial só exibe dados oficiais.

## Não metas

- Anúncio final interativo (revelação animada): projeto 3b.
- Súmula como PWA e digitação dos parciais do HYROX: projeto 4.
- Papel novo "juiz-chefe" separado de organizador/super admin.
- Recálculo automático ao editar súmula depois da trava (a trava existe justamente para isso).
- Autorização por categoria dentro do mesmo campeonato.

## Anti-metas

- Pontuação real aparecer em qualquer lugar público antes da confirmação do juiz-chefe.
- Súmula alterável num WOD já calculado, por qualquer perfil (inclusive o organizador, que é o juiz-chefe: ele
  precisa reverter antes de editar).
- Calcular o mesmo WOD duas vezes somando pontos em duplicidade.
- Calcular antes de as baterias terminarem.
- Reverter sem deixar rastro (quem, quando, motivo).
- Quebrar o contrato do `GET /events/:code/board` e do websocket para as TVs já instaladas sem aviso: a mudança do
  conteúdo do parcial (sem pontos) é intencional, mas precisa continuar com o mesmo formato de mensagem
  (campos de pontos vazios/ausentes) ou ser versionada.

## Decisões já tomadas pelo usuário

- Juiz-chefe = organizador ou super admin.
- Seguir o fluxo do sistema antigo: prévia, confirmar, reverter, histórico.
- A classificação do WOD para efeito de cálculo só vale com as baterias da categoria encerradas; quem não comparece à
  arena é W.O.
- Parcial mostra tempos/resultados e prévia, **nunca pontuação real**; só o leaderboard oficial mostra pontuação real;
  o parcial serve para dar noção de como foi a prova.
- Na tela parcial a classificação geral aparece como **ordem indicativa sem pontos**.
- (Já decididas antes) WOD calculado trava a súmula para todos os perfis; só o juiz-chefe/super admin reverte; foto
  continua permitida; W.O./cancelada/sem score = última posição válida + 1 com os pontos dessa posição.

## Restrições

- Stack: NestJS + Prisma na API; Next.js 16 no webapp (ler `node_modules/next/dist/docs/` antes de criar páginas,
  conforme `itgames-platform/AGENTS.md`); Kotlin/Compose na TV.
- Schema só **aditivo** (modelos/colunas novas opcionais; skill `no-db-reset`; nada de `migrate reset` nem
  `--accept-data-loss`); o entrypoint aplica `prisma db push --skip-generate`.
- Reusar o motor `itgames-api/src/modules/scoring` (rules/engine/board.service) para pontos e posições; o resultado
  oficial grava o que o motor calcula **no momento da confirmação** (instantâneo), para não mudar se regras ou súmulas
  mudarem depois.
- Cálculo e reversão atômicos (transação) e protegidos contra cliques/requisições simultâneas.
- Conteúdo público continua sem dados pessoais (mesmo nível do `/board`).
- Textos em Português do Brasil.

## Decisões do redator (conferir)

Escolhas minhas, não do usuário:

1. **Bateria encerrada = `Heat.status = completed`** para todas as baterias da categoria naquele WOD
   (`Heat.categoryId/workoutCode`). Categoria sem nenhuma bateria cadastrada naquele WOD: confirmar é permitido com um
   aviso na prévia ("sem baterias cadastradas") — para não travar eventos que não usam baterias.
2. **W.O. = equipe ativa sem resultado válido no WOD** quando o cálculo é feito (não há registro de presença na
   arena no sistema; "não compareceu" equivale a "não tem súmula válida").
3. **Instantâneo por equipe e por WOD:** posição, pontos (modo tabela de pontos), valor para soma de posições, tempo
   (HYROX) e se foi W.O.; o oficial geral é recalculado a partir dos instantâneos dos WODs confirmados, com a regra do
   campeonato (inclusive desempate).
4. **Trava por categoria + WOD** (e não por WOD do campeonato inteiro): confirmar a categoria A não trava a B.
5. **Reverter exige motivo** (texto livre, mínimo curto); só reverte o WOD/categoria escolhido (não existe "limpar
   tudo" como no sistema antigo).
6. **Sem pontos no parcial:** os campos de pontos/total saem do board parcial (a TV e o webapp deixam de exibi-los);
   a posição geral indicativa continua, sem número de pontos.
7. **Tela do juiz-chefe no webapp**, dentro da área do campeonato: lista de categorias x WODs com o estado de cada
   um (baterias em andamento / pronto para calcular / calculado / revertido), prévia, confirmar, reverter, histórico.
8. **Auditoria:** reaproveitar o padrão de log de auditoria existente (`audit` module) para confirmar/reverter.

### Decisões do redator, 2ª parte (resolvem as dúvidas do revisor; conferir)

9. **Unidade de cálculo = (categoria, `Event`)**, o "WOD" que recebe súmulas (`Score.idEvent`). As baterias são
   buscadas pelo `Workout` ligado ao `Event` (`Event.workout` = `Heat.workoutCode`, mesma categoria). `Event` sem
   `workout`, ou `Workout` sem baterias: confirmar é permitido, com aviso na prévia.
10. **Equipe sem súmula válida é W.O. mesmo que tenha sido escalada numa bateria** (se não competiu, não há
    resultado). Súmula em `draft` não conta (como no motor do projeto 1) e é listada como aviso na prévia; **súmula
    `contested` bloqueia a confirmação** até ser resolvida; as demais (`submitted`, `approved`, e o padrão
    `approved_by_head_judge`) contam.
11. **O instantâneo e o histórico são tabelas novas.** Não se reaproveitam `Score.point`, `Score.rank` nem
    `Score.isWO` (colunas legadas que o sistema antigo usava); W.O. não tem linha em `Score`, então o instantâneo tem
    linha própria por equipe, inclusive para W.O.
12. **Histórico só de acréscimo:** uma linha por ação (confirmar ou reverter), com usuário, data, motivo (reverter),
    quantidade de equipes e de W.O. Depois de reverter, confirmar de novo é permitido e gera novo instantâneo.
13. **O oficial geral soma apenas os WODs confirmados**, e o desempate considera só esses WODs.
14. **A trava continua até reverter**, mesmo que uma bateria seja reaberta ou uma inscrição mude depois; o
    instantâneo não se altera. Mudar a **regra de pontuação** do campeonato enquanto houver WOD confirmado é recusado
    (é preciso reverter antes), para o oficial não misturar regras.
15. **Trava em todos os caminhos de escrita de súmula** (`scores.service` criar/atualizar/apagar, anulação de súmula
    em `events.service`, e qualquer outro que apareça no código), com um único ponto de verificação reaproveitado;
    restaurar backup e apagar o campeonato inteiro (ações de super admin) ficam fora da trava.
16. **Compatibilidade com TVs instaladas:** o formato do board não muda (a TV exige `points` e `totalPoints`
    inteiros). No parcial o servidor manda esses campos zerados, `totalDisplay` vazio e um campo novo
    `pointsVisible: false`; a TV nova esconde os pontos quando for `false`. TV antiga mostraria "0", aceito na
    transição (o app de TV é recente).
17. **Telão em modo Oficial sem nenhum WOD confirmado** mostra estado vazio "Aguardando cálculo oficial", nunca cai
    para o parcial.

## O que fica para quem constrói

Nomes de tabelas/colunas/rotas; formato do instantâneo; como o board "oficial" é servido (parâmetro, rota nova ou
campo do board); como o `ScreenStreamService` escolhe o conteúdo por modo; como bloquear as rotas de súmula
(`scores`) e quais erros devolver; layout da tela do juiz-chefe; migração do conteúdo do parcial na TV e no webapp;
divisão em tarefas.
