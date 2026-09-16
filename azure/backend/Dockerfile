FROM node:24-alpine

LABEL org.opencontainers.image.source="https://github.com/ShimaBell0619/switchbot-home-dashboard"
LABEL org.opencontainers.image.licenses="MIT"

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts --no-audit --no-fund
COPY . .

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000
USER node

CMD ["node", "server.js"]
