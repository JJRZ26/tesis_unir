FROM node:20-alpine

WORKDIR /app

# Copy package files from frontend directory
COPY apps/frontend/package.json ./

# Install dependencies
RUN npm install

# Copy source code from frontend directory
COPY apps/frontend/ ./

# Build the application
RUN npm run build

# Expose port
EXPOSE 3000

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Run the application
CMD ["npm", "start"]
