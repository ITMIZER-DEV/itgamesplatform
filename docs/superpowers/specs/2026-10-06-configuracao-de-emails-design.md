# Configuração de envio de e-mails — Design

Data: 2026-10-06 · Status: aguardando revisão

## Objetivo

O super admin configura, dentro do sistema, o envio de e-mails pelo Google Workspace (SMTP) e escolhe quais e-mails são enviados e com qual texto. Primeira versão: recuperação de senha, confirmação de inscrição, confirmação de pagamento e três alertas.

Hoje não existe nenhum envio de e-mail no projeto, e também não existe "esqueci minha senha" (só troca de senha logada em `/auth/change-password`).

## Decisões já tomadas

- Credenciais SMTP ficam **no banco**, editadas pela tela, com a senha **criptografada**.
- Alertas da v1, todos disparados por evento (sem agendador): nova inscrição → organizadores, inscrição cancelada, campeonato liberado/bloqueado.
- Envio direto e assíncrono, com log do resultado e botão de reenviar. Sem fila nem retentativa automática.

## Fora do escopo

Retentativa automática, e-mail de senha temporária do organizador, alertas por agendador (ex.: pagamento pendente há X dias), anexos, envio em massa, bounce/webhooks.

## Dados (apenas tabelas novas, aplicadas por `prisma db push` sem perda de dados)

| Tabela | Campos |
|---|---|
| `mail_settings` (1 linha, `id = 1`) | `enabled`, `host`, `port`, `secure` (`starttls` \| `ssl`), `username`, `passwordEnc`, `fromName`, `fromAddress`, `appBaseUrl`, `updatedAt` |
| `mail_templates` | `type` (PK), `enabled`, `subject`, `body`, `updatedAt` |
| `email_logs` | `id`, `type`, `toAddress`, `subject`, `status` (`sent` \| `failed` \| `skipped`), `error`, `payload` (JSON com variáveis, para reenviar; nulo em `password_reset`, porque o link tem o token, e no teste), `createdAt` |
| `password_reset_tokens` | `id`, `userId` (FK, cascade), `tokenHash` (único), `expiresAt`, `usedAt`, `createdAt` |

- `passwordEnc`: AES-256-GCM, formato `iv:tag:cipher` em base64. Chave de 32 bytes derivada (SHA-256) de `MAIL_ENCRYPTION_KEY`; se ausente, de `JWT_SECRET`. Trocar a chave invalida a senha salva, e a tela passa a mostrar "senha não definida".
- Tipos de template: `password_reset`, `registration_confirmed`, `payment_confirmed`, `alert_new_registration`, `alert_registration_cancelled`, `alert_game_status`.
- Os textos **padrão em português ficam no código** (`mail/default-templates.ts`). A linha em `mail_templates` só existe depois de uma edição; sem linha, vale o padrão e `enabled = true`. "Restaurar padrão" apaga a linha.

## Módulo `mail` (API)

- `MailService.send(type, to, vars)`:
  1. Lê as configurações e o template (padrão ou editado). Se o envio geral estiver desligado, o tipo desligado ou a configuração incompleta, grava log `skipped` e retorna.
  2. Renderiza assunto e corpo: substitui `{{variavel}}` por valores com **escape de HTML** e converte quebras de linha em `<br>`.
  3. Envia por `nodemailer` e grava `sent` ou `failed` (com a mensagem de erro, sem a senha).
  4. É chamado **sem `await`** pelos gatilhos e nunca lança exceção: falha de e-mail não derruba a operação que o originou.
- O transporte é criado a cada envio a partir da configuração atual (sem cache), então uma troca de credencial vale na hora.
- Gmail/Workspace: `smtp.gmail.com`, porta 587 (`starttls`) ou 465 (`ssl`), usuário e **senha de app**. O endereço remetente deve ser a conta ou um alias dela. Isso aparece como texto de ajuda na tela.

### Variáveis por tipo

| Tipo | Destinatário | Variáveis |
|---|---|---|
| `password_reset` | o próprio usuário | `nome`, `link`, `validade` |
| `registration_confirmed` | cada integrante | `nome`, `campeonato`, `categoria`, `equipe`, `numero`, `valor` |
| `payment_confirmed` | cada integrante | `nome`, `campeonato`, `categoria`, `equipe`, `numero` |
| `alert_new_registration` | organizadores **ativos** do campeonato | `nome`, `campeonato`, `categoria`, `equipe`, `numero`, `integrantes` |
| `alert_registration_cancelled` | integrantes + organizadores ativos | `nome`, `campeonato`, `categoria`, `equipe`, `numero` |
| `alert_game_status` | organizadores ativos | `nome`, `campeonato`, `status` |

## Endpoints (todos `SUPER_ADMIN`, exceto os de senha)

- `GET /mail/settings`: devolve tudo menos a senha, com `passwordSet: boolean`.
- `PUT /mail/settings`: valida (host, porta, e-mails). `password` ausente ou vazio mantém a atual.
- `POST /mail/settings/test`: envia um e-mail de teste ao e-mail do super admin logado e **devolve o erro real do SMTP** na resposta.
- `GET /mail/templates`: os 6 tipos, com padrão, valor atual e variáveis. `PUT /mail/templates/:type`. `DELETE /mail/templates/:type` restaura o padrão. `POST /mail/templates/:type/preview` renderiza com dados de exemplo.
- `GET /mail/logs?status=&limit=`, `POST /mail/logs/:id/resend` (reenvia com o `payload` gravado; sem payload, como `password_reset` e teste, responde 400).
- `POST /auth/forgot-password` (público) `{ email }`: **sempre 200**, com a mesma resposta existindo ou não a conta. Se existir, gera token aleatório (32 bytes), guarda só o hash, validade de 1 hora, e envia `password_reset`. Limite de 3 pedidos por hora por e-mail e de 60 por hora por origem (IP), com contador em memória; o teto por origem é alto porque, atrás do proxy do frontend, todos os usuários chegam do mesmo IP (o projeto não tem throttler; reiniciar a API zera o contador, aceitável nesta versão). Acima do limite a resposta continua 200, sem enviar. Contas sem e-mail configurado ou com envio desligado ficam em `skipped`.
- `POST /auth/reset-password` (público) `{ token, newPassword }`: valida o hash, a expiração e se está sem uso; aplica a regra atual de senha (mínimo 8); troca a senha; zera `mustChangePassword`; marca `usedAt`; invalida os demais tokens do usuário. Token inválido, expirado ou usado retorna 400 com mensagem única.

## Gatilhos

- `registerTeam` (depois de gravar): `registration_confirmed` para cada integrante e `alert_new_registration` para os organizadores ativos.
- `updateRegistrationStatus`: ao passar para pago, `payment_confirmed` aos integrantes; ao cancelar, `alert_registration_cancelled`. Só dispara quando o status **muda** (não em repetição).
- `updateGameStatus`: para `live` ou `blocked`, `alert_game_status` aos organizadores ativos. Outros status (`draft`) não enviam.
- Destinatários vêm dos `User` (e-mail do cadastro de cada integrante, por CPF) e de `GameOrganizer` com `active = true`.

## Frontend (`itgames-platform`)

- Aba **"E-mails"** em `/admin`, só para `SUPER_ADMIN`, como as abas existentes.
  - **Servidor**: campos, ajuda do Google Workspace, indicador "senha definida", botão **Testar envio** (mostra o erro retornado) e chave geral ligado/desligado.
  - **Tipos de e-mail**: um cartão por tipo, com liga/desliga, assunto, corpo, lista de variáveis, prévia e "Restaurar padrão".
  - **Histórico**: tabela com data, tipo, destinatário, status e erro; falhas em destaque; botão Reenviar.
- Login: link **"Esqueci minha senha"** (modal ou aba com campo de e-mail) e página `/redefinir-senha?token=` com nova senha e confirmação.

## Erros e segurança

- Senha SMTP nunca sai da API, nunca vai para log nem para `email_logs`; o campo de teste/resposta não a ecoa.
- `appBaseUrl` precisa ser `http(s)://` e é a única origem usada nos links. Não se usa o `Host` da requisição.
- `forgot-password` não revela se a conta existe (resposta e tempo equivalentes: o envio roda em segundo plano).
- Variáveis do usuário (nomes, equipes) passam por escape de HTML no corpo.
- Configuração ausente ou envio desligado = comportamento atual do sistema, sem erro.

## Testes (e2e, Postgres de teste)

O transporte `nodemailer` é substituído por um fake injetável, sem rede.

- Permissões: configurações, templates, logs e teste só para `SUPER_ADMIN` (401/403 para os demais).
- `GET /mail/settings` nunca devolve a senha; `PUT` sem senha mantém a anterior; a senha gravada no banco difere da enviada e descriptografa de volta.
- Envio desligado ou tipo desligado grava `skipped` e não chama o transporte; falha do transporte grava `failed` e **não** quebra `registerTeam`.
- Reset: pedido para e-mail existente e inexistente retorna a mesma resposta; token válido troca a senha e permite login; token reutilizado, expirado ou inválido retorna 400; limite de pedidos.
- Gatilhos: inscrição envia ao capitão, aos parceiros e aos organizadores ativos (suspenso não recebe); pagamento e cancelamento só disparam na mudança de status; `live`/`blocked` enviam e `draft` não.
- Template editado vale no envio; "restaurar padrão" volta ao texto do código; variável com HTML sai escapada.

## Implantação

- Dependência nova: `nodemailer` (API).
- Variável opcional `MAIL_ENCRYPTION_KEY` no serviço `api` (compose e Portainer). Sem ela usa `JWT_SECRET`.
- Só tabelas novas, aplicadas pelo `prisma db push` do entrypoint (sem `--accept-data-loss`). Nenhuma tabela existente é alterada.
