const { PrismaClient } = require('@prisma/client')
const { PrismaPg } = require('@prisma/adapter-pg')
const { Pool } = require('pg')
require('dotenv').config()

async function main() {
    const connectionString = process.env.DATABASE_URL
    const pool = new Pool({ connectionString, ssl: connectionString?.includes('supabase') ? { rejectUnauthorized: false } : false })
    const adapter = new PrismaPg(pool)
    const prisma = new PrismaClient({ adapter })

    try {
        console.log('--- Verificando registros na tabela User ---')
        const users = await prisma.user.findMany({
            include: { person: true }
        })

        console.log(`Total de usuários: ${users.length}`)
        users.forEach(u => {
            console.log(`ID: ${u.id} | Role: ${u.role} | Person Name: ${u.person?.name} | Person CPF: ${u.person?.cpf}`)
        })

    } catch (error) {
        console.error('Erro ao consultar:', error)
    } finally {
        await prisma.$disconnect()
    }
}

main()
