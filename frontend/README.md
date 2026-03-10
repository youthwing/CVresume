# Frontend Guide / 前端说明

## Overview | 概览

This frontend is a `Next.js 14` App Router application for landing pages, authentication, resume editing, packages, marketplace, and admin screens.

本前端基于 `Next.js 14 App Router`，覆盖首页、登录注册、简历编辑、积分套餐、共享市场和管理后台页面。

## Stack | 技术栈

- `Next.js 14`
- `React 18`
- `TypeScript`
- `Tailwind CSS`
- `next-intl`
- `next-themes`
- `axios`

## Directory Map | 目录结构

```text
frontend/
├── app/                     # App Router pages and layouts
├── components/              # UI and feature components
├── i18n/                    # Locale configuration
├── lib/                     # API client and shared helpers
├── messages/                # Translation JSON files
├── public/                  # Public assets such as favicon
├── static/                  # Product images and payment QR assets
└── package.json
```

## Environment Variables | 环境变量

| Variable | Required | Description |
| --- | --- | --- |
| `NEXT_PUBLIC_API_BASE_URL` | Yes | Local default is `http://localhost:8080/api`; production should use `/api` |

Examples:

```bash
# local development
NEXT_PUBLIC_API_BASE_URL=http://localhost:8080/api

# production behind reverse proxy
NEXT_PUBLIC_API_BASE_URL=/api
```

The client also guards against accidental public-host deployments that still bundle a loopback API URL. On non-localhost hosts it will fall back to same-origin `/api`.

## Local Development | 本地开发

```bash
cd frontend
cp .env.example .env.local
npm install
npm run dev
```

Default URL: `http://localhost:3000`

## Scripts | 脚本

```bash
npm run dev
npm run build
npm run build:standalone
npm run prepare:standalone
npm run bundle:standalone
npm run start
npm run start:standalone
```

## Build Notes | 构建说明

- `NEXT_PUBLIC_*` values are compiled into the bundle
- `bundle:standalone` copies `.next/static` and `public` into `.next/standalone`
- `public/favicon.ico` is the canonical site icon asset
- If `.next` becomes stale, remove it and restart the dev server

## Production Deployment | 生产部署

Recommended runtime:

- `next start --hostname 127.0.0.1 --port 3000`
- Public traffic handled by `Nginx`
- `/api/*` proxied to the backend

Standalone build:

```bash
NEXT_PUBLIC_API_BASE_URL=/api \
SKIP_BUILD_VALIDATION=true \
npm run bundle:standalone
```

Upload:

- `.next/standalone`

Run:

```bash
PORT=3000 HOSTNAME=127.0.0.1 node .next/standalone/server.js
```

## Docker | 容器化

```bash
docker build \
  --build-arg NODE_IMAGE=node:22-bookworm-slim \
  --build-arg NEXT_PUBLIC_API_BASE_URL=/api \
  --build-arg SKIP_BUILD_VALIDATION=true \
  -t cvresume-frontend ./frontend
```

## Related Docs | 相关文档

- [../README.md](../README.md)
- [../backend/README.md](../backend/README.md)
