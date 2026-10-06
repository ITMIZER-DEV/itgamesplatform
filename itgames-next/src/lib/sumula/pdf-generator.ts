import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'

export interface SumulaData {
  gameCode: string
  gameName: string
  gameDate?: string
  gameLocation?: string
  eventId: number
  eventTitle: string
  eventDescription?: string
  categoryCode: number
  categoryName: string
  registerNumber: string
  teamName: string
  athletes: Array<{
    name: string
    cpf?: string
  }>
}

/**
 * Substitui as variáveis do template pelos dados reais
 */
export function replaceVariables(text: string, data: SumulaData): string {
  let result = text

  // Variáveis do Game
  result = result.replace(/#GAMENAME#/g, data.gameName)
  result = result.replace(/#GAMEDATE#/g, data.gameDate || '')
  result = result.replace(/#GAMELOCATION#/g, data.gameLocation || '')

  // Variáveis do Evento
  result = result.replace(/#EVENTID#/g, String(data.eventId))
  result = result.replace(/#EVENTTITLE#/g, data.eventTitle)
  result = result.replace(/#EVENTDESCRIPTION#/g, data.eventDescription || '')

  // Variáveis da Categoria
  result = result.replace(/#CATEGORYNAME#/g, data.categoryName)
  result = result.replace(/#CATEGORIAATLETA#/g, data.categoryName) // Compatibilidade

  // Variáveis da Inscrição
  result = result.replace(/#REGISTERNUMBER#/g, data.registerNumber)
  result = result.replace(/#GAMEREGISTER#/g, data.registerNumber) // Compatibilidade
  result = result.replace(/#TEAMNAME#/g, data.teamName)
  result = result.replace(/#TEAM#/g, data.teamName) // Compatibilidade
  result = result.replace(/#IDATLETA#/g, data.teamName) // Compatibilidade com template existente
  result = result.replace(/#TOTALATHLETES#/g, String(data.athletes.length))

  // Variáveis dos Atletas (dinâmico)
  data.athletes.forEach((athlete, index) => {
    const num = index + 1
    result = result.replace(new RegExp(`#ATHLETE${num}_NAME#`, 'g'), athlete.name)
    result = result.replace(new RegExp(`#ATLETA${num}#`, 'g'), athlete.name) // Compatibilidade
    result = result.replace(new RegExp(`#ATHLETE${num}_CPF#`, 'g'), athlete.cpf || '')
  })

  // Lista formatada de atletas
  const athletesList = data.athletes
    .map((a, i) => `Atleta #${i + 1}: ${a.name}`)
    .join('\n')
  result = result.replace(/#ATHLETESLIST#/g, athletesList)

  return result
}

/**
 * Gera um PDF a partir de um template, substituindo as variáveis
 * Esta é uma versão que trabalha com PDFs que contém campos de formulário
 */
export async function generatePDFFromTemplate(
  templateUrl: string,
  data: SumulaData
): Promise<Uint8Array> {
  try {
    // 1. Baixar o template
    const templateResponse = await fetch(templateUrl)
    const templateBytes = await templateResponse.arrayBuffer()

    // 2. Carregar o PDF
    const pdfDoc = await PDFDocument.load(templateBytes)

    // 3. Verificar se há campos de formulário
    const form = pdfDoc.getForm()
    const fields = form.getFields()

    if (fields.length > 0) {
      // PDF tem campos de formulário - preencher diretamente
      fields.forEach((field) => {
        const fieldName = field.getName()
        const fieldType = field.constructor.name

        // Criar mapa de variáveis para valores
        const variableMap: Record<string, string> = {
          GAMENAME: data.gameName,
          GAMEDATE: data.gameDate || '',
          GAMELOCATION: data.gameLocation || '',
          EVENTID: String(data.eventId),
          EVENTTITLE: data.eventTitle,
          EVENTDESCRIPTION: data.eventDescription || '',
          CATEGORYNAME: data.categoryName,
          CATEGORIAATLETA: data.categoryName,
          REGISTERNUMBER: data.registerNumber,
          GAMEREGISTER: data.registerNumber,
          TEAMNAME: data.teamName,
          TEAM: data.teamName,
          IDATLETA: data.teamName,
          TOTALATHLETES: String(data.athletes.length),
        }

        // Adicionar atletas
        data.athletes.forEach((athlete, index) => {
          const num = index + 1
          variableMap[`ATHLETE${num}_NAME`] = athlete.name
          variableMap[`ATLETA${num}`] = athlete.name
          variableMap[`ATHLETE${num}_CPF`] = athlete.cpf || ''
        })

        // Tentar preencher o campo
        if (fieldType === 'PDFTextField') {
          const textField = form.getTextField(fieldName)
          const value = variableMap[fieldName] || ''
          try {
            textField.setText(value)
          } catch (e) {
            console.warn(`Não foi possível preencher campo ${fieldName}`)
          }
        }
      })

      // Achatar o formulário (tornar campos não editáveis)
      form.flatten()
    } else {
      // PDF não tem campos - tentar substituir texto diretamente
      // NOTA: pdf-lib não suporta substituição de texto facilmente
      // Para isso, seria necessário usar uma biblioteca como pdf2json + criar novo PDF
      // Por ora, vamos adicionar uma sobreposição de texto em posições fixas

      const pages = pdfDoc.getPages()
      const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

      // Exemplo: adicionar dados na primeira página
      const firstPage = pages[0]
      const { width, height } = firstPage.getSize()

      // Estas posições devem ser ajustadas conforme o template
      firstPage.drawText(`Dupla: ${data.teamName}`, {
        x: 50,
        y: height - 200,
        size: 14,
        font,
        color: rgb(0, 0, 0),
      })

      firstPage.drawText(`Categoria: ${data.categoryName}`, {
        x: 50,
        y: height - 220,
        size: 12,
        font,
        color: rgb(0, 0, 0),
      })

      firstPage.drawText(`#${data.registerNumber}`, {
        x: 50,
        y: height - 240,
        size: 12,
        font,
        color: rgb(0, 0, 0),
      })
    }

    // 4. Salvar e retornar o PDF modificado
    return await pdfDoc.save()
  } catch (error) {
    console.error('Erro ao gerar PDF:', error)
    throw new Error(`Erro ao gerar PDF: ${error}`)
  }
}

/**
 * Converte ArrayBuffer ou Uint8Array para Base64
 */
export function arrayBufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}
