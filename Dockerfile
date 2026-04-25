# ── Slate Dockerfile ──
FROM node:18-alpine

WORKDIR /app

# Install dependencies first (cache layer)
COPY package*.json ./
RUN npm install --production

# Copy app code
COPY . .

EXPOSE 3000

CMD ["node", "server.js"]
