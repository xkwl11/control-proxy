添加 Dockerfile：多阶段构建，包含构建 better-sqlite3 所需的编译工具（builder 阶段），最终镜像为精简运行时镜像并带有健康检查。

说明：
- builder 阶段安装 python3、build-essential、libsqlite3-dev，用于构建 native 模块。npm install 在该阶段完成。
- final 阶段使用 node:18-slim，仅安装 libsqlite3-0 运行时库，并复制 node_modules 与应用代码。
- 暴露 8443 端口并添加简单的 HEALTHCHECK。
