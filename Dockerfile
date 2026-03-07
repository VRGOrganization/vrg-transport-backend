# Stage 1: Build
FROM node:20-alpine AS builder

# Cria usuário não-root
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001

# Define diretório de trabalho
WORKDIR /app

# Copia arquivos de dependências
COPY --chown=nestjs:nodejs package*.json ./

# Instala dependências incluindo devDependencies (necessário para build)
RUN npm ci

# Copia código fonte
COPY --chown=nestjs:nodejs . .

# Build da aplicação
RUN npm run build

# Remove devDependencies
RUN npm prune --production

# Stage 2: Production
FROM node:20-alpine AS runner

# Instala dumb-init para gerenciamento de processos
RUN apk add --no-cache dumb-init

# Cria usuário não-root
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001

# Define diretório de trabalho
WORKDIR /app

# Copia apenas o necessário do builder
COPY --chown=nestjs:nodejs --from=builder /app/dist ./dist
COPY --chown=nestjs:nodejs --from=builder /app/node_modules ./node_modules
COPY --chown=nestjs:nodejs --from=builder /app/package*.json ./

# Muda para usuário não-root
USER nestjs

# Expõe porta
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Usa dumb-init para gerenciamento correto de sinais
ENTRYPOINT ["dumb-init", "--"]

# Comando de inicialização
CMD ["node", "dist/main"]