'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'

export async function deleteRegistrationAction(code: number, gameCode: string) {
  try {
    await prisma.registration.delete({
      where: {
        code_gameCode: {
          code,
          gameCode
        }
      }
    })
    
    // Revalida o caminho para atualizar dados se necessário (Server-side)
    revalidatePath(`/admin/games/${gameCode}`)
    
    return { success: true }
  } catch (error: any) {
    console.error('Erro ao deletar inscrição:', error)
    return { success: false, error: error.message || 'Falha ao deletar inscrição' }
  }
}
