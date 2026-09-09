# control-proxy

Minimal control-proxy for ZeroTier Planet.

## 一键部署（Ubuntu 26.04）

下面的说明会在 Ubuntu 26.04 上自动安装所需环境，拉取并部署 docker-zerotier-planet 与 control-proxy，并把 planet 的 authtoken 自动复制给 control-proxy。为简洁起见，下面使用当前用户的主目录（$HOME）作为工作目录，避免必须创建系统级目录或频繁使用 sudo。

安全注意事项
- 脚本可能需要在运行期间使用 sudo 来安装软件或写入受保护目录；脚本会在必要时提示。请先阅读脚本内容确认没有敏感信息。
- AUTHTOKEN 是控制器的敏感密钥，请妥善保管，不要将其提交到公共仓库。
- 首次创建管理员（admin）时，请不要把 control-proxy 的 8443 端口暴露到公网。推荐在容器内部创建 admin，或先将服务绑定到 127.0.0.1。

极简步骤（推荐）

1) 在服务器上创建工作目录并下载脚本

mkdir -p "$HOME/zero-deploy"

# 一键执行脚本

# curl -fsSL "https://ghproxy.net/https://raw.githubusercontent.com/xkwl11/control-proxy/main/deploy_all.sh" | sudo bash -s -- --yes"


2) 查看脚本（务必先检查，防止下载到 HTML/404 页面）

less "$HOME/zero-deploy/deploy_all.sh"
# 或只看前几行：
head -n 50 "$HOME/zero-deploy/deploy_all.sh"

3) 运行脚本

# 快速一键（如果脚本内部会使用 sudo，则会提示你）：
"$HOME/zero-deploy/deploy_all.sh" --yes

# 或交互式（推荐首次运行）：
"$HOME/zero-deploy/deploy_all.sh"

脚本会自动处理依赖安装、克隆并启动容器等操作。使用 $HOME/zero-deploy 的好处是：不需要提前创建 /opt 之类的系统目录，普通用户即可完成下载与执行权限设置；如果脚本需要提升权限，它会在运行时请求。

查看服务状态与日志（示例）

cd "$HOME/zero-deploy"

docker compose ps

docker logs -f zerotier-planet

docker logs -f init-token

docker logs -f control-proxy

验证 token 是否已复制（容器内查看）

docker exec -it control-proxy sh -c 'if [ -f /secrets/authtoken.secret ]; then echo "authtoken:"; cat /secrets/authtoken.secret; else echo "no authtoken"; fi'

安全创建管理员（推荐在容器内部创建）

docker exec -it control-proxy sh -c 'curl -s -X POST -H "Content-Type: application/json" -d '\''{"username":"admin","password":"你的强密码"}'\'' http://localhost:8443/api/register'

常见问题与排查（保留简短说明）
- 如果下载的文件是 HTML（404 页面），请检查仓库是否为 private，或使用上面的 PAT/gh 方法。
- 若脚本在安装依赖时失败，请查看脚本输出日志，根据提示安装缺失的包。

其它说明
- 如果你愿意，我可以把 README 中其他部分再进一步简化或把示例脚本提取到单独的 docs/deploy.md 文件。
