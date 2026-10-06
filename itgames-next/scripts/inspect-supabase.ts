import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

async function inspect() {
  console.log('🔍 Inspecionando Supabase...')
  
  const { data: orgs, error: e1 } = await supabase.from('organizations').select('*').limit(1)
  if (e1) console.error('Erro Organizations:', e1)
  else console.log('Columns Organizations:', Object.keys(orgs[0] || {}))

  const { data: persons, error: e2 } = await supabase.from('persons').select('*').limit(1)
  if (e2) console.error('Erro Persons:', e2)
  else console.log('Columns Persons:', Object.keys(persons[0] || {}))
}

inspect()
