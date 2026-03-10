# Backend Guide / 后端说明

## Overview | 概览

The backend is a `Spring Boot 3` API service for authentication, resume/project orchestration, commerce, admin operations, feedback, chat history, and MySQL persistence.

后端基于 `Spring Boot 3`，负责认证、项目与任务编排、积分与订单、后台运营、反馈与聊天记录，以及 MySQL 持久化。

## Stack | 技术栈

- `Java 21`
- `Spring Boot 3.3`
- `Spring Security`
- `Spring JDBC`
- `Spring Mail`
- `Spring Actuator`
- `MySQL 8`

## Module Map | 模块说明

- `api/`：REST controllers
- `service/`：business orchestration and persistence
- `security/`：bearer token auth
- `domain/`：DTOs and state models
- `config/`：security and runtime wiring

## Environment Variables | 环境变量

| Variable | Required | Description |
| --- | --- | --- |
| `MYSQL_URL` | Yes | JDBC URL |
| `MYSQL_USERNAME` | Yes | MySQL username |
| `MYSQL_PASSWORD` | Yes | MySQL password |
| `FRONTEND_BASE_URL` | Recommended | Public frontend URL |
| `APP_CORS_ALLOWED_ORIGIN_PATTERNS` | Recommended | Comma-separated allowed origins |
| `MAIL_HOST` | Optional | SMTP host |
| `MAIL_PORT` | Optional | SMTP port |
| `MAIL_USERNAME` | Optional | SMTP username |
| `MAIL_PASSWORD` | Optional | SMTP password / authorization code |
| `AUTH_MAIL_FROM` | Optional | Sender address |
| `AUTH_MAIL_FROM_NAME` | Optional | Sender name |
| `DASHSCOPE_API_KEY` | Optional | LLM API key |
| `DASHSCOPE_BASE_URL` | Optional | Compatible LLM base URL |
| `DASHSCOPE_MODEL` | Optional | Model name |
| `APP_SEED_USERS_ENABLED` | Optional | Enable local/demo seed users |
| `APP_DEMO_USER_EMAIL` | Optional | Demo user email |
| `APP_DEMO_USER_PASSWORD` | Optional | Demo user password |
| `APP_SHOWCASE_USER_EMAIL` | Optional | Showcase user email |
| `APP_SHOWCASE_USER_PASSWORD` | Optional | Showcase user password |
| `APP_ADMIN_USER_EMAIL` | Optional | Admin user email |
| `APP_ADMIN_PASSWORD` | Optional | Admin user password |

## Local Development | 本地开发

Start the backend with explicit local credentials:

```bash
source "$HOME/.sdkman/bin/sdkman-init.sh"
sdk env

MYSQL_URL='jdbc:mysql://127.0.0.1:3306/crseume?createDatabaseIfNotExist=true&useUnicode=true&characterEncoding=utf8&useSSL=false&serverTimezone=Asia/Shanghai&allowPublicKeyRetrieval=true' \
MYSQL_USERNAME='root' \
MYSQL_PASSWORD='your_local_mysql_password' \
APP_CORS_ALLOWED_ORIGIN_PATTERNS='http://localhost:3000,http://127.0.0.1:3000' \
mvn -f backend/pom.xml spring-boot:run
```

Enable demo accounts only when needed:

```bash
APP_SEED_USERS_ENABLED='true' \
APP_DEMO_USER_PASSWORD='<set_demo_password>' \
APP_SHOWCASE_USER_PASSWORD='<set_showcase_password>' \
APP_ADMIN_PASSWORD='<set_admin_password>'
```

Compile check:

```bash
mvn -q -f backend/pom.xml -DskipTests compile
```

Package:

```bash
mvn -q -f backend/pom.xml -DskipTests package
```

## Operational Notes | 运维说明

- No production credentials are committed in `application.yml`
- Seed users are disabled by default
- Regular users still require email verification codes when logging in
- Admin users can log in with email and password only
- Actuator exposes `health` and `info`

## Production Runtime | 生产运行

Typical command:

```bash
java -jar backend/target/crseume-backend-0.0.1-SNAPSHOT.jar --server.port=8080
```

Recommended reverse proxy:

- Public domain served by `Nginx`
- Backend bound to `127.0.0.1:8080`
- Frontend bound to `127.0.0.1:3000`
- `/api/*` proxied to the backend

## Docker | 容器化

```bash
docker build \
  --build-arg MAVEN_IMAGE=maven:3.9.9-eclipse-temurin-21 \
  --build-arg JAVA_IMAGE=eclipse-temurin:21-jre-jammy \
  -t cvresume-backend ./backend
```

## Related Docs | 相关文档

- [../README.md](../README.md)
- [../frontend/README.md](../frontend/README.md)
