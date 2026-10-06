const { PrismaClient } = require('@prisma/client')
const { PrismaPg } = require('@prisma/adapter-pg')
const { Pool } = require('pg')
require('dotenv').config()

const connectionString = process.env.DATABASE_URL
const pool = new Pool({ connectionString, ssl: connectionString?.includes('supabase') ? { rejectUnauthorized: false } : false })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
  const adminEmail = 'leonardo.alves@itmizer.com.br'
  const judgeEmail = 'leoalvesp82@gmail.com'
  const cpf = '96029021168'
  
  console.log('--- Iniciando configuração Multi-Perfil ---')

  try {
    // 1. Garantir que a Person física exista (Leonardo)
    let person = await prisma.person.findFirst({
        where: {
            OR: [
                { email: adminEmail },
                { cpf: cpf }
            ]
        }
    })

    if (!person) {
      console.log('Criando Person física principal...')
      person = await prisma.person.create({
        data: {
          email: adminEmail,
          name: 'Leonardo Alves',
          cpf,
          status: 'active'
        }
      })
    } else {
      console.log('Person física encontrada:', person.idPerson)
    }

    // 2. Configurar Perfil ADMIN (email corporativo)
    console.log(`Configurando perfil ADMIN: ${adminEmail}`)
    let adminUser = await prisma.user.findFirst({ where: { email: adminEmail } })
    if (adminUser) {
      await prisma.user.update({
        where: { id: adminUser.id },
        data: { role: 'ADMIN', personId: person.idPerson }
      })
    } else {
      await prisma.user.create({
        data: {
          email: adminEmail,
          role: 'ADMIN',
          personId: person.idPerson,
          status: 'active'
        }
      })
    }

    // 3. Configurar Perfil JUDGE (email pessoal)
    console.log(`Configurando perfil JUDGE: ${judgeEmail}`)
    let judgeUser = await prisma.user.findFirst({ where: { email: judgeEmail } })
    if (judgeUser) {
      await prisma.user.update({
        where: { id: judgeUser.id },
        data: { role: 'JUDGE', personId: person.idPerson }
      })
    } else {
      await prisma.user.create({
        data: {
          email: judgeEmail,
          role: 'JUDGE',
          personId: person.idPerson,
          status: 'active'
        }
      })
    }
    
    // 4. Vincular juiz a todos os games existentes
    const games = await prisma.game.findMany()
    console.log(`Vinculando perfil juiz a ${games.length} campeonatos...`)
    
    for (const game of games) {
      await prisma.judge.upsert({
        where: {
          idPerson_game: {
            idPerson: person.idPerson,
            game: game.code
          }
        },
        update: { name: person.name, cpf: person.cpf },
        create: {
          idPerson: person.idPerson,
          game: game.code,
          name: person.name,
          cpf: person.cpf
        }
      })
    }

    console.log('--- Configuração concluída com sucesso! ---')
    console.log('Admin:', adminEmail)
    console.log('Judge:', judgeEmail)
  } catch (error) {
    console.error('Erro na configuração:', error)
  }
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
