FROM node:18-alpine

WORKDIR /usr/src/app

# Copy dependency mappings first to speed up image rebuilding
COPY package*.json ./

RUN npm ci --only=production

# Copy the rest of your application code
COPY . .

EXPOSE 4000

CMD [ "node", "server.js" ]