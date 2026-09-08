# control-proxy

Minimal control-proxy for ZeroTier Planet.

## 一键部署（Ubuntu 26.04）

下面的说明会在 Ubuntu 26.04 上自动安装所需环境，拉取并部署 docker-zerotier-planet 与 control-proxy，并把 planet 的 authtoken 自动复制给 control-proxy。请在开始前务必先阅读“安全注意事项”。

安全注意事项
- 脚本会在 /opt/zero-deploy 下工作；请确保服务器有足够磁盘空间并有 sudo 权限。
- 首次创建管理员（admin）时，请不要把 control-proxy 的 8443 端口暴露到公网。推荐在容器内部创建 admin，或先将服务绑定到 127.0.0.1。
- AUTHTOKEN 是控制器的敏感密钥，请妥善保管，不要将其提交到公共仓库。

步骤概览
1. 下载并查看一键部署脚本。
2. 以 root 或使用 sudo 运行脚本；脚本会安装 Docker、docker compose 插件、克隆代码并启动服务。
3. 在容器内部创建管理员并测试接口。

详细步骤

1) 在服务器上下载并查看脚本（推荐先查看再执行）

sudo mkdir -p /opt/zero-deploy
sudo curl -fsSL -o /opt/zero-deploy/deploy_all.sh https://raw.githubusercontent.com/xkwl11/control-proxy/fix/db-path/deploy_all.sh
sudo chmod +x /opt/zero-deploy/deploy_all.sh
sudo less /opt/zero-deploy/deploy_all.sh

2) 运行脚本（以 root 或 sudo 运行）

sudo /opt/zero-deploy/deploy_all.sh

脚本会：
- 安装必要系统包（git、curl、openssl、jq 等），安装 Docker 与 docker compose 插件；
- 在 /opt/zero-deploy 下 clone/更新 docker-zerotier-planet 和 control-proxy（control-proxy 会切到 fix/db-path 分支）；
- 生成 .env（如果不存在）并创建随机 SERVER_SECRET；
- 使用 docker compose 构建并启动 planet、init-token 与 control-proxy；
- init-token 会尝试从 planet 的卷中拷贝 authtoken.secret 到 control-proxy 的可读路径。

3) 查看服务状态与日志

cd /opt/zero-deploy

docker compose ps

docker logs -f zerotier-planet

docker logs -f init-token

docker logs -f control-proxy

4) 验证 token 是否已复制（容器内查看）

docker exec -it control-proxy sh -c 'if [ -f /secrets/authtoken.secret ]; then echo "authtoken:"; cat /secrets/authtoken.secret; else echo "no authtoken"; fi'

5) 安全创建管理员（推荐在容器内部创建）

# 在 control-proxy 容器内部创建 admin（避免公网抢注）
docker exec -it control-proxy sh -c 'curl -s -X POST -H "Content-Type: application/json" -d '\''{"username":"admin","password":"你的强密码"}'\'' http://localhost:8443/api/register'

# 登录获取 token（同样容器内）
docker exec -it control-proxy sh -c 'curl -s -X POST -H "Content-Type: application/json" -d '\''{"username":"admin","password":"你的强密码"}'\'' http://localhost:8443/api/login'

# 使用获取到的 JWT 测试受保护接口（例如列出 invites）
# 在宿主机上使用：
# curl -H "Authorization: Bearer <token>" http://<server-ip>:8443/api/zui/invites

常见问题与排查
- better-sqlite3 编译失败：查看 docker compose build 输出。脚本已在 builder 阶段安装构建依赖，但某些平台（如 Apple Silicon）可能需要 --platform=linux/amd64 构建。
- init-token 未找到 authtoken：不同的 planet 实现可能把 token 写在不同位置，请检查 zerotier-planet 的容器日志或容器内 /var/lib/zerotier-one 路径。我可以根据实际路径增强 init 服务脚本。
- control-proxy 调用 controller 报错（controller call failed）：检查 CONTROLLER_URL（默认 compose 指向 http://planet:3443），确认 planet API 端口是否匹配；确认 authtoken 是否有效并已复制。
- 数据库写入或权限问题：查看卷权限或容器内 /data 的权限，必要时调整宿主机目录权限或运行容器时指定 --user。


