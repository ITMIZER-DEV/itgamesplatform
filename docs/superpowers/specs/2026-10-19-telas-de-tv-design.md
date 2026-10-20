# Telões de TV: pareamento, configuração, parcial e congelar — design

Projeto 3 de 4 da iniciativa "painel de leaderboard + cálculo oficial" (ver roadmap em
`2026-10-19-regras-de-pontuacao-design.md`). Data: 2026-10-19.
Código afetado: `itgames-api` (telões, pareamento, websocket), `itgames-platform` (página "Telões"),
`itgames-tv` (pareamento e modos na TV).

Depende do projeto 1 (já pronto: `GET /events/:code/board`, `BoardService`, websocket do placar).
**Não depende** do projeto 2: o modo Oficial só é habilitado quando ele existir.

## Intenção

Hoje a TV é configurada na própria TV (servidor e campeonato digitados com o controle remoto) e mostra um único
campeonato. No dia do evento o organizador precisa **controlar os telões à distância**, de um notebook ou celular:
dizer qual campeonato cada telão exibe, se o placar é parcial ou oficial e **congelar** o que está na tela para o
anúncio final, sem ninguém mexer na TV.

## Metas

1. **Pareamento por código.** A TV recém-instalada mostra um código de 6 caracteres. Na página "Telões" do webapp,
   o organizador digita o código, dá um nome ao telão (ex.: "Palco principal") e escolhe os campeonatos que ele exibe.
   A TV começa a exibir sem nenhuma configuração local.
2. **Um telão, um ou vários campeonatos.** Com vários, a TV rotaciona entre eles (cada campeonato percorre suas
   categorias e páginas, depois passa ao próximo). Tempo de cada tela configurável por telão (padrão 15 s).
3. **Modo por telão.** `Parcial` (tempo real, todas as súmulas lançadas, selo "PARCIAL") ou `Oficial` (só o que o
   juiz-chefe homologou, selo "OFICIAL"). Enquanto o projeto 2 não existir, `Oficial` aparece **desabilitado** com a
   explicação "disponível após o cálculo oficial do juiz-chefe"; nunca mostrar como oficial algo que ainda é parcial.
4. **Congelar e descongelar** por telão ou, com um botão, todos os telões do organizador. Ao congelar o servidor
   **guarda uma cópia do placar** daquele instante; o telão mostra essa cópia, com o selo "CONGELADO" e a hora, mesmo
   que súmulas novas entrem, a TV reinicie ou a rede caia e volte. Descongelar volta ao ao vivo.
   **Texto do overlay (pedido do usuário):** enquanto congelado, a TV mostra um texto em overlay sobre o placar. Como o
   texto exato ainda está "a definir", ele é **configurável por congelamento**: ao congelar, o organizador escolhe entre
   os modelos "LEADERBOARD CONGELADO" (padrão) e "LEADERBOARD EM REVISÃO", ou digita um texto livre de até 60
   caracteres. O texto escolhido é guardado junto com a cópia do placar, aparece em todas as TVs congeladas daquele
   comando e some ao descongelar. A redação final dos modelos pode mudar depois sem alterar o resto.
5. **Controle em tempo real.** Qualquer mudança (campeonatos, modo, congelar, tempo de rotação, renomear) chega à
   TV na hora pelo websocket, sem reiniciar o app.
6. **Estado visível.** A página lista cada telão com online/offline (última vez visto), campeonatos, modo e estado.
7. **Permissões.** Super admin vê e controla todos os telões. Organizador cria telões só com campeonatos que ele
   gerencia (vínculo ativo, não suspenso), e vê e controla apenas os telões que ele criou.
8. **Remover o telão** (desparear) na página devolve a TV à tela do código de pareamento.

## Não metas

- Anúncio final interativo (revelação animada de baixo para cima). É o "projeto 3b", próxima etapa, depois deste;
  aqui só existe o congelar, que é a base dele.
- Cálculo oficial pelo juiz-chefe e o conteúdo do modo Oficial (projeto 2).
- Súmula como PWA (projeto 4).
- Controle remoto pelo celular como app, grupos de telões, temas por telão, agendamento de troca de campeonato.
- Autenticar espectadores: o conteúdo exibido é o mesmo público do `/board`.

## Anti-metas

- O código de pareamento dar acesso a qualquer dado além de parear. Ele expira e não pode ser adivinhado por
  tentativa e erro.
- Telão congelado mostrar dado novo por qualquer caminho (reconexão, troca de categoria, rotação de campeonato).
- Telão com o servidor fora do ar ficar em branco: mantém o último placar e reconecta sozinho (como hoje).
- Organizador ver ou controlar telão de outro organizador.
- Telão pareado perder o vínculo ao reiniciar a TV ou ao reinstalar a configuração do servidor.

## Decisões já tomadas pelo usuário

- Cada tela se configura pelo webapp: quais campeonatos aparecem em cada uma e se é tempo real/parcial ou oficial.
- O congelar existe para o anúncio final e vem com um **texto em overlay** ("leaderboard em revisão" ou "congelado";
  texto a definir).
- Quem cria e controla os telões: **super admin e organizador**.
- Propriedade: cada telão pertence a quem o criou; organizador não vê telões de outros; telão com campeonatos de
  organizadores diferentes só o super admin cria; vínculo suspenso tira o campeonato do telão.
- Qualquer campeonato que o dono gerencia pode ser exibido (inclusive rascunho); código de 6 caracteres sem letras
  ambíguas com validade de 10 minutos; rotação padrão de 15 s (5 a 120 s); anúncio final interativo é o projeto 3b;
  servidor na TV vem do build e muda pela tecla MENU.
- O oficial só existe depois do fluxo do juiz-chefe (projeto 2): a regra "WOD calculado trava a súmula" vem de lá.

## Fluxo de pareamento (descrição do comportamento)

1. TV sem vínculo pede ao servidor um código de pareamento (endpoint público) e o exibe grande, com o endereço da
   página "Telões", e fica aguardando. O código vale por tempo limitado (10 minutos); expirado, a TV pede outro.
2. Organizador, logado, abre "Telões" > "Parear telão", digita o código, define nome, campeonatos, modo e tempo de
   rotação. O servidor liga o código ao telão e descarta o código.
3. A TV recebe do servidor uma credencial própria e secreta (guardada só no aparelho; o servidor guarda só um hash) e
   passa a abrir o websocket do telão com ela. A TV nunca mais usa o código.
4. Se o telão for removido na página, ou a credencial deixar de valer, a TV volta ao passo 1.

## Mensagens do telão para a TV (conteúdo, formato exato fica com quem constrói)

- Configuração do telão: nome, modo, congelado (sim/não, quando e o texto do overlay), segundos por tela, lista de
  campeonatos.
- Um `Board` por campeonato (o mesmo formato do projeto 1). Congelado: os `Board` guardados no congelamento.
- Reenviar tudo a cada mudança de configuração e a cada alteração de placar dos campeonatos exibidos.

## Na TV (app Kotlin)

- Tela de pareamento com o código, ao abrir sem credencial. Fica a opção de MENU para mudar o endereço do servidor
  (o padrão vem do build, `-PapiUrl`), já que o pareamento precisa saber a quem falar. A escolha de campeonato sai da TV.
- Selos no cabeçalho: `PARCIAL` (âmbar), `OFICIAL` (verde), `CONGELADO` (azul, com cadeado e a hora do congelamento).
- Overlay de congelamento: faixa/rótulo grande e bem legível de longe sobre o placar com o texto escolhido ao congelar
  (ver Metas, item 4), sem esconder o ranking por completo (o placar congelado continua visível por trás); desaparece
  ao descongelar.
- Nome do campeonato visível no cabeçalho quando há mais de um.
- Rotação por campeonato, categoria e página, com o tempo configurado; teclas ◀ ▶ e OK continuam funcionando.
- Offline: continua mostrando o último placar com o indicador "RECONECTANDO", como hoje.

## Na página "Telões" (webapp)

- Acessível a super admin e organizador (item no menu, rota protegida pelo mesmo mecanismo de papéis do resto).
- Lista de telões do usuário (todos, para super admin) com: nome, online/offline e "visto há X", campeonatos, modo,
  estado (ao vivo / congelado desde HH:MM), ações: editar, congelar/descongelar, remover.
- Botão "Parear telão" (código de 6 caracteres) e botão "Congelar todos / Descongelar todos".
- Congelar (um telão ou todos) abre um passo curto para escolher o texto do overlay: "LEADERBOARD CONGELADO"
  (padrão), "LEADERBOARD EM REVISÃO" ou texto livre (até 60 caracteres); a pessoa confirma e o telão congela.
- Modo `Oficial` visível mas desabilitado (decisão do redator, ver abaixo).
- Textos em Português do Brasil, no padrão visual da plataforma.

## Restrições

- Stack existente: NestJS + Prisma + `ws` na API; Next.js 16 no webapp (ler `node_modules/next/dist/docs/` antes de
  criar a página, conforme `itgames-platform/AGENTS.md`); Kotlin/Compose na TV.
- Schema só **aditivo** (tabelas e colunas novas opcionais); nada de `migrate reset` nem `--accept-data-loss`
  (skill `no-db-reset`). O entrypoint aplica `prisma db push --skip-generate`.
- Reutilizar `BoardService` e o motor do projeto 1; o websocket antigo `/ws/leaderboard?game=` continua funcionando
  (TVs já instaladas e o webapp não podem quebrar).
- Credencial do telão: aleatória, longa, guardada com hash no servidor; código de pareamento com tentativas
  limitadas por IP e validade curta.
- Congelar grava a cópia do placar **no momento da ação**; descongelar remove a cópia.
- Auditoria mínima: quem criou, congelou, descongelou ou removeu o telão e quando (reaproveitar o padrão de log de
  auditoria existente, se couber).
- Testes: lógica pura (permissões, escolha de campeonatos permitidos, validade do código, decisão do que enviar) com
  testes unitários sem banco; os e2e que precisam do banco de teste seguem a restrição de credenciais vigente.

## Decisões do redator (conferir)

Estas escolhas foram minhas, não do usuário:

1. **Modo Oficial desabilitado** na página até o projeto 2; a TV aceita o modo, mas o servidor recusa salvar `oficial`
   antes de o projeto 2 existir.
2. **Congelar guarda cópia no servidor** (e não só um "pause" na TV), para sobreviver a reinício e a reconexão; o
   telão continua exato mesmo se a TV reiniciar ou súmulas novas entrarem. O usuário pediu ainda um **texto em
   overlay** sobre o placar congelado ("leaderboard em revisão" ou "congelado"; texto a definir) — ver "Texto do
   overlay" em Metas e na TV. (Aprovado pelo usuário com essa adição.)
3. **Propriedade do telão:** quem criou. Organizador não vê telões de outros; um telão com campeonatos de organizadores
   diferentes só o super admin cria. Se o vínculo do organizador com um campeonato for suspenso, esse campeonato
   deixa de aparecer no telão dele. (Confirmado pelo usuário: já era decisão dele, passa a ser explícita.)
4. **Qualquer campeonato que o dono gerencia pode ser exibido**, inclusive rascunho (útil para testar o telão antes
   do evento); campeonato bloqueado é recusado. (Aprovado.)
5. **Código de 6 caracteres** sem letras ambíguas (sem 0/O/1/I), validade de 10 minutos. (Aprovado.)
6. **Rotação** de 15 s por padrão, ajustável de 5 a 120 s. (Aprovado.)
7. **Anúncio final fica fora** deste projeto e vira o 3b logo em seguida. (Aprovado.)
8. O padrão do servidor na TV vem do build; trocar pela tecla MENU. (Aprovado.)
9. **Texto do overlay como configurável** (decisão do redator para resolver o "texto a definir"): ver Metas, item 4.

## O que fica para quem constrói

Nomes de tabelas, colunas, rotas e mensagens; formato exato do websocket do telão (e se o pareamento usa consulta
periódica ou websocket); algoritmo de hash e geração de códigos; como a página é organizada em componentes; divisão em
tarefas; migração do app de TV (primeira abertura de TVs que já têm servidor/campeonato salvos: mostrar o pareamento,
mantendo o último campeonato como fallback offline é opcional).
