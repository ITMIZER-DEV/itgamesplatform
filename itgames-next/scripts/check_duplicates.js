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
        console.log('--- Verificando Duplicatas de CPF ---')
        const persons = await prisma.person.findMany({
            where: { cpf: '96029021168' }
        })

        console.log(`Encontrados ${persons.length} registros para o CPF 96029021168:`)
        persons.forEach(p => {
            console.log(`ID: ${p.idPerson} | Email: ${p.email} | Nome: ${p.name}`)
        })

        if (persons.length > 1) {
            console.log('\nVOCÊ TEM DUPLICATAS. Por isso o "npx prisma db push" está falhando.')
        } else {
            console.log('\nNenhuma duplicata encontrada para este CPF.')
        }

    } catch (error) {
        console.error('Erro ao consultar:', error)
    } finally {
        await prisma.$disconnect()
    }
}

main()
