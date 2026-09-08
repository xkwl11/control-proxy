集成部署说明（docker-zerotier-planet 与 control-proxy 一键部署）

说明
- 本 docker-compose.yml 在同一台主机上同时启动 ZeroTier Planet（使用 xubiaolin/docker-zerotier-planet）与 control-proxy 服务。
- 关键点：planet 服务的 /var/lib/zerotier-one 数据通过命名卷 zerotier_one 与 control-proxy 共享，control-proxy 会尝试从 /secrets/authtoken.secret 读取 controller 的 authtoken（如果存在）。

操作步骤（在单台服务器上执行）
1) 在父目录中克隆两个仓库：

   git clone https://github.com/xubiaolin/docker-zerotier-planet.git
   git clone https://github.com/xkwl11/control-proxy.git

2) 切换 control-proxy 到修复分支（fix/db-path）：

   cd control-proxy
   git fetch origin
   git checkout fix/db-path
   cd ..

3) （可选）创建 .env 文件并设置 SECRET 等敏感信息：

   # 在父目录创建 .env
   cat > .env <<EOF
   SERVER_SECRET=替换为你自己的强随机字符串
   CONTROLLER_URL=http://planet:3443
   EOF

4) 构建并启动服务：

   docker compose up -d --build

5) 等待 planet 初始化并生成 authtoken（如果该实现会生成 authtoken 到 /var/lib/zerotier-one/authtoken.secret）：

   docker logs -f zerotier-planet

   # 如果 authtoken 已写入卷，可以在宿主机查看（以命名卷挂载可能需要进入容器查看）
   docker exec -it zerotier-planet sh -c 'cat /var/lib/zerotier-one/authtoken.secret'

6) 如果取到 authtoken，将其放到命名卷对应路径或确保 planet 已把文件写入（control-proxy 会从 /secrets/authtoken.secret 读取）：

   # 示例：将 token 写入本地并覆盖卷（谨慎操作）
   echo "THE_AUTHTOKEN" > ./planet-data/authtoken.secret

7) 创建 admin（建议在容器内部创建以免公网注册）

   # 在 control-proxy 容器内运行（容器内部访问的是 localhost）
   docker exec -it control-proxy sh -c 'curl -s -X POST -H "Content-Type: application/json" -d '\''{"username":"admin","password":"强密码"}'\'' http://localhost:8443/api/register'

8) 登录并测试 API：

   docker exec -it control-proxy sh -c 'curl -s -X POST -H "Content-Type: application/json" -d '\''{"username":"admin","password":"强密码"}'\'' http://localhost:8443/api/login'

   # 从宿主机使用 token 测试
   curl -H "Authorization: Bearer <token>" http://localhost:8443/api/zui/invites

安全建议
- 首次创建 admin 时请确保服务未对公网开放（或在容器内部创建管理员）。
- AUTHTOKEN 是控制器 API 的密钥，应妥善保管，避免泄露到日志或公共仓库。
- 部署到生产时请在反向代理（如 nginx）后加 HTTPS。

注意事项
- docker-zerotier-planet 的某些实现可能要求在其 WEB UI 中设置初始 admin 密码或会以不同位置输出 authtoken，请根据其 README 检查实际产物位置。若在运行中无法找到 authtoken，先检查 zerotier-planet 容器日志或容器内 /var/lib/zerotier-one 目录。

如果你同意，我会把上述 compose 文件和说明提交到 fix/db-path 分支（我已经提交）并为你继续完善（例如：自动等待并把 authtoken 拷贝到 control-proxy 可读位置的 init 容器脚本）。

接下来我可以：
- 添加一个 init 服务（小容器）在 planet 就绪后自动拷贝 authtoken 到 control-proxy 可读路径；或
- 添加更详细的部署脚本并把其提交到分支，做到真正一键化（推荐）。

请选择下一步：
- 回复“添加 init 自动拷贝 token” 我就把脚本加入并提交；
- 或回复“我自己手动处理 token” 你按上面步骤手动操作；
- 或回复“先测试看看” 然后你运行 docker compose 我帮你处理遇到的问题。