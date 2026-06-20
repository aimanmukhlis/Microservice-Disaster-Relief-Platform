# 1. Use the lightweight Alpine Linux version of Node.js
FROM node:18-alpine

# 2. Set the working directory inside the container
WORKDIR /usr/src/app

# 3. Copy ONLY package.json and package-lock.json first
# This is a Docker caching trick to make rebuilds lightning fast!
COPY package*.json ./

# 4. Install dependencies inside the container
# Only installs production dependencies (ignores devDependencies)
RUN npm install --omit=dev

# 5. Copy the rest of your microservice code
COPY . .

# 6. Expose the port your GIS service uses
EXPOSE 7030

# 7. The command to start the server
CMD ["node", "server.js"]