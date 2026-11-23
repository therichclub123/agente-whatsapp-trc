# Bot de WhatsApp + panel (Next.js) para Railway. El disco persistente va montado en /app/data.
FROM node:22-bookworm-slim

# python3/make/g++: compilar better-sqlite3. procps: trae `ps`, que necesita
# tree-kill (usado por concurrently --kill-others) para cerrar bot+web en los
# redeploys; sin él, cada apagado del contenedor tira el proceso con ENOENT.
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ ca-certificates procps \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --include=dev
COPY . .
RUN npm run build

ENV NODE_ENV=production
ENV AUTH_DIR=/app/data/auth
CMD ["npm", "run", "start:all"]
