#!/usr/bin/env bash
set -euo pipefail

# =============================================================================
# ZeroTier 控制面板 一键部署脚本
# 仓库：https://github.com/xkwl11/deploy-scripts
#
# 用法：
#   curl -fsSL "https://raw.githubusercontent.com/xkwl11/deploy-scripts/main/deploy_all.sh" -o /tmp/deploy.sh
#   sudo bash /tmp/deploy.sh
#
# 首次运行会提示输入 GitHub Token
# =============================================================================

# ---------- 读取 Token ----------
if [ -z "${GITHUB_TOKEN:-}" ] && [ -n "${1:-}" ]; then
  GITHUB_TOKEN="$1"
fi

if [ -z "${GITHUB_TOKEN:-}" ]; then
  echo "======================================================================"
  echo "  ZeroTier 控制面板 私有部署"
  echo "======================================================================"
  echo ""
  echo "请粘贴你的 GitHub Token（输入后回车，不会显示）："
  echo "  生成地址：https://github.com/settings/tokens"
  echo "  权限需要：repo + workflow"
  echo ""
  read -s -p "Token: " GITHUB_TOKEN
  echo ""
  if [ -z "$GITHUB_TOKEN" ]; then
    echo "❌ 未输入 Token，退出"
    exit 1
  fi
fi

GITHUB_TOKEN=$(echo "$GITHUB_TOKEN" | tr -d ' \n\r')

if [[ ! "$GITHUB_TOKEN" =~ ^ghp_ ]] && [[ ! "$GITHUB_TOKEN" =~ ^github_pat_ ]]; then
  echo "⚠️ Token 格式看起来不对（应以 ghp_ 或 github_pat_ 开头）"
  read -p "是否继续？(y/N) " confirm
  if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
    exit 1
  fi
fi

echo "✅ Token 已读取（前缀：${GITHUB_TOKEN:0:7}...）"

# ---------- 配置 ----------
WORKDIR="/opt/zero-deploy"
PRIVATE_REPO="xkwl11/ztcp-private"
PRIVATE_BRANCH="main"
PLANET_REPO="https://github.com/xubiaolin/docker-zerotier-planet.git"

DOCKER_MIRRORS=(
  "https://docker.xuanyuan.me"
  "https://docker.m.daocloud.io"
  "https://docker.1ms.run"
  "https://docker.1panel.live"
  "https://hub.rat.dev"
)

GITHUB_PROXIES=(
  "https://gh-proxy.com/"
  "https://ghproxy.homeboyc.cn/"
  "https://gh.zwy.one/"
)

echo "======================================================================"
echo "ZeroTier 控制面板 私有部署"
echo "工作目录: $WORKDIR"
echo "======================================================================"

if [ "$(id -u)" -ne 0 ]; then
  echo "❌ 请以 root 或使用 sudo 运行此脚本" >&2
  exit 1
fi

# ---------- 检测云厂商 ----------
detect_cloud_provider() {
  if curl -s --connect-timeout 1 -I http://100.100.100.200 >/dev/null 2>&1; then echo "aliyun"; return; fi
  if curl -s --connect-timeout 1 -I http://metadata.tencentyun.com >/dev/null 2>&1; then echo "tencent"; return; fi
  if curl -s --connect-timeout 1 -I http://169.254.169.254 >/dev/null 2>&1; then
    if curl -s --connect-timeout 1 -I http://mirrors.huaweicloud.com >/dev/null 2>&1; then echo "huawei"; return; fi
  fi
  echo "unknown"
}
CLOUD_PROVIDER=$(detect_cloud_provider)
echo "✅ 云厂商: $CLOUD_PROVIDER"

# ---------- 配置 apt 源 ----------
case "$CLOUD_PROVIDER" in
  aliyun) sed -i 's|^deb http://.*/ubuntu/|deb http://mirrors.aliyuncs.com/ubuntu/|g' /etc/apt/sources.list 2>/dev/null || true ;;
  tencent) sed -i 's|^deb http://.*/ubuntu/|deb http://mirrors.tencentyun.com/ubuntu/|g' /etc/apt/sources.list 2>/dev/null || true ;;
  huawei) sed -i 's|^deb http://.*/ubuntu/|deb http://mirrors.huaweicloud.com/ubuntu/|g' /etc/apt/sources.list 2>/dev/null || true ;;
esac

# ---------- 系统准备 ----------
echo "→ 安装系统依赖..."
apt-get update -y
apt-get install -y --no-install-recommends ca-certificates curl gnupg lsb-release git jq

# ---------- 安装 Docker ----------
if ! command -v docker >/dev/null 2>&1; then
  echo "→ 安装 Docker..."
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
  echo "✅ Docker 已安装"
fi

if ! docker compose version >/dev/null 2>&1; then
  apt-get update -y
  apt-get install -y docker-compose-plugin
fi

# ---------- Docker 镜像加速 ----------
mkdir -p /etc/docker
if [ ! -f /etc/docker/daemon.json ]; then
  MIRROR_LIST=$(printf '"%s",' "${DOCKER_MIRRORS[@]}" | sed 's/,$//')
  cat > /etc/docker/daemon.json <<EOC
{
  "registry-mirrors": [${MIRROR_LIST}]
}
EOC
  systemctl daemon-reload && systemctl restart docker
fi

# ---------- 克隆私有仓库 ----------
echo "→ 克隆私有仓库..."
rm -rf "$WORKDIR"
mkdir -p "$WORKDIR" && cd "$WORKDIR"

REPO_URL="https://${GITHUB_TOKEN}@github.com/${PRIVATE_REPO}.git"

if ! git clone -b "$PRIVATE_BRANCH" "$REPO_URL" control-proxy 2>&1; then
  echo "❌ 私有仓库克隆失败"
  echo "   请确认 Token 有效、勾选 repo 权限"
  exit 1
fi
echo "✅ 私有仓库克隆成功"

cd control-proxy
git remote set-url origin "https://github.com/${PRIVATE_REPO}.git"
cd ..

# ---------- 克隆 planet 仓库 ----------
echo "→ 克隆 docker-zerotier-planet..."
PLANET_CLONED=0
for proxy in "${GITHUB_PROXIES[@]}"; do
  if git clone "${proxy}${PLANET_REPO}" docker-zerotier-planet 2>/dev/null; then
    echo "  ✅ planet 克隆成功（代理：$proxy）"
    PLANET_CLONED=1
    break
  fi
done

if [ "$PLANET_CLONED" = "0" ]; then
  echo "  ⚠️ 代理克隆失败，尝试直连..."
  git clone "$PLANET_REPO" docker-zerotier-planet || {
    echo "❌ planet 仓库克隆失败，请检查网络"
    exit 1
  }
fi

# ---------- 准备配置 ----------
echo "→ 准备配置..."
cp control-proxy/docker-compose.yml ./docker-compose.yml
mkdir -p ./nginx
cp control-proxy/nginx/ztncui.conf ./nginx/ztncui.conf

mkdir -p ./planet-config
echo 9994 > ./planet-config/zerotier-one.port
cat > ./planet-config/local.conf << 'EOFCONF'
{
  "settings": {
    "allowManagementFrom": ["0.0.0.0/0", "::/0"]
  }
}
EOFCONF

# ---------- 获取公网 IP ----------
echo "→ 获取公网 IP..."
PUBLIC_IP=$(curl -s --connect-timeout 2 http://100.100.100.200/latest/meta-data/eipv4 2>/dev/null | grep -oE '([0-9]+\.){3}[0-9]+' || echo "")
[[ ! "$PUBLIC_IP" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]] && PUBLIC_IP=$(curl -s --connect-timeout 2 ifconfig.me 2>/dev/null || echo "")
[[ ! "$PUBLIC_IP" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]] && PUBLIC_IP=$(curl -s --connect-timeout 2 ip.sb 2>/dev/null || echo "")
[[ ! "$PUBLIC_IP" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]] && PUBLIC_IP="127.0.0.1"
echo "✅ 公网 IP: $PUBLIC_IP"

# ---------- 生成 .env ----------
echo "→ 生成 .env..."
SERVER_SECRET=$(openssl rand -hex 32 || head -c 32 /dev/urandom | xxd -p -c 32)
cat > .env <<EOC
SERVER_SECRET=$SERVER_SECRET
CONTROLLER_URL=http://planet:3443
IP_ADDR4=$PUBLIC_IP
ZT_PORT=9994
API_PORT=3443
EOC

# ---------- 启动 ----------
echo "→ 构建并启动（首次可能需要 3-5 分钟）..."
docker compose up -d --build

sleep 20

# ---------- 验证 ZeroTier ----------
if ! docker exec zerotier-planet netstat -tlnp 2>/dev/null | grep -q ':9994'; then
  echo "→ ZeroTier 未监听 9994，尝试修复..."
  docker exec zerotier-planet sh -c "pkill -9 zerotier-one; sleep 2; cd /var/lib/zerotier-one && ./zerotier-one -p9994 -d" 2>/dev/null || true
  sleep 5
  if docker exec zerotier-planet netstat -tlnp 2>/dev/null | grep -q ':9994'; then
    echo "✅ ZeroTier 已恢复"
  else
    echo "⚠️ 请检查日志：docker logs zerotier-planet"
  fi
else
  echo "✅ ZeroTier 已在 9994 监听"
fi

# ---------- 输出指引 ----------
cat <<EOF
======================================================================
✅ 部署完成！

📍 入口（IP: $PUBLIC_IP）：
   注册：      http://$PUBLIC_IP:8443/register
   用户登录：  http://$PUBLIC_IP:8443/user
   管理员后台：http://$PUBLIC_IP:8443/admin
   API 文档：  http://$PUBLIC_IP:8443/docs
   planet 下载：http://$PUBLIC_IP:8443/download/planet

🔑 首次使用：
   1. 浏览器打开 http://$PUBLIC_IP:8443/register
   2. 注册第一个账号（自动成为管理员）
   3. 后续用户注册需管理员在 /admin 审核

📌 客户端组网：
   1. 下载 planet：http://$PUBLIC_IP:8443/download/planet
   2. 替换本机 ZeroTier 的 planet 文件
      - Windows: C:\\ProgramData\\ZeroTier\\One\\planet
      - Linux:   /var/lib/zerotier-one/planet
      - macOS:   /Library/Application Support/ZeroTier/One/planet
   3. 重启 ZeroTier 服务
   4. 加入网络 ID（在用户面板创建网络后可见）

📋 查看日志：
   docker logs control-proxy
   docker logs zerotier-planet
   docker logs ztncui-nginx
======================================================================
EOF

exit 0
