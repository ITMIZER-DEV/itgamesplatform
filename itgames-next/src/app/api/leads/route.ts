import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { getAuthUser, unauthorizedResponse } from '@/lib/auth'

const LeadSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  email: z.string().email('E-mail inválido'),
  phone: z.string().min(1, 'Telefone é obrigatório'),
  description: z.string().optional(),
})

export async function GET(request: Request) {
  const user = await getAuthUser(request)
  if (!user) {
    console.error('API Leads: Usuário não autenticado')
    return unauthorizedResponse()
  }

  try {
    console.log('API Leads: Buscando do banco...')
    const leads = await prisma.lead.findMany({
      orderBy: { createdAt: 'desc' }
    })
    console.log(`API Leads: ${leads.length} encontrados`)
    return NextResponse.json(leads)
  } catch (error: any) {
    console.error('API Leads Error:', error)
    return NextResponse.json({ 
      error: 'Erro ao listar leads', 
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined 
    }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const validatedData = LeadSchema.parse(body)

    const lead = await prisma.lead.create({
      data: {
        name: validatedData.name,
        email: validatedData.email,
        phone: validatedData.phone,
        description: validatedData.description,
        status: 'new'
      }
    })

    return NextResponse.json(lead, { status: 201 })
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Erro de validação', issues: error.issues }, { status: 400 })
    }
    return NextResponse.json({ error: 'Erro ao registrar contato', details: error.message }, { status: 500 })
  }
}
