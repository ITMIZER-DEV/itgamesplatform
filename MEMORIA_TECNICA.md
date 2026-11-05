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

