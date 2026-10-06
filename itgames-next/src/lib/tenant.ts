import { NextResponse } from 'next/server'
import { prisma } from './prisma'

export async function getTenantId(request: Request) {
  const tenantHeader = request.headers.get('x-tenant-id')
  
  // Por enquanto, seguindo a lógica do backend legado de aceitar '1' como padrão se não vier no header
  // ou conforme a necessidade do projeto.
  const code = Number(tenantHeader) || 1

  const organization = await prisma.organization.findUnique({
    where: { code }
  })

  if (!organization) {
    return null
  }

  return organization.code
}

export function tenantNotFoundResponse(tenantId: any) {
  return NextResponse.json(
    { error: `Organização não encontrada para o ID: ${tenantId}` },
    { status: 404 }
  )
}
