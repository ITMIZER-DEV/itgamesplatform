import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ game: string, idPerson: string }> }
) {
  try {
    const { game, idPerson } = await params
    
    await prisma.judge.delete({
      where: {
        idPerson_game: {
          idPerson,
          game
        }
      }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Erro ao remover juiz:', error)
    return NextResponse.json({ error: 'Erro ao remover juiz' }, { status: 500 })
  }
}
