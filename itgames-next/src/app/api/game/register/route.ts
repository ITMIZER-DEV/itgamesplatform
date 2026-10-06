import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { getAuthUser, unauthorizedResponse } from '@/lib/auth'

export const dynamic = 'force-dynamic'

const RegisterAthleteSchema = z.object({
  name: z.string().min(1, 'Nome do atleta é obrigatório'),
  cpf: z.string().min(1, 'CPF do atleta é obrigatório'),
  phoneNumber: z.string().min(1, 'Telefone do atleta é obrigatório'),
})

const RegisterTeamSchema = z.object({
  gameId: z.string().uuid('ID do jogo inválido'),
  tenant_id: z.number().int(),
  categoryId: z.number().int(),
  team: z.string().min(1, 'Nome do time é obrigatório'),
  amount: z.number().int(),
  athletes: z.array(RegisterAthleteSchema).min(1, 'Pelo menos um atleta é obrigatório'),
})

function generateRegistrationCode(categoryCode: number): string {
  const randomRegistrationNumber = Math.floor(Math.random() * 99) + 1
  const paddedRegistrationNumber = randomRegistrationNumber.toString().padStart(2, '0')
  return `${categoryCode}0${paddedRegistrationNumber}`
}

/**
 * @openapi
 * /api/game/register:
 *   post:
 *     summary: Realiza a inscrição de um time e seus atletas
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [gameId, tenant_id, categoryId, team, amount, athletes]
 *   get:
 *     summary: Lista inscrições de um jogo
 *     parameters:
 *       - in: query
 *         name: game
 *         required: true
 *         schema: { type: string }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const validatedData = RegisterTeamSchema.parse(body)
    
    const registrationCode = generateRegistrationCode(validatedData.categoryId)

    // Gerar próximo código sequencial para a Registration
    const maxReg = await prisma.registration.aggregate({
      _max: { code: true },
      where: { gameCode: validatedData.gameId }
    })
    const nextRegCode = (maxReg._max.code || 0) + 1

    const result = await prisma.$transaction(async (tx) => {
      // 1. Registrar/Atualizar Pessoas (Person)
      const athleteCPFs = validatedData.athletes.map(a => a.cpf)
      
      // Busca pessoas existentes
      const existingPersons = await tx.person.findMany({
        where: { cpf: { in: athleteCPFs } }
      })
      const existingCPFSet = new Set(existingPersons.map(p => p.cpf))

      // Cria novas pessoas que não existem
      const newAthletes = validatedData.athletes.filter(a => !existingCPFSet.has(a.cpf))
      if (newAthletes.length > 0) {
        await tx.person.createMany({
          data: newAthletes.map(a => ({
            name: a.name,
            cpf: a.cpf,
            phoneNumber: a.phoneNumber,
            tenant_id: validatedData.tenant_id,
          })),
          skipDuplicates: true
        })
      }

      // Busca todas as pessoas envolvidas (agora todas existem)
      const allPersons = await tx.person.findMany({
        where: { cpf: { in: athleteCPFs } }
      })

      // 1.1 Garantir que todos possuem registro na tabela Client
      const personIds = allPersons.map(p => p.idPerson)
      const existingClients = await tx.client.findMany({
        where: { personId: { in: personIds } }
      })
      const existingClientIds = new Set(existingClients.map(c => c.personId))
      
      const newClients = personIds.filter(id => !existingClientIds.has(id))
      if (newClients.length > 0) {
        await tx.client.createMany({
          data: newClients.map(id => ({ personId: id })),
          skipDuplicates: true
        })
      }

      // 2. Criar Perfis de Jogo (GameProfile) - opcional, pular se model não existir
      try {
        await (tx as any).profile?.createMany({
          data: allPersons.map(p => ({
            idPerson: p.idPerson,
            cpf: p.cpf,
            game: validatedData.gameId,
            category: validatedData.categoryId,
            profile: 'ATHLETE',
            code: registrationCode
          })),
          skipDuplicates: true
        })
      } catch { /* ignore if model doesn't exist */ }

      // 3. Criar a Inscrição (Registration)
      const registration = await tx.registration.create({
        data: {
          code: nextRegCode,
          team: validatedData.team,
          amount: validatedData.amount,
          number: registrationCode,
          status: 'Register',
          check: false,
          gameCode: validatedData.gameId,
          categoryId: validatedData.categoryId,
          athletes: {
            create: validatedData.athletes.map((a, idx) => ({
              code: idx + 1,
              name: a.name,
              cpf: a.cpf,
              phonenumber: a.phoneNumber,
              check: false,
              game: validatedData.gameId,
              category: validatedData.categoryId
            }))
          }
        },
        include: {
          athletes: true
        }
      })

      return registration
    })

    return NextResponse.json(result, { status: 201 })
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Erro de validação', issues: error.issues }, { status: 400 })
    }
    return NextResponse.json({ error: 'Erro ao processar inscrição', details: error.message }, { status: 500 })
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const gameId = searchParams.get('game')

  if (!gameId) {
    return NextResponse.json({ error: 'ID do jogo é obrigatório' }, { status: 400 })
  }

  try {
    const registrations = await prisma.registration.findMany({
      where: { gameCode: gameId },
      include: {
        category: true,
        athletes: true,
      },
      orderBy: { number: 'asc' }
    })

    // Mapear para o formato esperado pelo frontend (Category e Athletes em maiúsculo)
    const mapped = registrations.map(r => ({
      ...r,
      game: r.gameCode,
      Category: r.category,
      Athletes: r.athletes,
    }))

    return NextResponse.json(mapped)
  } catch (error: any) {
    console.error('[GET /api/game/register] error:', error)
    return NextResponse.json({ error: 'Erro ao listar inscrições', details: error.message }, { status: 500 })
  }
}
