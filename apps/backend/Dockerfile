FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package.json ./

# Install ALL dependencies (including devDependencies for build)
RUN npm install

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Expose port
EXPOSE 3001

# Run the application
CMD ["node", "dist/main.js"]
