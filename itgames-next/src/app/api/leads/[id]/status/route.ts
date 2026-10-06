import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser, unauthorizedResponse } from '@/lib/auth'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser(request)
  if (!user) return unauthorizedResponse()

  try {
    const { status } = await request.json()
    const { id } = await params

    const updatedLead = await prisma.lead.update({
      where: { id },
      data: { status }
    })

    return NextResponse.json(updatedLead)
  } catch (error: any) {
    return NextResponse.json({ error: 'Erro ao atualizar status', details: error.message }, { status: 500 })
  }
}
