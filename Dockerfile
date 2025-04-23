# Use an official base with Chromium dependencies
FROM node:18-slim

# Install dependencies
RUN apt-get update && apt-get install -y \
    wget gnupg ca-certificates fonts-liberation libasound2 libatk-bridge2.0-0 \
    libcups2 libx11-xcb1 libxcomposite1 libxdamage1 libxrandr2 \
    libgbm1 libgtk-3-0 libnspr4 libnss3 xdg-utils \
    --no-install-recommends && \
    rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /

# Install app
COPY package*.json ./
RUN npm install
COPY . .

# Expose the port your app listens on
EXPOSE 3010

# Start the app
CMD ["node", "server.js"]
