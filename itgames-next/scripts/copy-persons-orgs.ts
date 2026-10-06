import { createClient } from '@supabase/supabase-js'
import { PrismaClient } from '@prisma/client'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const prisma = new PrismaClient()

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

async function copyData() {
  console.log('🔄 Iniciando cópia seletiva: Supabase -> Prisma')

  try {
    // 1. Sincronizar Organizações
    console.log('📦 Copiando Organizações...')
    const { data: orgs, error: e1 } = await supabase.from('organizations').select('*')
    if (e1) throw e1

    for (const o of orgs) {
      await prisma.organization.upsert({
        where: { code: o.code },
        update: {
          NomeEmpresa: o.NomeEmpresa || '',
          cnpj: o.cnpj,
          razaosocial: o.razaosocial,
          status: o.status
        },
        create: {
          code: o.code,
          NomeEmpresa: o.NomeEmpresa || '',
          cnpj: o.cnpj,
          razaosocial: o.razaosocial,
          status: o.status
        }
      })
    }
    console.log(`✅ ${orgs.length} organizações processadas.`)

    // 2. Sincronizar Pessoas
    console.log('👥 Copiando Pessoas...')
    const { data: persons, error: e2 } = await supabase.from('persons').select('*')
    if (e2) throw e2

    for (const p of persons) {
      const personData = {
        name: p.name || 'Sem Nome',
        email: p.email,
        cpf: p.cpf,
        sexo: p.sexo,
        phoneNumber: p.phoneNumber,
        tenant_id: p.tenant_id,
        status: p.status,
        foto: p.foto,
        uuid: p.uuid,
      }

      const createdPerson = await prisma.person.upsert({
        where: { idPerson: p.idPerson },
        update: personData,
        create: {
          idPerson: p.idPerson,
          ...personData
        }
      })

      // Lógica de User/Client baseada em dados legados
      const role = (p.role || '').toUpperCase()
      const profile = (p.profile || '').toUpperCase()

      if (role === 'ADMIN' || profile === 'ADMIN') {
        await prisma.user.upsert({
          where: { personId: createdPerson.idPerson },
          update: { role: 'ADMIN' },
          create: { personId: createdPerson.idPerson, role: 'ADMIN' }
        })
      } else if (profile === 'USER' || profile === 'ATHLETE') {
        await prisma.client.upsert({
          where: { personId: createdPerson.idPerson },
          update: {},
          create: { personId: createdPerson.idPerson }
        })
      }
    }
    console.log(`✅ ${persons.length} pessoas processadas.`)

    // 3. Garantir Leonardo como Admin
    console.log('💎 Validando Admin Leonardo Alves...')
    const leonardo = await prisma.person.upsert({
      where: { email: 'leonardo.alves@itmizer.com.br' },
      update: { cpf: '96029021168', name: 'Leonardo Alves' },
      create: { 
        name: 'Leonardo Alves', 
        email: 'leonardo.alves@itmizer.com.br', 
        cpf: '96029021168',
        tenant_id: 1,
        status: 'active'
      }
    })

    await prisma.user.upsert({
      where: { personId: leonardo.idPerson },
      update: { role: 'ADMIN' },
      create: { personId: leonardo.idPerson, role: 'ADMIN' }
    })
    console.log('✅ Leonardo configurado como Admin.')

    console.log('🏁 Cópia e mapeamento finalizados com sucesso!')
  } catch (error) {
    console.error('❌ Erro na operação:', error)
  } finally {
    await prisma.$disconnect()
  }
}

copyData()
