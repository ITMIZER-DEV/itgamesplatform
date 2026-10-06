require('dotenv').config()
const { PrismaClient } = require('@prisma/client')
const { PrismaPg } = require('@prisma/adapter-pg')
const { Pool } = require('pg')

const connectionString = process.env.DATABASE_URL
const pool = new Pool({ connectionString })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log('Iniciando seed de Leads...')

  const leads = [
    {
      name: 'Marcos Silva',
      email: 'marcos@crossfitbox.com',
      phone: '(11) 98888-7777',
      description: 'Campeonato amador de Cross Training para 200 atletas.',
      status: 'new'
    },
    {
      name: 'Juliana Ferreira',
      email: 'juliana@itajai.games',
      phone: '(47) 97777-6666',
      description: 'Edição anual Inter-box. Precisamos de um leaderboard robusto.',
      status: 'contacted'
    },
    {
      name: 'Ricardo Santos',
      email: 'ricardo@beachgames.com',
      phone: '(21) 96666-5555',
      description: 'Competição na praia, 3 dias de evento. Foco em trios.',
      status: 'negotiating'
    },
    {
      name: 'Ana Paula',
      email: 'ana@summergames.com',
      phone: '(19) 95555-4444',
      description: 'Summer Games 2026 - 1ª Edição Girls.',
      status: 'won'
    },
    {
      name: 'Pedro Oliveira',
      email: 'pedro@powerlift.com',
      phone: '(31) 94444-3333',
      description: 'Evento regional de levantamento de peso.',
      status: 'lost'
    },
    {
      name: 'Carlos Mendes',
      email: 'carlos@arena.com',
      phone: '(62) 93333-2222',
      description: 'Teste de plataforma para evento em Goiânia.',
      status: 'new'
    }
  ]

  for (const leadData of leads) {
    await prisma.lead.create({
      data: leadData
    })
  }

  console.log('Seed de Leads finalizado com sucesso!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
