# Usa a imagem base do Node.js LTS (Long Term Support)
FROM node:18-alpine

# Define o diretório de trabalho dentro do contêiner
WORKDIR /app

# Copia package.json e package-lock.json (se existir) para instalar as dependências
COPY package*.json ./

# Instala as dependências do projeto
RUN npm install

# Copia todo o restante do código da sua aplicação para o contêiner
COPY . .

# Expõe a porta em que a aplicação Node.js será executada (a porta 3000 do seu app.js)
EXPOSE 3000

# Comando para iniciar a aplicação quando o contêiner for executado
CMD [ "node", "app.js" ]