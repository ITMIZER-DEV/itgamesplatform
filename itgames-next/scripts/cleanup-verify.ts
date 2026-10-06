import dotenv from "dotenv"
dotenv.config({ path: ".env.local" })
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

const connectionString = process.env.DATABASE_URL
const pool = new Pool({ connectionString })
const adapter = new PrismaPg(pool as any)
const prisma = new PrismaClient({ adapter })

async function checkAndCleanup() {
  console.log('🔍 Iniciando Auditoria e Limpeza...')

  const targetCpf = '96029021168'
  
  // 1. Buscar todos os registros vinculados a esse CPF
  const persons = await prisma.person.findMany({
    where: { cpf: targetCpf },
    include: { user: true, client: true }
  })

  console.log(`📊 Encontrados ${persons.length} registros para o CPF ${targetCpf}.`)

  if (persons.length > 1) {
    console.warn('⚠️ Duplicatas encontradas! Mantendo o registro principal...')
    // Manter o registro que já é Admin ou o que tem mais vínculos
    const master = persons.find(p => p.user?.role === 'ADMIN') || persons[0]
    
    for (const p of persons) {
      if (p.idPerson !== master.idPerson) {
        console.log(`🗑️ Removendo ID duplicado: ${p.idPerson}`)
        // Remove dependências se houver (user/client) antes de apagar a person
        if (p.user) await prisma.user.delete({ where: { id: p.user.id } })
        if (p.client) await prisma.client.delete({ where: { id: p.client.id } })
        await prisma.person.delete({ where: { idPerson: p.idPerson } })
      }
    }
  }

  // 2. Garantir que o master é Admin
  const finalPerson = await prisma.person.findFirst({
    where: { cpf: targetCpf },
    include: { user: true }
  })

  if (finalPerson) {
    if (!finalPerson.user) {
      await prisma.user.create({
        data: { personId: finalPerson.idPerson, role: 'ADMIN' }
      })
    } else if (finalPerson.user.role !== 'ADMIN') {
      await prisma.user.update({
        where: { id: finalPerson.user.id },
        data: { role: 'ADMIN' }
      })
    }
    
    const statusUser = await prisma.person.findUnique({
      where: { idPerson: finalPerson.idPerson },
      include: { user: true }
    })

    console.log('\n✅ STATUS FINAL DO USUÁRIO:')
    console.log('---------------------------')
    console.log(`Nome:        ${statusUser?.name}`)
    console.log(`Email:       ${statusUser?.email}`)
    console.log(`CPF:         ${statusUser?.cpf}`)
    console.log(`Role:        ${statusUser?.user?.role}`)
    console.log(`Status:      ${statusUser?.user?.status}`)
    console.log(`Person ID:   ${statusUser?.idPerson}`)
    console.log('---------------------------\n')
  } else {
    console.error(`❌ Usuário com CPF ${targetCpf} não encontrado!`)
  }

  await prisma.$disconnect()
}

checkAndCleanup().catch(err => {
  console.error('❌ Erro no script:', err)
  process.exit(1)
})
