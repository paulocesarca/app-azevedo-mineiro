FROM node:20-alpine

WORKDIR /app

# Copiar package files
COPY package*.json ./

# Instalar dependências
RUN npm ci --production

# Copiar código fonte
COPY src ./src

# Criar diretório de dados para SQLite
RUN mkdir -p /app/data

# Expor porta
EXPOSE 3001

# Iniciar servidor
CMD ["node", "src/index.js"]
