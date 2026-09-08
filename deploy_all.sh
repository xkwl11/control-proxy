#!/usr/bin/env bash
set -euo pipefail

# deploy_all.sh
# 一键部署脚本（Ubuntu 26.04）
# 作用：在服务器上安装 Docker、Docker Compose，克隆 docker-zerotier-planet 与 control-proxy（fix/db-path 分支），
# 启动 docker compose 并等待 token 拷贝与基本就绪。

WORKDIR="/opt/zero-deploy"
CONTROL_PROXY_REPO="https://github.com/xkwl11/control-proxy.git"
CONTROL_PROXY_BRANCH="fix/db-path"
PLANET_REPO="https://github.com/xubiaolin/docker-zerotier-planet.git"
COMPOSE_FILE_PATH="$WORKDIR/docker-compose.yml"

echo "一键部署 control-proxy + docker-zerotier-planet（Ubuntu 26.04）"
echo "工作目录: $WORKDIR"

if [ "$(id -u)" -ne 0 ]; then
  echo "请以 root 或使用 sudo 运行此脚本" >&2
  exit 1
fi

# 1. 系统准备
apt-get update -y
apt-get install -y --no-install-recommends \
  ca-certificates \
  curl \
  gnupg \
  lsb-release \
  git \
  jq

# 2. 安装 Docker（使用官方 convenience script）
if ! command -v docker >/dev/null 2>&1; then
  echo "安装 Docker..."
  curl -fsSL https://get.docker.com | sh
else
  echo "检测到已安装 Docker"
fi

# 3. 安装 docker compose plugin（现代 Docker 使用 Docker Compose v2 插件）
if ! docker compose version >/dev/null 2>&1; then
  echo "安装 docker compose plugin..."
  apt-get update -y
  apt-get install -y docker-compose-plugin
else
  echo "检测到 docker compose 插件"
fi

# 4. 将当前用户加入 docker 组（若非 root 使用者希望免 sudo）
if [ -n "${SUDO_USER-}" ] && [ "$SUDO_USER" != "root" ]; then
  usermod -aG docker "$SUDO_USER" || true
  echo "已将 $SUDO_USER 添加到 docker 组（需重新登录生效）"
fi

# 5. 克隆/更新项目
mkdir -p "$WORKDIR"
cd "$WORKDIR"

if [ -d "docker-zerotier-planet" ]; then
  echo "docker-zerotier-planet 已存在，尝试更新"
  cd docker-zerotier-planet && git pull --ff-only || true
  cd ..
else
  git clone "$PLANET_REPO"
fi

if [ -d "control-proxy" ]; then
  echo "control-proxy 已存在，尝试更新并切换分支"
  cd control-proxy && git fetch origin && git checkout "$CONTROL_PROXY_BRANCH" && git pull --ff-only origin "$CONTROL_PROXY_BRANCH" || true
  cd ..
else
  git clone "$CONTROL_PROXY_REPO"
  cd control-proxy
  git fetch origin
  git checkout "$CONTROL_PROXY_BRANCH"
  cd ..
fi

# 6. 生成 .env（若不存在）
if [ ! -f ".env" ]; then
  echo "生成 .env（包含 SERVER_SECRET）"
  SERVER_SECRET=$(openssl rand -hex 32 || head -c 32 /dev/urandom | xxd -p -c 32)
  cat > .env <<EOF
SERVER_SECRET=$SERVER_SECRET
CONTROLLER_URL=http://planet:3443
EOF
  echo ".env 已写入 $WORKDIR/.env"
else
  echo ".env 已存在，跳过生成"
fi

# 7. 确保 control-proxy 的 Dockerfile 与 docker-compose 在工作目录
# 复制 control-proxy 的 docker-compose.yml（我们在 control-proxy 分支已提交）
if [ -f "control-proxy/docker-compose.yml" ]; then
  echo "使用 control-proxy 仓库中的 docker-compose.yml"
  cp control-proxy/docker-compose.yml ./docker-compose.yml
else
  echo "control-proxy 仓库中缺少 docker-compose.yml，使用现有仓库根目录的 compose 文件"
fi

# 8. 构建并启动（docker compose）
echo "开始构建并启动服务（可能需要一段时间）..."
docker compose up -d --build

# 9. 等待 planet 与 init-token 完成
echo "等待 zerotier-planet 容器启动并生成 authtoken（最长等待 120 秒）..."
for i in $(seq 1 40); do
  if docker ps --format '{{.Names}}' | grep -q '^zerotier-planet$'; then
    if docker logs zerotier-planet 2>&1 | grep -qi 'authtoken\|token\|authtoken.secret'; then
      echo "在 zerotier-planet 日志中检测到可能的 token 输出，请检查日志。"
      break
    fi
  fi
  sleep 3
done

# 等待 init-token 运行结束
echo "等待 init-token 复制 authtoken 到 control-proxy 卷（最多 60s）..."
for i in $(seq 1 20); do
  if docker ps -a --format '{{.Names}}' | grep -q '^init-token$'; then
    status=$(docker inspect -f '{{.State.ExitCode}}' init-token 2>/dev/null || echo "-1")
    if [ "$status" = "0" ]; then
      echo "init-token 执行成功，authtoken 应已复制到卷中"
      break
    elif [ "$status" != "-1" ] && [ "$status" != "0" ]; then
      echo "init-token 退出码: $status（可能未找到 token）。查看 init-token 日志以获取详情。"
      docker logs init-token || true
      break
    fi
  fi
  sleep 3
done

# 10. 输出管理员创建建议
cat <<EOF
部署完成（或已启动）。下一步建议：
1) 在 control-proxy 容器内部创建管理员（推荐在容器内部以避免公网注册风险）：

   docker exec -it control-proxy sh -c 'curl -s -X POST -H "Content-Type: application/json" -d '\''{"username":"admin","password":"强密码"}'\'' http://localhost:8443/api/register'

2) 登录并获取 JWT：
   docker exec -it control-proxy sh -c 'curl -s -X POST -H "Content-Type: application/json" -d '\''{"username":"admin","password":"强密码"}'\'' http://localhost:8443/api/login'

3) 如果 init-token 未成功复制 token，请查看 zerotier-planet 日志以确定 token 输出位置：
   docker logs zerotier-planet
   docker logs init-token

常见问题排查：
- better-sqlite3 构建失败：查看 docker compose build 输出，建议在构建机器上安装必需的构建工具，或在 dockerfile 的 builder 阶段中已包含。
- token 未找到：不同的 planet 部署可能把 token 写在不同位置，检查 zerotier-planet README 或容器内 /var/lib/zerotier-one 路径。

EOF

exit 0
