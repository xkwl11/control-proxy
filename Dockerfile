FROM node:18-bullseye AS builder
WORKDIR /app

# 覆盖为清华源（替换默认源）
RUN echo "deb http://mirrors.tuna.tsinghua.edu.cn/debian bullseye main contrib non-free" > /etc/apt/sources.list && \
    echo "deb http://mirrors.tuna.tsinghua.edu.cn/debian-security bullseye-security main contrib non-free" >> /etc/apt/sources.list && \
    echo "deb http://mirrors.tuna.tsinghua.edu.cn/debian bullseye-updates main contrib non-free" >> /etc/apt/sources.list

# 安装构建依赖
RUN apt-get update && apt-get install -y --no-install-recommends \
  python3 \
  build-essential \
  libsqlite3-dev \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json* ./
RUN npm install --production

COPY . .

FROM node:18-slim
WORKDIR /app

# 覆盖为清华源（第二阶段同样处理）
RUN echo "deb http://mirrors.tuna.tsinghua.edu.cn/debian bullseye main contrib non-free" > /etc/apt/sources.list && \
    echo "deb http://mirrors.tuna.tsinghua.edu.cn/debian-security bullseye-security main contrib non-free" >> /etc/apt/sources.list && \
    echo "deb http://mirrors.tuna.tsinghua.edu.cn/debian bullseye-updates main contrib non-free" >> /etc/apt/sources.list

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
