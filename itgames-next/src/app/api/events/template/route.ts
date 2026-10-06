import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'

export const dynamic = 'force-dynamic'

// POST: Upload template para um evento
export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || ''
    
    let game, idEvent, sumulaTemplateContent

    if (contentType.includes('application/json')) {
      const body = await request.json()
      game = body.game
      idEvent = body.idEvent
      
      if (body.type === 'html') {
        sumulaTemplateContent = body.content
      } else {
        return NextResponse.json({ error: 'Tipo JSON não suportado' }, { status: 400 })
      }
    } else {
      const formData = await request.formData()
      const file = formData.get('file') as File
      game = formData.get('game') as string
      idEvent = formData.get('idEvent') as string

      if (!file) {
        return NextResponse.json({ error: 'Arquivo obrigatório' }, { status: 400 })
      }

      // Salvar arquivo localmente
      const bytes = await file.arrayBuffer()
      const buffer = Buffer.from(bytes)

      // Criar diretório se não existir
      const uploadDir = join(process.cwd(), 'public', 'uploads', 'sumulas', game)
      if (!existsSync(uploadDir)) {
        await mkdir(uploadDir, { recursive: true })
      }

      const fileName = `event-${idEvent}_${Date.now()}_${file.name}`
      const filePath = join(uploadDir, fileName)

      await writeFile(filePath, buffer)

      // URL pública do arquivo
      sumulaTemplateContent = `/uploads/sumulas/${game}/${fileName}`
    }

    if (!game || !idEvent) {
      return NextResponse.json(
        { error: 'game e idEvent são obrigatórios' },
        { status: 400 }
      )
    }

    // Verificar se o evento existe
    const eventData = await prisma.event.findUnique({
      where: {
        idEvent_game: {
          idEvent: parseInt(idEvent),
          game: game,
        },
      },
    })

    if (!eventData) {
      return NextResponse.json({ error: 'Evento não encontrado' }, { status: 404 })
    }

    // Atualizar evento com URL do template ou conteúdo HTML
    await prisma.event.update({
      where: {
        idEvent_game: {
          idEvent: parseInt(idEvent),
          game: game,
        },
      },
      data: {
        sumulaTemplate: sumulaTemplateContent,
      },
    })

    return NextResponse.json({
      success: true,
      url: sumulaTemplateContent,
      message: 'Template salvo com sucesso!',
    })
  } catch (error: any) {
    console.error('Erro ao salvar template:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao salvar' },
      { status: 500 }
    )
  }
}

// DELETE: Remover template de um evento
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const game = searchParams.get('game')
    const idEvent = searchParams.get('idEvent')

    if (!game || !idEvent) {
      return NextResponse.json(
        { error: 'game e idEvent são obrigatórios' },
        { status: 400 }
      )
    }

    await prisma.event.update({
      where: {
        idEvent_game: {
          idEvent: parseInt(idEvent),
          game: game,
        },
      },
      data: {
        sumulaTemplate: null,
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Template removido com sucesso!',
    })
  } catch (error: any) {
    console.error('Erro ao remover template:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
