# ITGames Arena Platform 🏋️‍♂️🏃‍♀️

Plataforma unificada e de alta performance para gestão de competições de **CrossFit**, **HYROX / Fitness Racing** e eventos esportivos.

---

## 🚀 Como Executar

Abra o terminal na pasta `itgames-platform` e execute:

```bash
cd itgames-platform
npm run dev
```

> **Acesso Local e via VPN:**
> O servidor está configurado para escutar em `0.0.0.0:3000`. Isso permite acesso:
> - No seu computador: `http://localhost:3000`
> - Em outros computadores/celulares na mesma rede local ou via **VPN**: `http://<SEU_IP_OU_IP_VPN>:3000`

---

## 🌟 Módulos Implementados

### 1. 📋 Módulo de Súmulas Inteligentes (`/sumulas`)
- **Impressão em Lote para A4**: Gera todas as súmulas de uma categoria ou bateria com quebra de página automática para prancheta.
- **Tags Dinâmicas**: `#GAMENAME#`, `#CATEGORYNAME#`, `#REGISTERNUMBER#`, `#TEAMNAME#`, `#HEAT_NUMBER#`, `#LANE_NUMBER#`, `#HEAT_TIME#`.
- **Presets Oficiais**:
  - CrossFit For Time (Tabela de Rounds e Tie-break)
  - CrossFit Carga Máxima (Complex & 3 Tentativas de 1RM)
  - HYROX 8-Stations Challenge (SkiErg, Sled Push/Pull, Burpees, Row, Farmers, Lunges, Wall Balls e Roxzone).

### 2. ⏱️ Gerenciador de Baterias & Raias (`/heats`)
- **Algoritmo de Auto-Alocação**: Distribui os atletas nas raias disponíveis da arena (ex: 8, 10, 12 raias) com horários calculados.
- **Seeding de Finalistas**: Coloca os líderes gerais na última bateria e nas raias centrais da arena.
- **Call Room / Chamada de Arena**: Status em tempo real (*Agendada*, *Chamando Atletas*, *Na Arena*, *Concluída*).

### 3. ⚖️ App do Juiz de Arena Touch (`/judge`)
- **Otimizado para Tablets e Smartphones**: Botões gigantes de contagem de repetições, cronômetro de precisão e botão de **NO-REP**.
- **Assinatura Digital**: Pad touch na tela para o atleta assinar e concordar com o resultado antes do envio.
- **Offline-Ready**: Funciona mesmo com instabilidade de sinal na arena.

### 4. 📊 Live Leaderboard & Telão Full-Screen (`/leaderboard` e `/leaderboard/big-screen`)
- **Motor de Pontuação CrossFit**: Tabela oficial 100, 95, 90, 85... com desempate por tempo de tiebreak.
- **Motor de Pontuação HYROX**: Soma de tempos líquidos + penalidades.
- **Telão de LED Full-Screen**: Auto-rotação de categorias a cada 15 segundos, modo escuro/neon de alta visibilidade à distância e confetes para os campeões.

### 5. 🏃 Portal do Atleta (`/athlete`)
- **Credenciamento Digital**: Cartão com QR Code para check-in rápido na portaria.
- **Minhas Baterias**: Horário de largada, bateria e raia.
- **Contestação de Score**: Canal direto para solicitar revisão ao Head Judge.

### 6. 💼 Painel do Organizador & Dono do SaaS (`/admin`)
- **Visão do Organizador**: Criação de WODs, credenciamento e auditoria de súmulas.
- **Visão do Criador da Plataforma (SaaS)**: Gestão multi-tenant, controle de planos (Free, Pro, Enterprise), faturamento e taxas por atleta.
