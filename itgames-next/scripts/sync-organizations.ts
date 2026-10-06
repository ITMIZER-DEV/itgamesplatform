import dotenv from "dotenv"
dotenv.config({ path: ".env.local" })
import { createClient } from '@supabase/supabase-js'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

const connectionString = process.env.DATABASE_URL
const pool = new Pool({ connectionString })
const adapter = new PrismaPg(pool as any)
const prisma = new PrismaClient({ adapter })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

async function syncOrganizations() {
  console.log('🔄 Sincronizando Organizações (Colunas Completas): Supabase -> Prisma')

  try {
    const { data: orgs, error } = await supabase.from('organizations').select('*')
    if (error) throw error

    console.log(`📦 Encontradas ${orgs.length} organizações no Supabase.`)

    for (const o of orgs) {
      await prisma.organization.upsert({
        where: { code: o.code },
        update: {
          NomeEmpresa: o.NomeEmpresa || '',
          cnpj: o.cnpj,
          razaosocial: o.razaosocial,
          logomarca: o.logomarca,
          logradouro: o.logradouro,
          bairro: o.bairro,
          cep: o.cep,
          cidade: o.cidade,
          estado: o.estado,
          telefone: o.telefone,
          logradouroComplemento: o.logradouroComplemento,
          url: o.url,
          segment: o.segment,
          status: o.status,
          email: o.email
        },
        create: {
          code: o.code,
          NomeEmpresa: o.NomeEmpresa || '',
          cnpj: o.cnpj,
          razaosocial: o.razaosocial,
          logomarca: o.logomarca,
          logradouro: o.logradouro,
          bairro: o.bairro,
          cep: o.cep,
          cidade: o.cidade,
          estado: o.estado,
          telefone: o.telefone,
          logradouroComplemento: o.logradouroComplemento,
          url: o.url,
          segment: o.segment,
          status: o.status,
          email: o.email
        }
      })
    }
    console.log('✅ Sincronização de organizações finalizada com sucesso!')
  } catch (err) {
    console.error('❌ Erro na sincronização:', err)
  } finally {
    await prisma.$disconnect()
  }
}

syncOrganizations()
