'use client'

import SwaggerUI from 'swagger-ui-react'
import 'swagger-ui-react/swagger-ui.css'

export default function SwaggerDocs() {
  return (
    <div className="min-h-screen bg-white">
      <SwaggerUI url="/api/docs/spec" />
    </div>
  )
}
