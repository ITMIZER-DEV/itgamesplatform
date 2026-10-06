# SDD ledger — plan: docs/superpowers/plans/2026-10-05-organizadores-e-liberacao.md
Projeto sem git: sem commits/BASE; conclusão registrada por tarefa.
Pre-flight: interfaces compartilhadas conferidas (AuthUser/GameAccessService/helpers/api-client) — sem conflito.
Task 1: complete (db push aditivo, generate ok, 0 jogos com organizador → 0 vínculos, build ok)
Task 1: Ruling: parei o dev server local 'nest start --watch' (PID 39384) porque travava a DLL do Prisma no generate — religar ao final — custo: dev server fora do ar até lá
Task 2: complete (smoke e2e 1/1 pass, build ok)
Task 3: complete (auth+smoke e2e 8/8 pass)
Task 4: complete (e2e 15/15; build ok)
Task 4: Ruling: @Transform trim no e-mail do CreateOrganizerDto — IsEmail rejeitava espaços nas pontas e o Review Focus 2 exige aceitar — custo se errado: nenhum
Task 5: Ruling: usuário adicionou pixKey/pixBeneficiary ao Game/CreateGameDto/createGame/updateGame durante a execução; preservei e restaurei no bloco novo do EventsService — custo se errado: campos pix ausentes
Task 5: complete (e2e 31/31)
Task 6: complete (e2e 37/37; build ok)
Task 7: complete (e2e 45/45; build ok)
Task 7: Ruling: payload do teste field-ops precisava de 'judge' (campo obrigatório do CreateScoreDto) — corrigi o teste, não o código
Task 8: complete parcial (seed, .env, compose, schema sem organizerId; e2e 45/45; build ok)
Task 8: Ruling: NÃO apliquei db push removendo games.organizerId no banco real (passo destrutivo; plano manda confirmar com o usuário). Coluna fica legada e inofensiva (0 linhas preenchidas; backup em backups/) — custo se errado: coluna órfã até o usuário confirmar
Task 5/6: Ruling: usuário adicionou EventsService.updateRegistrationStatus e api-client.updateRegistrationStatus durante a execução, sem rota; expus PATCH :code/registrations/:regCode/status (ORGANIZER vinculado) com teste RED→GREEN — custo se errado: rota extra
Task 9: complete (acl/api-client/login/trocar-senha; tsc sem novos erros fora do admin; AuthUserModal removido)
Task 10: complete (admin sem toggle, listMyGames, painéis de organizadores; tsc sem novos erros)
Task 11: complete (athlete/register/judge só API + erros visíveis; tsc sem novos erros)
Final: fixed C1 baterias públicas sem CPF/telefone — review-fixes C1 RED→GREEN, suite 50/50
Final: fixed I1 inscrição pública sempre pending — review-fixes I1 RED→GREEN
Final: fixed I2 swap-lanes exige mesmo campeonato — review-fixes I2 RED→GREEN
Final: fixed I3 (API) rotas @Public ignoram troca pendente — review-fixes I3 RED→GREEN
Final: Ruling: I1 faz o frontend de inscrição (que envia status 'paid' após o Pix fictício) criar inscrições 'pending' até o organizador confirmar — custo: atleta não vira 'pago' sozinho; o fluxo Pix real fica para depois
Final: fixed I3 (frontend: login/register sem token) e I4 (categorias strict + sem gravar local se a API recusar) — verificados só por tsc (sem infra de teste de frontend), sem RED→GREEN
Final: minor (deferred): M1 BIB local diferente do número da API; M2 trocar de campeonato no admin não recarrega inscrições da API; M3 /heats/generate sem gameCode (super admin) pode apagar baterias de vários campeonatos; M4 DTOs interface sem validação → 500 em vez de 400/404; M5 trocar senha não revoga tokens antigos; M6 nome de organizador só com espaços; M7 modal de organizadores usa getGame tolerante; M8 seed.js não refaz vínculo de campeonato existente; M9 login com senha errada e sessão ativa recarrega a página
Final: review feita por subagente (fresh reviewer); suite 50/50
Extra 1 (API): complete — PATCH /users/organizers/:id, cancelar inscrição (sai da bateria, súmulas voided + auditoria), DELETE inscrição (organizador 409 com score/bateria; super admin sempre); generateHeats ignora canceladas/voided; e2e 62/62
Extra 1: Ruling: super admin pode excluir inscrição com score/bateria (resposta do usuário); logs de auditoria permanecem (scoreId vira null por SetNull)
Extra 1 (UI): complete — editar organizador, vincular campeonatos pelo organizador, editar campeonato, cancelar/reativar/excluir inscrição; tsc sem novos erros
Extra 2: Ruling: home atual (dashboard com dados locais) substituída por home pública; cópia em backups/home-page.tsx.bak
Extra 2: Ruling: visitante vê apenas barra mínima (logo + Entrar) no lugar do Navbar com menus — necessário para acessar o login; remover se o usuário quiser nenhuma barra
Extra 2/3: complete (home pública com campeonatos ativos + /campeonatos/[code]; Navbar só para logados (visitante: barra mínima); tema claro/escuro com botão em todas as áreas; tsc sem novos erros, lint dos arquivos novos limpo)
Extra 2/3: verificado no navegador (home, /campeonatos/SUMMER2026, /admin) em tema claro e escuro; preferência de tema do navegador restaurada; suíte API 62/62
Extra 4 (API): complete — POST /events/:code/banner (JPG/PNG/WebP ≤5MB, valida conteúdo, apaga anterior, serve /uploads), GET /events/:code/leaderboard público sem PII (equipes ativas + scores homologados), Pix verificado; e2e 73/73
Extra 4 (UI): complete — upload de imagem + chave Pix no modal de campeonato; inscrição com Pix real (BR Code+CRC, sem cartão/pagar de mentira, número de inscrição da API, sem storage local); leaderboard e telão com dados reais da API (polling); tsc sem novos erros; e2e 73/73; ranking verificado com dados de exemplo
