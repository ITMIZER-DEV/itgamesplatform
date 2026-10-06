# 🚀 Guia de Deploy no Portainer — ITGAMES Arena Platform

Este documento contém o passo a passo completo e definitivo para realizar o deploy da plataforma **ITGAMES Arena** (`PostgreSQL 18`, `NestJS API` e `Next.js 15 Platform`) em um servidor remoto utilizando o **Portainer**.

---

## 📋 Pré-requisitos no Servidor Remoto

1. Servidor Linux (Ubuntu 22.04/24.04 LTS ou Debian 12) com **Docker** e **Docker Compose** instalados.
2. **Portainer CE** rodando no servidor (porta `9000` ou `9443`).
3. Portas liberadas no Firewall (UFW / Security Group):
   * `3000` — Frontend Web da Plataforma ITGames
   * `3334` — Backend API NestJS
   * `5433` — Banco de Dados PostgreSQL (Opcional se acesso externo for necessário)
   * `80` e `443` — Se for utilizar Nginx / Traefik / Cloudflare com SSL.

---

## 🛠️ Método 1: Deploy via Portainer Stack (Recomendado via Git)

### Passo 1: Acessar o Portainer
1. Abra o painel do seu Portainer (`https://seu-ip:9443` ou `http://seu-ip:9000`).
2. Vá em **Environment** (ou **local**) ➡️ **Stacks** ➡️ Clique em **`+ Add stack`**.

### Passo 2: Configurar a Stack
1. **Name:** `itgames-arena`
2. **Build method:** Selecione **Repository** (ou **Web editor**).

#### Opção A — Se usando Repositório Git (GitHub / GitLab):
* **Repository URL:** `https://github.com/seu-usuario/itgames.git`
* **Repository reference:** `refs/heads/main` (ou sua branch de produção)
* **Compose path:** `docker-compose.portainer.yml` (ou `docker-compose.yml`)
* **Auto update:** Ative o **Webhook** ou **Poll periodically** para auto-deploy ao dar `git push`.

#### Opção B — Se usando Web Editor (Upload Manual):
Cole o conteúdo do arquivo [`docker-compose.portainer.yml`](file:///d:/Projects/fitness/itgames/docker-compose.portainer.yml) diretamente no editor do Portainer.

---

### Passo 3: Configurar as Variáveis de Ambiente (.env)
No campo **Environment variables** do Portainer (ou seção *Advanced configuration*), adicione:

| Variável | Exemplo de Valor | Descrição |
| :--- | :--- | :--- |
| `POSTGRES_USER` | `itgames_user` | Usuário do banco PostgreSQL |
| `POSTGRES_PASSWORD` | `SuaSenhaForte2026!#` | Senha segura do banco |
| `POSTGRES_DB` | `itgames_db` | Nome do banco de dados |
| `POSTGRES_PORT` | `5433` | Porta externa do banco |
| `JWT_SECRET` | `itgames_jwt_chave_super_secreta_prod_2026` | Chave criptográfica para JWT |
| `NEXT_PUBLIC_API_URL` | `http://SEU_IP_OU_DOMINIO:3334` | URL pública da API acessível pelo navegador |
| `CORS_ORIGIN` | `*` ou `http://SEU_IP_OU_DOMINIO:3000` | Origens CORS permitidas |
| `FRONTEND_PORT` | `3000` | Porta do Frontend |
| `API_PORT` | `3334` | Porta da API |

---

### Passo 4: Fazer o Deploy
1. Clique no botão azul **`Deploy the stack`**.
2. O Portainer irá:
   * Baixar a imagem do PostgreSQL 18.
   * Construir a imagem da API NestJS (gerando Prisma Client).
   * Construir a imagem do Frontend Next.js.
   * Inicializar e rodar o `docker-entrypoint.sh` para aplicar automaticamente o schema no banco de dados.

---

## 👥 Passo 5: Rodar o Seed Inicial dos Usuários & Permissões

Após os containers estarem com status **Healthy / Running**:

1. No Portainer, clique em **Containers** ➡️ Clique no container **`itgames-api`**.
2. Clique no botão **`>_ Console`** ➡️ Selecione `/bin/sh` ➡️ Clique em **Connect**.
3. No terminal aberto dentro do container, execute:
   ```sh
   npx prisma db seed
   ```
4. Isso criará instantaneamente os usuários oficiais:
   * **Super Admin:** `leonardo.alves@itmizer.com.br` / Senha: `Adm@itmizer`
   * **Organizador:** `phg.ajls@gmail.com` / Senha: `Adm@itmizer`
   * **Organizador Secundário:** `organizador@crossfitgames.com.br` / Senha: `Adm@itmizer`
   * **Juiz Arbitragem:** `judge@itgames.com.br` / Senha: `Adm@itmizer`
   * **Atleta Demonstração:** `atleta@itgames.com.br` / Senha: `Adm@itmizer`

---

## 💳 Onde Cadastrar a Chave Pix da Competição no Sistema?

Para definir a Chave Pix oficial do seu campeonato (que será exibida no checkout e na ficha do atleta para envio de comprovante):

1. Acesse o painel administrativo: **`http://SEU_IP:3000/admin`**
2. Faça login como **Super Admin** (`leonardo.alves@itmizer.com.br`) ou **Organizador** (`phg.ajls@gmail.com`).
3. Na aba **"Campeonatos & Liberações"**:
   * Clique em **`+ Cadastrar Campeonato`** (ou no campeonato ativo).
   * No formulário, preencha os dados do campeonato e a seção **"Configurações Financeiras & Pix"**:
     * **Chave Pix da Competição:** Informe o E-mail, CNPJ, Celular ou Chave Aleatória (ex: `financeiro@summercross.com.br`).
     * **Titular / Favorecido:** Nome da empresa ou organizador receptor (ex: `Summer Cross Eventos Esportivos`).
4. Clique em **Salvar**.
5. Automaticamente:
   * Todos os atletas que se inscreverem no campeonato visualizarão essa chave Pix no checkout.
   * No Portal do Atleta ([`/athlete`](http://localhost:3000/athlete)), o botão **Copiar Chave Pix** copiará a chave exata configurada para o torneio!

---

## 🔒 Passo 6: Configuração de Domínio e SSL/HTTPS (Opcional - Nginx Proxy Manager)

Se desejar utilizar domínio com SSL gratuito (Let's Encrypt), configure 2 Proxy Hosts no seu Nginx Proxy Manager / Traefik:

1. **Frontend Web:**
   * **Domain Names:** `arena.seudominio.com.br`
   * **Forward Hostname / IP:** `itgames-platform` (ou IP local)
   * **Forward Port:** `3000`
   * **SSL:** Force SSL ✅

2. **Backend API:**
   * **Domain Names:** `api-arena.seudominio.com.br`
   * **Forward Hostname / IP:** `itgames-api` (ou IP local)
   * **Forward Port:** `3333` (ou `3334`)
   * **SSL:** Force SSL ✅

*Ao utilizar domínios com SSL, lembre-se de atualizar a variável `NEXT_PUBLIC_API_URL=https://api-arena.seudominio.com.br` na stack do Portainer.*

---

## 📊 Status dos Serviços
* **Frontend:** `http://localhost:3000` (ou IP público)
* **Backend API:** `http://localhost:3334`
* **Documentação Swagger:** `http://localhost:3334/api-docs`
* **PostgreSQL:** `localhost:5433`
