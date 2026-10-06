import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser, unauthorizedResponse } from '@/lib/auth'
import { z } from 'zod'

const CreateJudgeSchema = z.object({
  idPerson: z.string().min(1),
  game: z.string().min(1),
  name: z.string().min(1),
  cpf: z.string().optional(),
})

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const idPerson = searchParams.get('idPerson')

  if (!idPerson) {
    return NextResponse.json({ error: 'idPerson é obrigatório' }, { status: 400 })
  }

  try {
    const assignments = await prisma.judge.findMany({
      where: { idPerson },
      orderBy: { game: 'asc' }
    })

    // Buscar detalhes dos games
    const gameCodes = assignments.map(a => a.game)
    const games = await prisma.game.findMany({
      where: {
        code: { in: gameCodes }
      }
    })

    return NextResponse.json(games)
  } catch (error: any) {
    return NextResponse.json({ error: 'Erro ao buscar assignments', details: error.message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const user = await getAuthUser(request)
  if (!user) return unauthorizedResponse()

  try {
    const body = await request.json()
    const data = CreateJudgeSchema.parse(body)

    const judge = await prisma.judge.upsert({
      where: {
        idPerson_game: {
          idPerson: data.idPerson,
          game: data.game
        }
      },
      update: {
        name: data.name,
        cpf: data.cpf
      },
      create: {
        idPerson: data.idPerson,
        game: data.game,
        name: data.name,
        cpf: data.cpf
      }
    })

    return NextResponse.json(judge, { status: 201 })
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Erro de validação', issues: error.issues }, { status: 400 })
    }
    return NextResponse.json({ error: 'Erro ao cadastrar juiz', details: error.message }, { status: 500 })
  }
}
