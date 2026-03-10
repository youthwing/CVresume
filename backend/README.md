# Backend Guide / 后端说明

## Overview | 概览

The backend is a `Spring Boot 3` API service responsible for authentication, commerce, project/job orchestration, admin operations, chat/feedback support, and MySQL persistence.

后端基于 `Spring Boot 3`，负责认证、积分与订单、项目与任务编排、后台运营、反馈与聊天支持，以及 MySQL 持久化。

## Stack | 技术栈

- `Java 21`
- `Spring Boot 3.3`
- `Spring Security`
- `Spring JDBC`
- `Spring Mail`
- `Spring Actuator`
- `MySQL 8`

## Module Map | 模块说明

- `api/`：REST controllers for auth, commerce, projects, admin, and support flows
- `service/`：Core business orchestration and persistence
- `security/`：Bearer token auth filter and authenticated principal
- `domain/`：API DTOs and internal state models
- `config/`：Security, CORS, and runtime configuration wiring

## API Domains | API 分组

- `Auth / 认证`：email code sending, login, register, profile, invitations, mocked OAuth
- `Commerce / 商业化`：credits, packages, orders, redemption products, redemption codes
- `Projects / 项目`：project CRUD, async generation jobs, resume result editing, sharing
- `Admin / 管理后台`：dashboard, users, products, orders, custom code generation
- `Support / 支持能力`：feedback, chat sessions, chat history

## Persistence Model | 持久化模型

The current implementation uses a multi-table MySQL schema. Core tables include:

- `users`
- `session_tokens`
- `verification_codes`
- `oauth_providers`
- `oauth_states`
- `credit_packages`
- `redemption_products`
- `credit_ledger_entries`
- `projects`
- `jobs`
- `shared_resumes`
- `orders`
- `redemption_codes`
- `feedback_entries`
- `chat_sessions`
- `chat_messages`

This replaced the earlier single-table JSON blob approach, while the service layer still keeps an in-memory orchestration style for simplicity.

当前版本已经从单表 JSON blob 持久化切换为 MySQL 多表结构，但服务层仍保留以内存对象编排为主的实现方式，以控制改动范围。

## Environment Variables | 环境变量

| Variable | Required | Description |
| --- | --- | --- |
| `MYSQL_URL` | Yes | JDBC URL for MySQL |
| `MYSQL_USERNAME` | Yes | MySQL username |
| `MYSQL_PASSWORD` | Yes | MySQL password |
| `FRONTEND_BASE_URL` | Recommended | Public frontend URL used by auth-related links |
| `APP_CORS_ALLOWED_ORIGIN_PATTERNS` | Recommended | Comma-separated allowed origin patterns for browser access |
| `MAIL_HOST` | Optional | SMTP host, default `smtp.qq.com` |
| `MAIL_PORT` | Optional | SMTP port, default `465` |
| `MAIL_USERNAME` | Optional | SMTP username |
| `MAIL_PASSWORD` | Optional | SMTP password or QQ SMTP authorization code |
| `AUTH_MAIL_FROM` | Optional | Sender address |
| `AUTH_MAIL_FROM_NAME` | Optional | Sender display name |
| `DASHSCOPE_API_KEY` | Optional | LLM API key |
| `DASHSCOPE_BASE_URL` | Optional | Compatible API base URL |
| `DASHSCOPE_MODEL` | Optional | Model name, default `qwen-plus` |

## Local Development | 本地开发

```bash
source "$HOME/.sdkman/bin/sdkman-init.sh"
sdk env
mvn -f backend/pom.xml spring-boot:run
```

Default server URL: `http://localhost:8080`

Compile check:

```bash
mvn -q -f backend/pom.xml -DskipTests compile
```

Package for production:

```bash
mvn -q -f backend/pom.xml -DskipTests package
```

## Operational Notes | 运维说明

- `CORS` is configurable through `APP_CORS_ALLOWED_ORIGIN_PATTERNS`
- Actuator exposes `health` and `info`
- Mail health can report `DOWN` if SMTP credentials are not configured
- The application expects MySQL to be reachable before startup in production

## Production Runtime | 生产运行

Typical start command:

```bash
java -jar backend/target/crseume-backend-0.0.1-SNAPSHOT.jar --server.port=8080
```

Recommended reverse proxy pattern:

- Public domain served by `Nginx`
- Backend bound to `127.0.0.1:8080`
- Frontend bound to `127.0.0.1:3000`
- `/api/*` proxied to the backend

### Docker

The backend can be containerized directly:

```bash
docker build \
  --build-arg MAVEN_IMAGE=maven:3.9.9-eclipse-temurin-21 \
  --build-arg JAVA_IMAGE=eclipse-temurin:21-jre-jammy \
  -t cvresume-backend ./backend
```

For mainland China servers, you can switch the base images to:

```bash
--build-arg MAVEN_IMAGE=m.daocloud.io/docker.io/library/maven:3.9.9-eclipse-temurin-21 \
--build-arg JAVA_IMAGE=m.daocloud.io/docker.io/library/eclipse-temurin:21-jre-jammy
```

The root `docker-compose.yml` already wires the backend to MySQL and frontend with environment-variable based configuration.

## Related Docs | 相关文档

- [../README.md](../README.md)
- [../frontend/README.md](../frontend/README.md)

## License | 开源协议

Licensed under the Apache License 2.0. See [../LICENSE](../LICENSE).

本模块随仓库整体采用 `Apache License 2.0`。
