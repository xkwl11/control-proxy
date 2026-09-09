# 定义构建参数（由 compose 传入）
ARG DEBIAN_MIRROR=http://mirrors.aliyun.com

FROM node:18-bullseye AS builder
ARG DEBIAN_MIRROR
WORKDIR /app

# 配置 Debian 源（使用传入的镜像地址）
RUN echo "deb ${DEBIAN_MIRROR}/debian bullseye main contrib non-free" > /etc/apt/sources.list && \
    echo "deb ${DEBIAN_MIRROR}/debian-security bullseye-security main contrib non-free" >> /etc/apt/sources.list && \
    echo "deb ${DEBIAN_MIRROR}/debian bullseye-updates main contrib non-free" >> /etc/apt/sources.list

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    build-essential \
    libsqlite3-dev \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json* ./
RUN npm install --production
COPY . .

FROM node:18-slim
ARG DEBIAN_MIRROR
WORKDIR /app

# 同样配置源
RUN echo "deb ${DEBIAN_MIRROR}/debian bullseye main contrib non-free" > /etc/apt/sources.list && \
    echo "deb ${DEBIAN_MIRROR}/debian-security bullseye-security main contrib non-free" >> /etc/apt/sources.list && \
    echo "deb ${DEBIAN_MIRROR}/debian bullseye-updates main contrib non-free" >> /etc/apt/sources.list

RUN apt-get update && apt-get install -y --no-install-recommends \
    libsqlite3-0 \
    curl \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app ./

EXPOSE 8443
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s CMD curl -f http://localhost:8443/ || exit 1
CMD ["node", "index.js"]
