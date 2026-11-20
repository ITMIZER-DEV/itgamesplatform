# 🧠 Memória Técnica Contínua — ITGAMES Arena Platform

**Data de Atualização:** 03/11/2026 15:40  
**Versão:** 1.5.2 (SemVer)  
**Ambiente:** Docker Desktop Multi-Container (`itgames-postgres`, `itgames-api`, `itgames-platform`)  
**Deploy Remoto:** Portainer Stack CE com Auto-Sync Prisma (`docker-compose.portainer.yml`, `PORTAINER_DEPLOY_GUIDE.md`)  
**Banco de Dados:** PostgreSQL 18 (Alpine) na porta `5433:5432`  
**API Backend:** NestJS 10 + Prisma 5 na porta `3334:3333` (`0.0.0.0`)  
**Frontend:** Next.js 15 (Turbopack) na porta `3000:3000` (`0.0.0.0`)  

---


## 🏆 Quem Cria o Campeonato e Como Funciona o Fluxo Real?

### 👤 Papéis e Governança de Campeonatos
- **Organizador do Evento**:
  - Visualiza na área admin **apenas os seus campeonatos**.
  - Realiza o cadastro completo de novos campeonatos (código, nome, datas, local, banner/foto, regras de pontuação, raias da arena, modalidade).
  - O campeonato recém-criado entra como `draft` (Rascunho) aguardando liberação do Super Admin.
  - Gerencia as categorias, WODs, inscrições e corpo de juízes dos seus campeonatos.
- **Super Admin**:
  - Visualiza **todos os campeonatos** de todas as organizações e organizadores na plataforma.
  - É a autoridade que **libera para execução** (`status: 'live'`), **pausa/mantém em rascunho** (`status: 'draft'`) ou **bloqueia** (`status: 'blocked'`).
  - Possui permissão exclusiva de **Exclusão em Cascata** (`DELETE /events/:code`), que apaga em uma única transação atômica o campeonato e todas as suas entidades filhas (Categorias, Workouts, Eventos, Inscrições, Atletas, Baterias, Raias, Scores e Logs de Auditoria).

### 📝 Fluxo de Criação e Cadastro Completo de Campeonato:
1. **Acesso ao Painel Admin (`/admin`)**:
   - No topo do painel, o organizador ou super admin clica em **"+ Cadastrar Campeonato"**.
   - O formulário cadastral completo solicita:
     - **Código Único do Evento** (ex: `COPA-CROSS-2026`, `INTERBOX-SP-2026`).
     - **Nome Oficial do Torneio** (ex: *Copa Paulista de CrossFit 2026*).
     - **Tipo de Competição** (*CrossFit / Fitness Games* ou *HYROX / Fitness Racing*).
     - **Data & Local da Arena** (ex: *Ginásio do Ibirapuera - SP*).
     - **Quantidade de Raias da Arena** (de 4 a 16 raias).
     - **URL do Banner / Foto Oficial do Campeonato**.
     - **Regras de Pontuação**:
       - Critério de Classificação (*Menor pontuação vence* no CrossFit vs *Maior pontuação* em pontos corridos).
       - Toggles de Visualização Pública: Exibir Tempo, Exibir Carga (kg), Exibir Reps, Permitir Revisões Públicas.
     - **Descrição e Regulamento Geral**.
2. **Gravação no PostgreSQL via API NestJS**:
   - Requisição enviada para [`POST /events`](http://localhost:3334/api-docs#/events/EventsController_createGame).
   - O backend persiste na tabela `games` do PostgreSQL 18.
3. **Liberação pelo Super Admin**:
   - Na aba **"Campeonatos & Liberações"**, o Super Admin revisa os dados e clica em **"Liberar Execução"** (`PATCH /events/:code/status` para `live`).
4. **Exclusão em Cascata**:
   - O Super Admin pode clicar em **"Excluir Cascata"** com confirmação de segurança para purgar todo o campeonato e seus dependentes do banco.
5. **Governança & Edição Cadastral de Atletas (`PATCH /events/:code/registrations/:regCode/athletes`)**:
   - Na aba **"Inscrições & Financeiro"** (`/admin`), organizadores e super admins podem editar os dados cadastrais completos dos competidores de qualquer inscrição (individual, dupla, trio ou quarteto).
   - Dados editáveis: **Nome Completo**, **E-mail**, **Telefone/WhatsApp**, **Sexo (M/F)**, **CPF**, **Data de Nascimento (com cálculo automático de idade)**, **Tamanho da Camiseta do Kit (PP a XGG)**, **Box/Centro de Treinamento** e **Nome da Equipe**.
   - **Sincronização Bidirecional**: A alteração atualiza o registro do campeonato (`games_register_athletes`) e sincroniza com a conta do usuário (`users`) e perfil (`athlete_profiles`), mantendo histórico em auditoria (`audit_logs`).
   - Na aba global **"Atletas"** (`/admin`), **Super Admins e Organizadores** têm acesso à consulta de atletas (busca por nome/email/CPF mascarado), modal de edição cadastral (`PATCH /users/athletes/:id`) e emissão de senha temporária (`POST /users/athletes/:id/reset-password`).


### 🏋️ Gestão de Provas, Súmulas Inteligentes e Critérios Oficiais (WOD 1-A, 1-B e WOD 2)
- **WOD 1-A (800m ROW)**:
  - Critério: `for_time` com Time Cap de 05:00.
  - Se finalizar: menor tempo vence.
  - Se der Time Cap: metros faltantes para 800m somados ao resultado (`CAP + [metros faltantes]`).
- **WOD 1-B (DEATH BY — 5 ROUNDS)**:
  - Minuto 5:00 ao 6:00 de descanso/transição obrigatória.
  - Rounds progressivos a cada 3 minutos (Min 6 ao 21): Thruster + Jumping Pull-up (25/18 kg).
  - Critério: Maior número de rounds fechados vence.
  - Desempate: Menor tempo acumulado nos rounds concluídos (Tie-break).
- **WOD 2 (SYNC & BURN)**:
  - Movimentos: 50 Knee Raises + 30 Cal Air Bike + 30 Sync Burpee Step Over + 20 Sync Snatch (40/29 kg) = Total 130 reps.
  - Time Cap: 10:00 (600 segundos).
  - Critério: `for_time` (menor tempo vence).
  - Se der Time Cap: repetições faltantes acrescentadas ao tempo (`CAP + [reps faltantes]`), garantindo que quem faltou menos reps fica à frente.
- **Súmulas Inteligentes A4**:
  - `crossfit-wod1-combo-row-deathby`: Súmula integrada para prancheta única com WOD 1-A e WOD 1-B.
  - `crossfit-wod2-sync-burn`: Súmula com checkpoints dos 4 exercícios, opções de término ou CAP e tie-break na Air Bike.
- **Formatação de Cabeçalho no Leaderboard (`parseWodTitle`)**:
  - Exibe com clareza `WOD 1-A`, `WOD 1-B` e `WOD 2` com seus respectivos subtítulos, eliminando qualquer risco de duplicidade ou confusão visual no Leaderboard e no Telão de Arena (Big Screen).

### ⏱️ Juiz de Arena (Judge App - `/judge`)
- **Login Rápido por PIN de 4 Dígitos**: Autenticação individual por PIN com pré-seleção de raias atribuídas.
- **Scorekeeper Touch-First de Alta Precisão**:
  - Cronômetro de arena com registro de Time Cap e Tie-break em tempo real.
  - Botões táteis gigantes de `+1`, `+5`, `-1` reps ou controle de carga em KG.
  - **Catálogo Rápido de NO-REPs**: Seleção do motivo exato (extensão incompleta, quebra de paralelo, toque na linha, etc.).
- **Comprovante de Súmula & Assinatura Digital**:
  - Upload e compressão de foto da prancheta física de papel.
  - Pad de assinatura digital touch do atleta na tela.
  - Sincronização offline-first com backend NestJS e auditoria imutável.
- **Credenciais de Teste**: `judge@itgames.com.br` / `SenhaForte123!` (PIN: `1234`)

### 📺 Telão LED da Arena & Live Leaderboard (`/leaderboard/big-screen`)
- **Modo Full-Screen High-Contrast**: Layout otimizado para TVs e painéis LED gigantes.
- **Auto-Rotation**: Rotação suave de categorias a cada 15 segundos com confetes na troca e relógio de arena.
- **Cálculo Oficial**: Pontuação padrão CrossFit (100, 95, 90...) e HYROX (tempo líquido).

### 🏃 Atleta / Competidor (`/athlete` & `/athlete/register`)
- **Wizard de Inscrições Inteligente (`/athlete/register`)**:
  - Validação em tempo real de contagem de atletas, soma de idades e conformidade de gênero.
  - Termo de Consentimento LGPD com hash criptográfico.
  - Checkout Pix com QR Code Copia e Cola gerado.
- **Área Restrita do Atleta (`/athlete`)**:
  - **BIB Card / Credencial Digital**: QR Code de pesagem/check-in.
  - **Minhas Baterias**: Horários de largada e número da raia atribuída.
  - **Scores & Contestação**: Acompanhamento de tempo/reps e botão de contestação oficial.
- **Credenciais de Teste**: `atleta@itgames.com.br` / `SenhaForte123!`

---

## 🔒 2. Conformidade LGPD & Segurança
- **Mascaramento Global**: Interceptor NestJS mascara CPFs (`***.444.555-**`) e telefones para consultas públicas e leaderboards.
- **Isolamento de Dados**: Guard RBAC com verificação de papéis (`UserRole`) e validação de JWT.
- **PostgreSQL 18**: Montagem de volume em `/var/lib/postgresql` com migrations e seeds gerenciados pelo Prisma ORM.

---

## 🚀 3. URLs e Portas de Acesso

| Serviço | URL Externa | Porta Interna | Descrição |
| :--- | :--- | :--- | :--- |
| **Frontend Web** | `http://localhost:3000` | 3000 | Plataforma Completa Next.js 15 |
| **Inscrição de Atleta** | `http://localhost:3000/athlete/register` | 3000 | Wizard de Inscrições c/ Regras de Time |
| **Área do Atleta** | `http://localhost:3000/athlete` | 3000 | BIB QR Code e Baterias |
| **Súmulas & WODs** | `http://localhost:3000/sumulas` | 3000 | Súmulas A4 e Presets |
| **Baterias & Raias** | `http://localhost:3000/heats` | 3000 | Chaveamento, Raias Centrais e Swap |
| **App do Juiz** | `http://localhost:3000/judge` | 3000 | Touch Scorekeeper c/ PIN e NO-REP |
| **Mesa de Triagem / Admin** | `http://localhost:3000/admin` | 3000 | Split-Screen Foto vs Score & Escala |
| **Telão LED Arena** | `http://localhost:3000/leaderboard/big-screen` | 3000 | High-contrast TV LED com Auto-Rotation |
| **Backend API** | `http://localhost:3334` | 3333 | NestJS API (`0.0.0.0`) |
| **Swagger UI** | `http://localhost:3334/api-docs` | 3333 | Documentação OpenAPI |
| **PostgreSQL 18** | `localhost:5433` | 5432 | Banco `itgames_db` |




### 📊 Relatório Analítico da Competição (.Excel / XLS) & Gestão de Ocupação por Categoria (v1.5.2)
- **Correção de Truncamento de Inscrições**:
  - Resolução do bug de exportação em que identificadores BIB contendo caractere `#` (ex: `#2168`) causavam truncamento prematuro de dados no download via data URI.
  - Migração de data URI para download via `Blob` binário seguro com encoding UTF-8, garantindo 100% dos dados preservados.
- **Planilha Executiva Multi-Abas em Excel (.XLS / SpreadsheetML)**:
  - **Aba 1 (Resumo Executivo)**: Banner oficial, metadados do evento, consolidação financeira (Arrecadado, A Receber, Receita Projetada e Potencial Máximo), indicadores de participação geral e grade completa de camisetas/kits (PP a XGG).
  - **Aba 2 (Ocupação por Categoria)**: Matriz analítica contendo nome da categoria, formato, composição/gênero, valor da inscrição, limite de vagas, confirmadas/pagas, pendentes, total inscrito, vagas livres restantes, **taxa de ocupação (%)**, status de demanda (Esgotado, Alta Demanda, Aberta), contagem de competidores e receita por categoria com linha de total consolidado.
  - **Aba 3 (Inscrições Detalhadas)**: Tabela com BIB, equipe, categoria, status de pagamento, valor em R$, check-in, box/afiliação, integrantes, camisetas, telefone de contato, e-mail e data de inscrição.
  - **Aba 4 (Grade Nominal de Atletas e Kits)**: Mapeamento atleta a atleta com BIB, equipe, categoria, nome completo, CPF, gênero, tamanho de kit/camiseta, check-in individual e box para suporte à pesagem e entrega de kits.
- **Painel Visual de Ocupação no Painel Admin**:
  - Cards visuais em tempo real na aba *Inscrições & Financeiro* exibindo a taxa de ocupação percentual com barras de progresso dinâmicas (verde, âmbar, vermelho de esgotado), vagas livres e contagem de pagas/pendentes por categoria.
- **Exportação Alternativa em CSV**: Suporte simultâneo para exportação em CSV estruturado com padrão brasileiro (ponto-e-vírgula `;` e BOM UTF-8).

### 🛡️ Governança de Inscrições: Registro Administrativo, Substituição e Migração de Categorias (v1.6.0)
- **Registro Direto de Equipes/Competidores pela Governança (`POST /events/:code/admin/registrations`)**:
  - Permite que organizadores e árbitros da governança inscrevam times e competidores diretamente pelo painel administrativo (`AdminNewRegistrationModal.tsx`), sem a restrição de que o usuário logado deva ser capitão/membro da equipe.
  - Vínculo direto de atletas já existentes no ecossistema (busca via CPF/Nome e auto-preenchimento) ou cadastro de novos atletas no ato da inscrição.
  - Verificação dinâmica e em tempo real dos requisitos da categoria selecionada (formato individual/dupla/trio/quarteto, regras de gênero e limites de idade).
  - Suporte resiliente a persistência via API NestJS com fallback automático em LocalStorage (`storage.saveTeam`).
- **Substituição de Atletas com Vínculo (`POST /events/:code/registrations/:regCode/substitute-athlete`)**:
  - Modal de edição de atletas (`EditTeamAthletesModal.tsx`) aprimorado com funcionalidade de busca e vinculação de competidores cadastrados na base.
  - Re-validação rigorosa de conformidade do time com a categoria após a substituição (quantidade de membros, regras de gênero, idade individual mínima/máxima e soma de idades da equipe).
  - Trilha de auditoria automática com registro de data/hora, organizador responsável e dados do atleta substituído.
- **Migração Segura de Categoria com Validador de Regras (`PATCH /events/:code/registrations/:regCode/category`)**:
  - Interface dedicada de migração (`MigrateCategoryModal.tsx`) com matriz de conformidade visual em tempo real comparando categoria de origem e destino:
    - Verificação de formato e número de vagas por equipe.
    - Validação de gênero / composição da equipe (Masculino, Feminino, Misto).
    - Validação de idades individuais (mínima e máxima) e soma de idades do time (ex: categorias Masters).
    - Verificação de capacidade e disponibilidade de vagas na categoria destino (bloqueio de migração caso a categoria esteja esgotada).
  - Cálculo automático de diferença financeira entre as categorias.
  - Execução atômica no banco de dados via transação Prisma:
    - Atualização do código de categoria da inscrição (`registration.categoryCode`).
    - Atualização da categoria de todos os atletas vinculados (`athlete.category`).
    - Atualização dos registros de pontuação (`score.category`).
    - Desassociação e liberação segura de raias/baterias anteriores (`LaneSlot`), prevenindo inconsistências de chaveamento de baterias.
    - Registro de log de auditoria com justificativa da migração e organizador executor.

### 🔓 Acesso Desmascarado para Governança & Edição Resiliente de Atletas (v1.6.1)
- **Desmascaramento de Dados para a Governança no Backend (`LgpdMaskInterceptor`)**:
  - Ajuste no interceptor global LGPD do NestJS para verificar o papel do usuário autenticado (`req.user.role`).
  - Usuários com papéis de governança (`SUPER_ADMIN`, `ORGANIZER`) agora recebem os dados cadastrais completos e desmascarados (CPF real de 11 dígitos, telefone/WhatsApp completo e dados de kit), viabilizando conferência documental, pesagem e edição oficial sem bloqueios.
  - O mascaramento LGPD permanece 100% ativo para rotas públicas e usuários não autorizados.
  - Atualização na função `presentAthlete` (`users.service.ts`) para expor o campo `cpf` completo na busca administrativa de atletas.
- **Edição e Validação Resiliente no Frontend (`EditTeamAthletesModal.tsx`)**:
  - Validação de CPF aprimorada para não travar com *"CPF deve conter 11 dígitos"* caso o registro contenha asteriscos ou formatação legada.
  - Suporte à edição parcial: se o organizador alterar apenas tamanho de camiseta, nome, gênero ou box, o CPF e telefone existentes são preservados integralmente sem perda de dados.
  - Adicionado botão de atalho para redigitar CPF ou telefone completo diretamente no modal.
  - No backend (`updateRegistrationAthletes`), adicionada salvaguarda que ignora valores com `*`, assegurando que o CPF real gravado no PostgreSQL jamais seja sobrescrito por strings mascaradas.

### 🔄 Resiliência de Backup Snapshot & Persistência de Banners (v1.6.2)
- **Importação e Sincronização Segura de Snapshots (`POST /backup/import`)**:
  - Resolução do erro 500 (`Unique constraint failed on the fields: (id)`) durante a restauração de backups JSON (`itgames-snapshot-*.json`).
  - Implementação de busca multi-chave para usuários (`id`, `email`, `cpf`) antes da criação/atualização no Prisma, evitando conflito de primary key e preservando os IDs autogerados.
  - Vínculo resiliente de `athleteProfile` associado ao `userId` real do registro.
  - Correção na atualização de Eventos (`games_events`), utilizando a chave primária composta `@@id([idEvent, game])` no Prisma (`where: { idEvent_game: { idEvent, game } }`).
  - Tratamento individualizado por entidade com logs descritivos, impedindo que inconsistências isoladas aborte a restauração de todo o banco de dados.
- **Persistência de Banners e Mídias no Docker**:
  - Mapeamento explícito do volume `./itgames-api/uploads:/app/uploads` em `docker-compose.yml` e `docker-compose.override.yml`, prevenindo perda de imagens ao recriar contêineres.
  - Disponibilização do banner de evento `SUMMER2026-1791259022141.jpg`.

### 🎯 Espelhamento Exato de Snapshot & Gestão Fidedigna de Cancelados (v1.6.3)
- **Restauração com Purga Automática de Entidades Obsoletas (`POST /backup/import`)**:
  - A importação de snapshots foi elevada de um simples *upsert cumulativo* para um **espelhamento exato** das entidades do campeonato no banco de dados.
  - Para cada campeonato presente no snapshot, o sistema remove automaticamente do banco de dados registros órfãos que não constam no arquivo:
    - **Categorias Obsoletas/Excluídas**: Excluídas com segurança em cascata.
    - **Inscrições Obsoletas**: Inscrições excluídas ou canceladas que não constam no snapshot são purgadas.
    - **Atletas Removidos**: Atletas excluídos de equipes têm seus registros sincronizados.
    - **Workouts, Eventos de Prova, Baterias e Súmulas**: Alinhados para espelhar rigorosamente o snapshot importado.
- **Sincronização Bidirecional e Purga de Cache Local (`localStorage`)**:
  - Implementação de `storage.clearGameCache(gameId)`, `storage.setTeamsForGame` e `storage.setCategoriesForGame` no frontend.
  - O modal de restauração (`BackupRestoreModal.tsx`) invalida o cache local do navegador ao concluir o restore, garantindo que dados obsoletos do `localStorage` não reapareçam na interface.
  - Ajuste no carregamento da página de administração (`AdminPage`): as inscrições recebidas da API NestJS passam a ser a fonte canônica da verdade, atualizando o storage em vez de manter inscrições antigas do cache do navegador.
- **Métricas Fidedignas no Painel Financeiro e Inscrições**:
  - Correção no card *"A Receber (Pendente)"*: corrigido filtro anterior (`status !== 'paid'`) que contabilizava erroneamente inscrições canceladas (`cancelled`) como pendentes a receber. Agora filtra estritamente `status === 'pending'`.
  - No card *"Total de Inscrições"*, agora contabiliza inscrições ativas e exibe badge com a contagem de canceladas.
  - No card *"Kits & Camisetas"*, camisetas de inscrições canceladas foram desconsideradas das contagens ativas de logística de entrega.

### 🏋️ Provas Duplas / Combo Split & Súmula Unificada A4 (v1.6.4)
- **Motor de Ranqueamento de For Time com CAP Residual (`workout-order.ts` / `engine.ts`)**:
  - Aprimoramento da ordenação em provas `for_time`: quem conclui no menor tempo fica à frente. Para duplas/atletas que atingem o Time Cap (`time >= cap`), o critério ordena pelo menor número de metros/repetições faltantes (`a.reps - b.reps`), exibindo `CAP +X` com precisão.
  - No formato `amrap` com Rounds (Death By), maior número de rounds completados vence (`b.reps - a.reps`). Em caso de empate, o menor tempo acumulado de tie-break desempata automaticamente.
- **Template de Súmula Unificada A4 (`crossfit-wod1-combo-row-deathby`)**:
  - Adicionado template oficial de folha única A4 em `sumula-presets.ts` integrando **WOD 1-A (800m Row)**, **REST 1 min** e **WOD 1-B (Death By 5 Rounds)**, permitindo que o juiz de raia avalie toda a prova na mesma prancheta sem troca de folhas.
- **Simulação Homologada na Categoria `INICIANTE - DUPLA FEMININA`**:
  - Cadastro de `WOD 1-A` e `WOD 1-B` com 12 duplas avaliadas e Leaderboard consolidado em tempo real.
- **Tabela Oficial de Pontuação dos Games (`points_table`)**:
  - Configurado o campeonato `SUMMER2026` com a tabela oficial de pontuação decrescente dos Games:
    - 1º: 100 pts | 2º: 94 pts | 3º: 88 pts | 4º: 84 pts | 5º: 80 pts | 6º: 76 pts | 7º: 72 pts | 8º: 68 pts | 9º: 64 pts | 10º: 60 pts
    - A partir do 11º: decresce de 2 em 2 pontos (58, 56, 54, 52, 50, ..., até 1 pt).
  - Configurado `isLowestPointsBetter: false` (quem acumula mais pontos vence a competição) e desempate por `last_workout`.

### 📋 Mesa do Head Judge, Súmulas A4 & Auditoria com Foto Obrigatória (v1.6.5)
- **Súmula Oficial WOD 3 (Maximum Lift - Hang Clean n' Jerk Duplas) com 10 Tentativas**:
  - Criação do preset oficial `crossfit-wod3-maximum-lift` em `sumula-presets.ts`.
  - Tabela completa de 1ª a 10ª tentativa com colunas estruturadas: `TENT.`, `ATLETA A (KG)`, `ATLETA B (KG)`, `TOTAL DUPLA (KG)`, `VALIDAÇÃO JUIZ ([BOM] / [NO-REP])` e `CRONÔMETRO / TIE-BREAK`.
  - Box de destaque para cálculo e homologação da **Maior Carga Total Válida da Dupla (Atleta A + Atleta B)** e tie-break oficial.
- **Padronização Estrita para Impressão A4 Retrato (`@page { size: A4 portrait; }`)**:
  - Otimização do `globals.css` com margens de impressão padronizadas (`8mm 6mm`), quebra de página mandatória (`page-break-after: always`) por prancheta e preservação exata de cores (`-webkit-print-color-adjust: exact`).
  - Súmula do WOD 1-B expandida com todos os 5 rounds (Round 1 a 5, Min 06:00 ao 21:00) visíveis em prancheta única.
- **Mesa do Head Judge: Central de Digitação, Auditoria & Homologação (`/sumulas?tab=head_judge_desk`)**:
  - Nova aba interativa (Aba 4) projetada especificamente para o fluxo de campo dos campeonatos presenciais:
    - O juiz de pista preenche a súmula física na prancheta e entrega à Mesa Técnica.
    - O Head Judge seleciona Categoria, WOD e Bateria (Heat).
    - **Regra Obrigatória de Foto**: O sistema impede a homologação do score sem que a foto nítida da súmula física assinada seja anexada (via câmera direta do celular ou upload de imagem).
    - **Modal de Auditoria Visual (Lightbox / Zoom)**: Permite ao Head Judge ampliar a foto em tela cheia para conferir assinaturas, rasuras e anotações dos juízes de pista.
    - **Campos de Digitação Específicos por WOD**:
      - *WOD 1-A*: Alternância Tempo Concluído vs TIME CAP + Metros Faltantes.
      - *WOD 1-B*: Seletor de rounds completados (1 a 5) com tie-break.
      - *WOD 2*: Alternância Tempo Concluído vs TIME CAP + Reps Faltantes.
      - *WOD 3*: Digitação das cargas individuais (Atleta A + Atleta B) com cálculo da soma da dupla em tempo real.
    - **Atualização Instantânea**: Ao homologar, salva o score no banco de dados e no storage local auditado, recalculando imediatamente a classificação geral no Leaderboard.
  - Atalho direto integrado no Painel Administrativo (`/admin` na aba de Auditoria de Súmulas).
- **Gabinete & Cockpit do Head Judge (Controle Total na Rota `/head-judge`)**:
  - Nova área completa e centralizada para o Chefe de Arbitragem com 5 módulos dedicados:
    1. *Lançamento & Homologação de Súmulas*: Com foto obrigatória, zoom em tela cheia e formulários adaptados para cada WOD.
    2. *Julgamento de Recursos & Retificações*: Análise de protestos de atletas/box com deferimento (retificação de tempo/reps/carga com justificativa técnica) ou indeferimento.
    3. *Livro de Penalidades*: Aplicação de acréscimo de tempo, desconto de repetições por no-rep retroativo e desclassificações oficiais (D.Q.).
    4. *Escala dos Juízes de Pista*: Monitoramento das raias ativas e conferência das entregas das pranchetas.
    5. *Trilha de Auditoria Imutável*: Histórico auditado de todas as decisões tomadas pelo Head Judge com carimbo de tempo.
  - **Botão de Ação Rápida: Congelamento do Leaderboard**: Permite ao Head Judge congelar e descongelar o placar ao vivo para o público e telões com um clique.
  - **Menu Superior (Navbar)**: Adicionado o botão `⚖️ Mesa Head Judge` com destaque visual no menu principal para Organizadores, Super Admins e Juízes.

### 📱 UX Mobile-First, Blindagem do Placar, Inscrições & Fluxo por Categoria (v1.6.6)
- **Overlay "LEADERBOARD BLOQUEADO" (`/leaderboard` e `/leaderboard/big-screen`)**:
  - Sincronização instantânea do estado congelado/bloqueado entre a Mesa do Head Judge, `/leaderboard` e `/leaderboard/big-screen` via API (`status: 'frozen'`), `BroadcastChannel('itgames_freeze_channel')`, `localStorage` e polling.
  - Exibe overlay visual explícito de `"LEADERBOARD BLOQUEADO"` enquanto congelado, mantendo o último placar visível por trás sem vazar novas súmulas.
- **Bloqueio de Inscrições por Flag Manual & Janela de Datas**:
  - Adicionados `registrationLocked`, `registrationStartAt` e `registrationCloseAt` no Prisma (`Game`), DTO (`UpdateRegistrationLockDto`), endpoint `PATCH /events/:code/registration-lock` e validação na criação de inscrições.
  - Integrado ao painel `/admin`, à página pública `/campeonatos/[code]` e ao fluxo `/athlete/register` via helper `evaluateRegistrationAvailability`.
- **Motor Oficial de Classificações no Head Judge (`standings-engine.ts`)**:
  - Aba `2. ⚡ Rodar Classificações & Ranking` em `/head-judge` permitindo apurar 1 prova, 1 categoria inteira ou todas as categorias com critérios oficiais de desempate (melhores colocações sucessivas e última prova) + confirmação oficial na API.
- **Responsividade Mobile-First Global**:
  - Barra de navegação inferior fixa (`lg:hidden`) e drawer responsivo no `Navbar.tsx` + ajustes de toque em `/judge`, `/head-judge`, `/heats` e `/admin`.
- **Fluxo Hierárquico `Categoria → WOD (Ordem Natural) → Baterias` & Gerador em Lote**:
  - Utilitário `sortWorkoutsNaturally` em `src/lib/board.ts` garantindo sequência `WOD 1-A → WOD 1-B → WOD 2 → WOD 3` em todo o sistema e no motor de classificação.
  - Unificação dos cards de Categoria, seletor compacto e painel integrado de WOD + Baterias em `/campeonatos/[code]`.
  - Filtros rápidos em pílulas nas telas `/heats`, `/judge`, `/head-judge` e `/admin`, além de geração de baterias em lote por **Categoria** ou **Campeonato Inteiro** em `/heats`.

### 📺 Show de Arena no Fire TV Stick (`itgames-tv`) & Telões: Revisão por Categoria, Chamada de Raias e Cerimônia de Pódio (v1.6.7)
- **Congelamento Seletivo por Categoria ou Todas (`POST /screens/:id/freeze`, `POST /screens/freeze-all`)**:
  - Permite congelar o campeonato inteiro (**Todas as Categorias**) ou selecionar **1 ou mais categorias específicas** (ex.: *SCALED MASCULINO — CATEGORIA EM REVISÃO*) tanto em `/telas` quanto na Mesa do Head Judge (`/head-judge`).
  - Quando uma categoria específica está em revisão, a rotação do Firestick (`itgames-tv`), do Telão Web (`/leaderboard/big-screen`) e as abas do Placar Público (`/leaderboard`) mantêm as demais categorias ao vivo normalmente e exibem o card de bloqueio (`FrozenOverlay`) apenas na categoria em revisão, preservando o snapshot congelado das pontuações daquela categoria.
- **Chamada de Atletas para as Raias (`heat_call` — Arena Call Room)**:
  - Acionável remotamente em `/telas`, `/heats` (botão *"📢 Chamar no Telão"* em cada bateria) e `/head-judge` (`POST /screens/spotlight`), ou diretamente pelo controle remoto do Firestick (tecla `▲` -> Barra de Comando da Arena).
  - Exibe na TV o cabeçalho pulsante *"CHAMADA OFICIAL DE ARENA • CALL ROOM"*, Nome do Campeonato, Categoria, WOD, Número da Bateria, Horário de Largada e o Grid de Raias (`RAIA 01`, `RAIA 02`...) com BIB, Nome da Equipe, Nomes dos Atletas e colocação geral atual.
- **Cerimônia Oficial de Pódio — Anúncio dos Vencedores da Categoria (`podium`)**:
  - Acionável remotamente em `/telas` e `/head-judge` ou diretamente pelo controle remoto do Firestick.
  - Tela cinematográfica com animação de partículas douradas e Pódio Olímpico em 3 colunas (🥈 2º Lugar Prata à esquerda, 🥇 1º Lugar Campeão Ouro elevado ao centro, 🥉 3º Lugar Bronze à direita + faixa Top 5 com 4º e 5º lugares).
  - Suporta **Modo Suspense Automático (3º ➔ 2º ➔ 1º Lugar)**, **Suspense Controlado pelo Locutor** (avançando passo a passo pelo painel ou tecla `OK` do controle do Firestick) e **Pódio Completo Imediato**.
- **Prevenção de Suspensão no Fire TV Stick**:
  - `FLAG_KEEP_SCREEN_ON`, `PowerManager.WakeLock` (`SCREEN_BRIGHT_WAKE_LOCK`), `WifiManager.WifiLock` e modo Immersive Fullscreen ativos no APK compilado em `public/downloads/itgames-telao.apk`.










