FROM node:18-bullseye AS builder
WORKDIR /app

ENV npm_config_registry=https://registry.npmmirror.com
ENV npm_config_disturl=https://registry.npmmirror.com/-/binary/node
ENV npm_config_better_sqlite3_binary_host_mirror=https://registry.npmmirror.com/-/binary/better-sqlite3

RUN apt-get update && \
    apt-get install -y --no-install-recommends python3 make g++ && \
    rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json* ./
RUN npm install --omit=dev

COPY . .

FROM node:18-slim
WORKDIR /app

RUN apt-get update && \
    apt-get install -y --no-install-recommends libsqlite3-0 curl && \
    rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app ./

ENV NODE_ENV=production
EXPOSE 8443
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s CMD curl -f http://localhost:8443/ || exit 1
CMD ["node", "index.js"]
