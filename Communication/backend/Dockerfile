# Use Node 20 to support the latest MongoDB/BSON library methods natively
FROM node:20-alpine

# Set the working directory inside the container
WORKDIR /app

# Copy dependency files first to leverage Docker's build caching layers
COPY package*.json ./

# Install production dependencies only
RUN npm install --only=production

# Copy the rest of the application source code
COPY . .

# Expose the default microservice port
EXPOSE 6020

# Run the backend server
CMD ["node", "index.js"]