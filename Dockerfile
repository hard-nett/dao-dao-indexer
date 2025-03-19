# Use official Node.js runtime as parent image
FROM node:18-alpine

# Set working directory in container
WORKDIR /usr/src/app

# Copy package files (npm install before copying other files for cache efficiency)
COPY package*.json ./

# Install ALL dependencies (including devDependencies for TypeScript)
RUN npm install
# Copy application files
COPY . .
# Build the application (now TypeScript is available)
RUN npm run build

# Create entrypoint script to handle database setup
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Expose default API port
EXPOSE 3000

# Set entrypoint
ENTRYPOINT ["/entrypoint.sh"]