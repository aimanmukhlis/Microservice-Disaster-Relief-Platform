# 1. Use the official lightweight Node.js environment
FROM node:18-alpine

# 2. Set the working directory inside the container
WORKDIR /usr/src/app

# 3. Copy package files first to leverage Docker caching for dependencies
COPY package*.json ./

# 4. Install only production dependencies
RUN npm ci --only=production

# 5. Copy the remaining source code (server.js, etc.)
COPY . .

# 6. Document that the container listens on port 8020 at runtime
EXPOSE 8020

# 7. Command to execute your application
CMD [ "node", "server.js" ]