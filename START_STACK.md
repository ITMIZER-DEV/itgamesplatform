# 🚀 ITGames Arena • Stack Completa

A stack completa do **ITGames Arena** reúne todos os componentes necessários para operar competições esportivas de grande porte (CrossFit & HYROX).

```
┌────────────────────────────────────────────────────────────────────────┐
│                        ITGAMES ARENA FULLSTACK                         │
├───────────────────┬────────────────────────────┬───────────────────────┤
│ 🖥️ FRONTEND        │ ⚙️ BACKEND API              │ 🐘 DATABASE           │
│ Next.js 15        │ NestJS 10                  │ PostgreSQL 18         │
│ Porta: 3000       │ Porta: 3333                │ Porta: 5433 (ext)     │
│ Dark Neon Arena   │ Swagger OpenAPI            │ Volume Persistente    │
│ Súmulas & Juiz    │ Auditoria & Fotos          │ Prisma 5 ORM          │
└───────────────────┴────────────────────────────┴───────────────────────┘
```

---

## 🐳 Como Subir a Stack Completa com Docker (1 Comando)

Na raiz do projeto (`d:\Projects\fitness\itgames`):

```bash
docker compose up -d --build
```

### 🌐 Links de Acesso

| Serviço | URL de Acesso | Descrição |
|---|---|---|
| **🖥️ Frontend App** | [http://localhost:3000](http://localhost:3000) | Dashboard, Súmulas A4, App do Juiz, Live Leaderboard, Portal do Atleta e Telão LED |
| **🚀 Backend API** | [http://localhost:3333](http://localhost:3333) | API REST com Upload de Fotos de Súmula e Heats |
| **📑 Swagger UI** | [http://localhost:3333/api-docs](http://localhost:3333/api-docs) | Documentação interativa dos endpoints da API |
| **🐘 PostgreSQL 18** | `localhost:5433` | Banco de dados (User: `itgames_user`, Password: `itgames_password`, DB: `itgames_db`) |

---

## 💻 Como Parar a Stack

```bash
docker compose down
```

---

## 📱 Acesso via VPN ou Celular / Tablet de Arena

A aplicação está configurada para escutar em `0.0.0.0`, permitindo que juízes com tablets na arena ou organizadores acessem diretamente através do IP da máquina ou da VPN:

- **Frontend na Arena:** `http://<SEU_IP_OU_VPN>:3000`
- **Swagger na Arena:** `http://<SEU_IP_OU_VPN>:3333/api-docs`
