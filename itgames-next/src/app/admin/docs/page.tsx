'use client'

import dynamic from 'next/dynamic'
import 'swagger-ui-react/swagger-ui.css'

const SwaggerUI = dynamic(() => import('swagger-ui-react'), { ssr: false })

export default function ApiDocsPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="p-4 bg-slate-900 text-white flex justify-between items-center">
        <h1 className="text-xl font-bold">Documentação da API IT Games</h1>
        <a href="/admin" className="text-sm underline">Voltar ao Painel</a>
      </div>
      <SwaggerUI url="/api/docs" />
    </div>
  )
}
