FROM node:20-alpine AS builder

WORKDIR /app

RUN apk add --no-cache openssl

# Instalar dependências
COPY package*.json ./
COPY prisma ./prisma/

RUN npm install

# Copiar código fonte
COPY . .

# Gerar Prisma Client e Build NestJS
RUN npx prisma generate
RUN npm run build

# Imagem de Execução
FROM node:20-alpine AS runner

WORKDIR /app

RUN apk add --no-cache openssl

ENV NODE_ENV=production
ENV PORT=3333

COPY package*.json ./
COPY prisma ./prisma/

RUN npm install --omit=dev && npm install -g prisma ts-node typescript

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY docker-entrypoint.sh ./

RUN chmod +x docker-entrypoint.sh

EXPOSE 3333

ENTRYPOINT ["./docker-entrypoint.sh"]

