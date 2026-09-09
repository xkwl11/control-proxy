#!/usr/bin/env bash
set -euo pipefail

# =============================================================================
# 一键部署 control-proxy + docker-zerotier-planet（Ubuntu 26.04）
# 修复项：
# - GitHub 多代理（2026年9月可用列表）
# - 公网 IP 获取（阿里云元数据 eipv4 + 多个备用 API）
# - Docker 镜像加速（多源）
# - planet 服务使用本地构建（避免 Docker Hub 拉取失败）
# - control-proxy 构建路径修正（指向 ./control-proxy）
# - 云厂商内网资源优先（阿里/腾讯/华为）
# - 动态注入 Debian 镜像源（构建时通过 args 传递）
# - 修复 sed 替换分隔符冲突
# =============================================================================

WORKDIR="/opt/zero-deploy"
CONTROL_PROXY_REPO="https://github.com/xkwl11/control-proxy.git"
CONTROL_PROXY_BRANCH="fix/db-path"
PLANET_REPO="https://github.com/xubiaolin/docker-zerotier-planet.git"

# ---------- GitHub 代理列表（按顺序尝试） ----------
GITHUB_PROXIES=(
  "https://gh-proxy.com/"
  "https://ghproxy.homeboyc.cn/"
  "https://gh.zwy.one/"
  "https://gh.llkk.cc/"
  "https://ghproxy.cxkpro.top/"
  "https://gitclone.com/"
)

# ---------- Docker 镜像加速列表（多源） ----------
DOCKER_MIRRORS=(
  "https://docker.xuanyuan.me"
  "https://docker.m.daocloud.io"
  "https://docker.1ms.run"
  "https://docker.1panel.live"
  "https://hub.rat.dev"
)

echo "一键部署 control-proxy + docker-zerotier-planet（Ubuntu 26.04）"
echo "工作目录: $WORKDIR"
echo "GitHub 代理: ${GITHUB_PROXIES[*]}"
echo "Docker 镜像加速: ${DOCKER_MIRRORS[*]}"

if [ "$(id -u)" -ne 0 ]; then
  echo "请以 root 或使用 sudo 运行此脚本" >&2
  exit 1
fi

# ---------- 检测云厂商 ----------
detect_cloud_provider() {
  if curl -s --connect-timeout 1 -I http://100.100.100.200 >/dev/null 2>&1; then
    echo "aliyun"; return
  fi
  if curl -s --connect-timeout 1 -I http://metadata.tencentyun.com >/dev/null 2>&1; then
    echo "tencent"; return
  fi
  if curl -s --connect-timeout 1 -I http://169.254.169.254 >/dev/null 2>&1; then
    if curl -s --connect-timeout 1 -I http://mirrors.huaweicloud.com >/dev/null 2>&1; then
      echo "huawei"; return
    fi
  fi
  echo "unknown"
}
CLOUD_PROVIDER=$(detect_cloud_provider)
echo "检测到云厂商: $CLOUD_PROVIDER"

# ---------- 配置 apt 源 ----------
case "$CLOUD_PROVIDER" in
  aliyun)
    echo "配置阿里云内网 apt 源"
    sed -i 's|^deb http://.*/ubuntu/|deb http://mirrors.aliyuncs.com/ubuntu/|g' /etc/apt/sources.list
    ;;
  tencent)
    echo "配置腾讯云内网 apt 源"
    sed -i 's|^deb http://.*/ubuntu/|deb http://mirrors.tencentyun.com/ubuntu/|g' /etc/apt/sources.list
    ;;
  huawei)
    echo "配置华为云内网 apt 源"
    sed -i 's|^deb http://.*/ubuntu/|deb http://mirrors.huaweicloud.com/ubuntu/|g' /etc/apt/sources.list
    ;;
  *) echo "未识别的云厂商，使用默认源" ;;
esac

# ---------- 系统准备 ----------
apt-get update -y
apt-get install -y --no-install-recommends ca-certificates curl gnupg lsb-release git jq

# ---------- 安装 Docker ----------
if ! command -v docker >/dev/null 2>&1; then
  echo "安装 Docker..."
  case "$CLOUD_PROVIDER" in
    aliyun)
      curl -fsSL http://mirrors.aliyuncs.com/docker-ce/linux/ubuntu/gpg | apt-key add -
      echo "deb [arch=amd64] http://mirrors.aliyuncs.com/docker-ce/linux/ubuntu $(lsb_release -cs) stable" > /etc/apt/sources.list.d/docker-ce.list
      ;;
    tencent)
      curl -fsSL http://mirrors.tencentyun.com/docker-ce/linux/ubuntu/gpg | apt-key add -
      echo "deb [arch=amd64] http://mirrors.tencentyun.com/docker-ce/linux/ubuntu $(lsb_release -cs) stable" > /etc/apt/sources.list.d/docker-ce.list
      ;;
    huawei)
      curl -fsSL http://mirrors.huaweicloud.com/docker-ce/linux/ubuntu/gpg | apt-key add -
      echo "deb [arch=amd64] http://mirrors.huaweicloud.com/docker-ce/linux/ubuntu $(lsb_release -cs) stable" > /etc/apt/sources.list.d/docker-ce.list
      ;;
    *)
      curl -fsSL https://mirrors.tuna.tsinghua.edu.cn/docker-ce/linux/ubuntu/gpg | apt-key add -
      RELEASE=$(lsb_release -cs)
      [[ "$RELEASE" != "jammy" && "$RELEASE" != "focal" && "$RELEASE" != "bionic" ]] && RELEASE="jammy"
      echo "deb [arch=amd64] https://mirrors.tuna.tsinghua.edu.cn/docker-ce/linux/ubuntu $RELEASE stable" > /etc/apt/sources.list.d/docker-ce.list
      ;;
  esac
  apt-get update -y
  apt-get install -y docker-ce docker-ce-cli containerd.io
else
  echo "检测到已安装 Docker"
fi

# ---------- 安装 docker compose plugin ----------
if ! docker compose version >/dev/null 2>&1; then
  echo "安装 docker compose plugin..."
  apt-get update -y
  apt-get install -y docker-compose-plugin
else
  echo "检测到 docker compose 插件"
fi

# ---------- 配置 Docker 镜像加速 ----------
if [ ${#DOCKER_MIRRORS[@]} -gt 0 ]; then
  mkdir -p /etc/docker
  MIRROR_LIST=$(printf '"%s",' "${DOCKER_MIRRORS[@]}" | sed 's/,$//')
  if [ ! -f /etc/docker/daemon.json ]; then
    echo "配置 Docker 镜像加速器（多源）..."
    cat > /etc/docker/daemon.json <<EOC
{
  "registry-mirrors": [${MIRROR_LIST}]
}
EOC
    systemctl daemon-reload && systemctl restart docker
    echo "Docker 镜像加速配置完成"
  else
    if ! grep -q '"registry-mirrors"' /etc/docker/daemon.json; then
      echo "向现有 daemon.json 添加镜像加速器（多源）..."
      if command -v jq >/dev/null 2>&1; then
        tmp=$(mktemp)
        MIRROR_JSON=$(printf '%s' "${DOCKER_MIRRORS[@]}" | jq -R -s -c 'split("\n") | map(select(length>0))')
        jq --argjson mirrors "$MIRROR_JSON" '. + {"registry-mirrors": $mirrors}' /etc/docker/daemon.json > "$tmp" && mv "$tmp" /etc/docker/daemon.json
        systemctl daemon-reload && systemctl restart docker
        echo "Docker 镜像加速配置已合并"
      else
        echo "警告: 未安装 jq，无法自动合并 daemon.json，请手动添加 registry-mirrors"
      fi
    else
      echo "daemon.json 已包含 registry-mirrors，跳过配置"
    fi
  fi
fi

# ---------- 用户组 ----------
if [ -n "${SUDO_USER-}" ] && [ "$SUDO_USER" != "root" ]; then
  usermod -aG docker "$SUDO_USER" || true
  echo "已将 $SUDO_USER 添加到 docker 组（需重新登录生效）"
fi

# ---------- 辅助函数：带代理的 git clone ----------
clone_with_proxy() {
  local repo_url="$1" target_dir="$2" branch="${3:-}"
  for proxy in "${GITHUB_PROXIES[@]}"; do
    local proxy_url="${proxy}${repo_url}"
    echo "尝试使用代理: $proxy"
    if [ -z "$branch" ]; then
      git clone "$proxy_url" "$target_dir" 2>/dev/null && { echo "克隆成功 (代理: $proxy)"; return 0; }
    else
      git clone -b "$branch" "$proxy_url" "$target_dir" 2>/dev/null && { echo "克隆成功 (代理: $proxy)"; return 0; }
    fi
  done
  echo "所有代理尝试失败，请检查网络或手动克隆" >&2
  return 1
}

# ---------- 清理旧目录，全新开始 ----------
rm -rf "$WORKDIR"
mkdir -p "$WORKDIR" && cd "$WORKDIR"

# ---------- 克隆项目 ----------
echo "克隆 docker-zerotier-planet (使用代理)..."
clone_with_proxy "$PLANET_REPO" "docker-zerotier-planet" ""

echo "克隆 control-proxy (使用代理，分支 $CONTROL_PROXY_BRANCH)..."
clone_with_proxy "$CONTROL_PROXY_REPO" "control-proxy" "$CONTROL_PROXY_BRANCH"

# ---------- 生成 .env ----------
if [ ! -f ".env" ]; then
  echo "生成 .env（包含 SERVER_SECRET）"
  SERVER_SECRET=$(openssl rand -hex 32 || head -c 32 /dev/urandom | xxd -p -c 32)
  cat > .env <<EOC
SERVER_SECRET=$SERVER_SECRET
CONTROLLER_URL=http://planet:3443
EOC
  echo ".env 已写入 $WORKDIR/.env"
else
  echo ".env 已存在，跳过生成"
fi

# ---------- 复制并修复 docker-compose.yml ----------
if [ -f "control-proxy/docker-compose.yml" ]; then
  echo "使用 control-proxy 仓库中的 docker-compose.yml"
  cp control-proxy/docker-compose.yml ./docker-compose.yml

  # ---- 获取公网 IP ----
  PUBLIC_IP=""
  PUBLIC_IP=$(curl -s --connect-timeout 2 http://100.100.100.200/latest/meta-data/eipv4 2>/dev/null | grep -oE '([0-9]+\.){3}[0-9]+' || echo "")
  if [[ ! "$PUBLIC_IP" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    PUBLIC_IP=$(curl -s --connect-timeout 2 ifconfig.me 2>/dev/null || echo "")
  fi
  if [[ ! "$PUBLIC_IP" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    PUBLIC_IP=$(curl -s --connect-timeout 2 ip.sb 2>/dev/null || echo "")
  fi
  if [[ ! "$PUBLIC_IP" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    PUBLIC_IP=$(curl -s --connect-timeout 2 icanhazip.com 2>/dev/null || echo "")
  fi
  if [[ ! "$PUBLIC_IP" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    PUBLIC_IP=$(curl -s --connect-timeout 2 ipinfo.io/ip 2>/dev/null || echo "")
  fi
  if [[ ! "$PUBLIC_IP" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    PUBLIC_IP="127.0.0.1"
    echo "警告: 无法获取公网 IP，使用 127.0.0.1"
  fi
  echo "检测到公网 IP: $PUBLIC_IP"

  # ---- 修复 planet 的 environment ----
  sed -i '/^  planet:/,/^  [^ ]/ {
    /^    environment:/ {
      s/^    environment:.*/    environment:/
      a\      IP_ADDR4: '"$PUBLIC_IP"'
      a\      ZT_PORT: 9994
      a\      API_PORT: 3443
    }
  }' ./docker-compose.yml

  # ---- 修改 planet 为本地构建 ----
  sed -i '/^  planet:/,/^  [^ ]/ s|image: xubiaolin/zerotier-planet:latest|build: ./docker-zerotier-planet|' ./docker-compose.yml

  # ---- 修正 control-proxy 构建路径（关键修复） ----
  # 精确匹配 "    build: ." 并替换为 "    build: ./control-proxy"
  sed -i '/^  control-proxy:/,/^  [^ ]/ {
    s/^    build: \.$/    build: .\/control-proxy/
  }' ./docker-compose.yml

  # ---- 验证修改是否成功 ----
  if grep -A 2 '^  control-proxy:' ./docker-compose.yml | grep -q 'build: ./control-proxy'; then
    echo "✅ control-proxy 构建路径已成功修改为 ./control-proxy"
  else
    echo "❌ 错误：control-proxy 构建路径修改失败！"
    echo "当前 control-proxy 服务块内容："
    sed -n '/^  control-proxy:/,/^  [^ ]/p' ./docker-compose.yml
    exit 1
  fi

  # ---- ★★★ 新增：动态注入 Debian 镜像源（根据云厂商） ★★★ ----
  case "$CLOUD_PROVIDER" in
    aliyun)
      DEBIAN_MIRROR="http://mirrors.cloud.aliyuncs.com"
      ;;
    tencent)
      DEBIAN_MIRROR="http://mirrors.tencentyun.com"
      ;;
    huawei)
      DEBIAN_MIRROR="http://mirrors.huaweicloud.com"
      ;;
    *)
      DEBIAN_MIRROR="http://mirrors.aliyun.com"
      ;;
  esac
  echo "使用 Debian 镜像源: $DEBIAN_MIRROR"

  # 将 control-proxy 的 build 改为多行格式，传入 DEBIAN_MIRROR
  # 使用 | 作为 sed 分隔符，避免 URL 中的 / 冲突
  sed -i '/^  control-proxy:/,/^  [^ ]/ {
    s|^    build: .\/control-proxy$|    build:\n      context: .\/control-proxy\n      args:\n        DEBIAN_MIRROR: '"$DEBIAN_MIRROR"'|
  }' ./docker-compose.yml

  echo "✅ 已为 control-proxy 构建注入 DEBIAN_MIRROR=$DEBIAN_MIRROR"
  # ---- 新增部分结束 ----

  echo "已为 planet 服务注入环境变量 IP_ADDR4=$PUBLIC_IP, ZT_PORT=9994, API_PORT=3443"
  echo "已将 planet 服务改为本地构建（使用 ./docker-zerotier-planet 目录）"
else
  echo "control-proxy 仓库中缺少 docker-compose.yml，退出。"
  exit 1
fi

# ---------- 构建并启动 ----------
echo "开始构建并启动服务（可能需要一段时间）..."
docker compose up -d --build

# ---------- 等待服务就绪 ----------
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

# ---------- 输出后续指引 ----------
cat <<EOF
部署完成（或已启动）。下一步建议：
1) 在 control-proxy 容器内部创建管理员：
   docker exec -it control-proxy sh -c 'curl -s -X POST -H "Content-Type: application/json" -d '\''{"username":"admin","password":"强密码"}'\'' http://localhost:8443/api/register'

2) 登录并获取 JWT：
   docker exec -it control-proxy sh -c 'curl -s -X POST -H "Content-Type: application/json" -d '\''{"username":"admin","password":"强密码"}'\'' http://localhost:8443/api/login'

3) 如果 init-token 未成功复制 token，请查看日志：
   docker logs zerotier-planet
   docker logs init-token

常见问题排查：
- better-sqlite3 构建失败：查看 docker compose build 输出。
- token 未找到：检查 zerotier-planet 容器内 /var/lib/zerotier-one 路径。

EOF

exit 0
