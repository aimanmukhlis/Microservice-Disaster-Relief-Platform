FROM node:20-alpine
WORKDIR /app
COPY package*.json ./

# 🔥 FORCE DOCKER TO INSTALL THE BROKER'S NETWORKING MODULES DIRECTLY
RUN npm install express cors --only=production

COPY . .
EXPOSE 8020
CMD ["node", "server.js"]