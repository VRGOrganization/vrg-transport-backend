# VRG Transport Backend

API backend para o sistema de transporte VRG desenvolvida com NestJS e MongoDB.

## Pré-requisitos

- Node.js 18+
- Docker e Docker Compose
- npm ou yarn

## Instalação

```bash
npm install
```

## Configuração

Crie um arquivo `.env` na raiz do projeto baseado no `.env.example`:

```bash
cp .env.example .env
```

Ajuste as variáveis conforme necessário:

```
NODE_ENV=production
PORT=3000

MONGODB_USER=admin
MONGODB_PASSWORD=root
MONGODB_DATABASE=vrg_transport
MONGODB_PORT=27017
```

## Como Rodar

### Opção 1: Desenvolvimento Local (Recomendado)

Para desenvolvimento com hot-reload automático:

```bash
# Subir apenas o MongoDB no Docker
docker-compose up -d mongodb

# Rodar a aplicação localmente
npm run start:dev
```

A aplicação estará disponível em `http://localhost:3000`

### Opção 2: Docker Completo

Para rodar tudo em containers:

```bash
# Subir todos os serviços
docker-compose up -d

# Ver logs
docker-compose logs -f app
```

### Opção 3: Produção

```bash
# Build da aplicação
npm run build

# Rodar em produção
npm run start:prod
```

## Scripts Disponíveis

```bash
npm run start:dev      # Modo desenvolvimento com watch
npm run start:debug    # Modo debug
npm run build          # Build de produção
npm run start:prod     # Rodar build de produção

npm run docker:up      # Subir containers
npm run docker:down    # Parar containers
npm run docker:logs    # Ver logs dos containers
npm run docker:clean   # Remover containers e volumes
```

## Endpoints

- `GET /` - Health check
- `POST /users` - Criar usuário
- `GET /users` - Listar usuários
- `GET /users/:id` - Buscar usuário por ID

## Tracing e Correlation ID

Todas as requisições HTTP recebem um `x-correlation-id`. Se o header vier no request, ele é preservado; caso contrário, o backend gera um novo e devolve no response. Esse ID é usado para rastrear logs de erros por requisição no MongoDB.

## Tecnologias

- NestJS
- MongoDB / Mongoose
- Docker
- TypeScript

## Solução de Problemas

### Erro de autenticação MongoDB

Se receber erro "Authentication failed", recrie os volumes do MongoDB:

```bash
docker-compose down
docker volume rm vrg-transport-mongodb-data vrg-transport-mongodb-config
docker-compose up -d
```

### Porta 3000 já em uso

Se a porta estiver em uso, pare o Docker ou rode em outra porta:

```bash
# Parar Docker
docker-compose down

# Ou rodar em outra porta
PORT=3001 npm run start:dev
```
