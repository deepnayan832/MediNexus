FROM node:22-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build \
  && mkdir -p /app/data \
  && chown -R node:node /app

ENV NODE_ENV=production
ENV PORT=8787
ENV MEDINEXUS_HOST=0.0.0.0
ENV MEDINEXUS_DB_PATH=/app/data/medinexus.sqlite
ENV MEDINEXUS_STATIC_DIR=/app/dist

USER node

EXPOSE 8787

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:8787/api/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"]

CMD ["npm", "run", "server:start"]
