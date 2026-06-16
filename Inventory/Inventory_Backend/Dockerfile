# 1. Use an official Node.js runtime environment as the base image
FROM node:20-alpine

# 2. Set the working directory inside the container
WORKDIR /usr/src/app

# 3. Copy package.json and package-lock.json first to cache dependencies
COPY package*.json ./

# 4. Install production dependencies
RUN npm install --only=production

# 5. Copy the rest of your backend source code into the container
COPY . .

# 6. Inform Docker that the container listens on port 7020 at runtime
EXPOSE 7020

# 7. Define the command to run your microservice
CMD ["node", "index.js"]