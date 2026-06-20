# Use Node 20 to cleanly support modern MongoDB driver methods
FROM node:20-alpine

# Set the working directory inside the container
WORKDIR /app

# Copy dependency manifests first to leverage caching layers
COPY package*.json ./

# Install production dependencies only
RUN npm install --only=production

# Copy the rest of the microservice source code
COPY . .

# Expose the internal container port (as defined by your default runtime)
EXPOSE 9020

# Start the application server
CMD ["node", "index.js"]