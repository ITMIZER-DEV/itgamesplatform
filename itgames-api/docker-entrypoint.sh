#!/bin/sh
set -e

echo "🚀 [ITGAMES API] Aguardando conexão e sincronizando schema com o banco de dados..."
npx prisma db push --skip-generate || echo "⚠️ Aviso ao executar prisma db push, prosseguindo com a inicialização..."

echo "🚀 [ITGAMES API] Iniciando servidor NestJS na porta $PORT..."
exec node dist/main
