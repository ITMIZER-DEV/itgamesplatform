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
        const events = await prisma.event.findMany({
            select: { idEvent: true, title: true, type: true, category: true, status: true }
        })
        console.log('--- Eventos no Banco ---')
        events.forEach(e => console.log(`ID: ${e.idEvent} | Título: ${e.title} | Tipo: ${e.type} | Cat: ${e.category} | Status: ${e.status}`))
    } catch (e) {
        console.error(e)
    } finally {
        await prisma.$disconnect()
    }
}
main()
