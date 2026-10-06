import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generatePDFFromTemplate, type SumulaData } from '@/lib/sumula/pdf-generator'
import JSZip from 'jszip'

/**
 * POST: Gera súmulas em PDF para atletas de um evento
 *
 * Body esperado:
 * {
 *   game: string,
 *   eventId: number,
 *   categoryId?: number,  // Opcional: se não informado, gera para todos
 *   registrationId?: number,  // Opcional: gerar apenas para um registro específico
 *   format: 'single' | 'zip'  // single = retorna um PDF, zip = retorna ZIP com todos
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { game, eventId, categoryId, registrationId, format = 'zip' } = body

    if (!game || !eventId) {
      return NextResponse.json(
        { error: 'game e eventId são obrigatórios' },
        { status: 400 }
      )
    }

    // 1. Buscar dados do evento
    const event = await prisma.event.findUnique({
      where: {
        idEvent_game: {
          idEvent: eventId,
          game: game,
        },
      },
      include: {
        categoryRef: {
          include: {
            game: true,
          },
        },
      },
    })

    if (!event) {
      return NextResponse.json({ error: 'Evento não encontrado' }, { status: 404 })
    }

    if (!event.sumulaTemplate) {
      return NextResponse.json(
        { error: 'Template de súmula não configurado para este evento' },
        { status: 400 }
      )
    }

    // 2. Buscar inscrições
    let whereClause: any = {
      gameCode: game,
    }

    if (categoryId) {
      whereClause.categoryId = categoryId
    } else {
      whereClause.categoryId = event.category
    }

    if (registrationId) {
      whereClause.code = registrationId
    }

    const registrations = await prisma.registration.findMany({
      where: whereClause,
      include: {
        athletes: true,
        category: true,
        game: true,
      },
      orderBy: {
        number: 'asc',
      },
    })

    if (registrations.length === 0) {
      return NextResponse.json(
        { error: 'Nenhuma inscrição encontrada' },
        { status: 404 }
      )
    }

    // 3. Gerar PDFs
    const pdfs: Array<{ name: string; data: Uint8Array }> = []

    for (const reg of registrations) {
      const sumulaData: SumulaData = {
        gameCode: game,
        gameName: reg.game.name,
        gameDate: reg.game.date || undefined,
        gameLocation: reg.game.location || undefined,
        eventId: event.idEvent,
        eventTitle: event.title,
        eventDescription: event.description || undefined,
        categoryCode: reg.category.code,
        categoryName: reg.category.name,
        registerNumber: reg.number || String(reg.code),
        teamName: reg.team,
        athletes: reg.athletes.map((a) => ({
          name: a.name,
          cpf: a.cpf || undefined,
        })),
      }

      try {
        const pdfBytes = await generatePDFFromTemplate(event.sumulaTemplate, sumulaData)
        pdfs.push({
          name: `sumula_${reg.number || reg.code}_${reg.team.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`,
          data: pdfBytes,
        })
      } catch (error) {
        console.error(`Erro ao gerar PDF para ${reg.team}:`, error)
        // Continuar gerando os outros PDFs
      }
    }

    if (pdfs.length === 0) {
      return NextResponse.json(
        { error: 'Nenhum PDF foi gerado com sucesso' },
        { status: 500 }
      )
    }

    // 4. Retornar resultado
    if (format === 'single' && pdfs.length === 1) {
      // Retornar PDF único
      return new NextResponse(pdfs[0].data as any, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${pdfs[0].name}"`,
        },
      })
    } else {
      // Retornar ZIP com todos os PDFs
      const zip = new JSZip()

      pdfs.forEach((pdf) => {
        zip.file(pdf.name, pdf.data)
      })

      const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' })

      return new NextResponse(zipBuffer as any, {
        headers: {
          'Content-Type': 'application/zip',
          'Content-Disposition': `attachment; filename="sumulas_${game}_event${eventId}.zip"`,
        },
      })
    }
  } catch (error: any) {
    console.error('Erro ao gerar súmulas:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao gerar súmulas' },
      { status: 500 }
    )
  }
}
