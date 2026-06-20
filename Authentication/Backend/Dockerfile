# Step 1: Use Node 20 alpine as the base image for runtime stability
FROM node:20-alpine

# Step 2: Establish the internal work directory
WORKDIR /app

# Step 3: Copy dependency files first to speed up future container cache layer builds
COPY package*.json ./

# Step 4: Install only essential production modules (removes dev weight)
RUN npm install --only=production

# Step 5: Transfer over your remaining microservice application source files
COPY . .

# Step 6: Expose port 3020 to your internal network bridge mesh
EXPOSE 3020

# Step 7: Launch the Express authentication engine server
CMD ["node", "server.js"]