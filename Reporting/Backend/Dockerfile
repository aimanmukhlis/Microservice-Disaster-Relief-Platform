# Step 1: Use Node 20 alpine as the base image for runtime stability
FROM node:20-alpine

# Step 2: Establish the internal work directory
WORKDIR /app

# Step 3: Copy dependency files first to utilize Docker build caching layers
COPY package*.json ./

# Step 4: Install only essential production modules to keep the image lightweight
RUN npm install --only=production

# Step 5: Transfer over your remaining microservice application source files
COPY . .

# Step 6: Expose port 5020 to your internal network bridge mesh
EXPOSE 5020

# Step 7: Launch the Express reporting engine server
CMD ["node", "server.js"]