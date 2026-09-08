FROM node:18-bullseye AS builder
WORKDIR /app

# 更换 Debian 镜像源为清华源，加速并避免过期
RUN sed -i "s/deb.debian.org/mirrors.tuna.tsinghua.edu.cn/g" /etc/apt/sources.list && \
    sed -i "s/security.debian.org/mirrors.tuna.tsinghua.edu.cn/g" /etc/apt/sources.list

# 安装构建依赖（用于构建 native 模块）
RUN apt-get update && apt-get install -y --no-install-recommends \
  python3 \
  build-essential \
  libsqlite3-dev \
  && rm -rf /var/lib/apt/lists/*

# 复制依赖清单并安装（使用 npm install 以兼容无 lock 文件情况）
COPY package.json package-lock.json* ./
RUN npm install --production

# 复制应用代码（安装完依赖后再复制可以利用缓存）
COPY . .

# 最终运行镜像（更精简）
FROM node:18-slim
WORKDIR /app

# 更换 Debian 镜像源为清华源（第二阶段同样需要）
RUN sed -i "s/deb.debian.org/mirrors.tuna.tsinghua.edu.cn/g" /etc/apt/sources.list && \
    sed -i "s/security.debian.org/mirrors.tuna.tsinghua.edu.cn/g" /etc/apt/sources.list

# 运行时需要的 sqlite 运行库
RUN apt-get update && apt-get install -y --no-install-recommends \
  libsqlite3-0 \
  curl \
  && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production

# 复制 node_modules 和应用代码
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app ./

EXPOSE 8443
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s CMD curl -f http://localhost:8443/ || exit 1
CMD ["node", "index.js"]