'use client'

import dynamic from 'next/dynamic'

// Importação dinâmica para evitar erro de 'window is not defined' no SSR
const SwaggerUI = dynamic(() => import('./_swagger-ui'), { ssr: false })

export default function ApiDocsPage() {
  return (
    <main className="min-h-screen">
      <div className="bg-slate-900 border-b border-slate-800 p-4 text-white">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <h1 className="text-xl font-bold">Documentação de API (OpenAPI)</h1>
          <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-1 rounded">Beta</span>
        </div>
      </div>
      <SwaggerUI />
    </main>
  )
}
