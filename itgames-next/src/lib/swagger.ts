import swaggerJsdoc from 'swagger-jsdoc'

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'IT Games API Documentation',
      version: '1.0.0',
      description: 'Documentação oficial dos endpoints da plataforma IT Games.',
    },
    servers: [
      {
        url: 'https://itgames.itmizer.com',
        description: 'Servidor Local',
      },
    ],
    components: {
      securitySchemes: {
        'access-token': {
          type: 'apiKey',
          in: 'header',
          name: 'Authorization',
          description: 'JWT do Supabase Auth (Bearer TOKEN)',
        },
        'tenant-id': {
          type: 'apiKey',
          in: 'header',
          name: 'x-tenant-id',
          description: 'ID do Inquilino (Empresa)',
        },
      },
    },
  },
  apis: ['./src/app/api/**/*.ts'], // Localização dos arquivos de rota com JSDoc
}

export const swaggerSpec = swaggerJsdoc(options)
