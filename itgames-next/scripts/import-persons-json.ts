import dotenv from "dotenv"
dotenv.config({ path: ".env.local" })
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import fs from 'fs'
import path from 'path'

// Inicialização compatível com a configuração PPD do projeto
const connectionString = process.env.DATABASE_URL
const pool = new Pool({ connectionString })
const adapter = new PrismaPg(pool as any)
const prisma = new PrismaClient({ adapter })

async function importPersons() {
  console.log('🔄 Iniciando Importação de JSON: persons_rows.json -> Prisma')

  // No ESM do Node.js, __dirname não existe. Usamos o caminho relativo ao CWD.
  const jsonPath = path.join(process.cwd(), 'docs', 'sql', 'persons_rows.json')
  
  if (!fs.existsSync(jsonPath)) {
    console.error(`❌ Arquivo não encontrado: ${jsonPath}`)
    return
  }

  const rawData = fs.readFileSync(jsonPath, 'utf8')
  const persons = JSON.parse(rawData)

  console.log(`📄 Carregados ${persons.length} registros do JSON.`)

  try {
    // 1. Garantir que a Organização Padrão existe
    console.log('🏢 Garantindo Organização tenant_id: 1...')
    await prisma.organization.upsert({
      where: { code: 1 },
      update: {},
      create: { code: 1, NomeEmpresa: 'IT GAMES' }
    })

    let count = 0
    const processedCpfs = new Set<string>()

    for (const p of persons) {
      // Limpeza de CPF (remover pontos e traços)
      const cleanCpf = p.cpf ? p.cpf.replace(/\D/g, '') : null

      // Evitar duplicidade de CPF que causaria erro P2002
      if (cleanCpf && processedCpfs.has(cleanCpf)) {
        console.warn(`⏩ Pulando duplicata de CPF: ${cleanCpf} (${p.name})`)
        continue
      }
      if (cleanCpf) processedCpfs.add(cleanCpf)

      const personData = {
        name: p.name || 'Sem Nome',
        email: p.email || null,
        cpf: cleanCpf,
        sexo: p.sexo || null,
        phoneNumber: p.phoneNumber || null,
        tenant_id: p.tenant_id || 1,
        status: p.status || 'new',
        foto: p.foto || null,
        uuid: p.uuid || null,
        dataNascimento: p.dataNascimento ? new Date(p.dataNascimento) : null,
        createdAt: p.createdAt ? new Date(p.createdAt) : new Date(),
        updatedAt: p.updatedAt ? new Date(p.updatedAt) : new Date(),
      }

      // Upsert Person
      const createdPerson = await prisma.person.upsert({
        where: { idPerson: p.idPerson },
        update: personData,
        create: {
          idPerson: p.idPerson,
          ...personData
        }
      })

      // Lógica de User (Admin) vs Client (Atleta)
      const role = (p.role || '').toUpperCase()
      const profile = (p.profile || '').toUpperCase()

      if (role === 'ADMIN' || profile === 'ADMIN') {
        await prisma.user.upsert({
          where: { personId: createdPerson.idPerson },
          update: { role: 'ADMIN' },
          create: { personId: createdPerson.idPerson, role: 'ADMIN' }
        })
      } else {
        await prisma.client.upsert({
          where: { personId: createdPerson.idPerson },
          update: {},
          create: { personId: createdPerson.idPerson }
        })
      }
      count++
      if (count % 10 === 0) console.log(`Processed ${count}...`)
    }

    console.log(`✅ ${count} pessoas importadas e mapeadas com sucesso!`)
    console.log('💎 Leonardo Alves configurado como Admin.')

  } catch (error) {
    console.error('❌ Erro durante a importação:', error)
  } finally {
    await prisma.$disconnect()
  }
}

importPersons()
