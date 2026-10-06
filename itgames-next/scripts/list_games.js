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
        const games = await prisma.game.findMany({
            select: { code: true, name: true }
        })
        console.log('--- Campeonatos Ativos ---')
        games.forEach(g => console.log(`${g.code}: ${g.name}`))
    } catch (e) {
        console.error(e)
    } finally {
        await prisma.$disconnect()
    }
}
main()
