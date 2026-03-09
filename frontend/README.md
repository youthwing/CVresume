# Frontend Guide / 前端说明

## Overview | 概览

This frontend is a `Next.js 14` application built with the App Router. It provides the landing pages, auth screens, resume workspace, commerce pages, marketplace, and admin dashboard for `CVResume`.

本前端基于 `Next.js 14 App Router`，覆盖首页、登录注册、简历工作台、支付与积分页面、共享市场和后台管理页面。

## Stack | 技术栈

- `Next.js 14`
- `React 18`
- `TypeScript`
- `Tailwind CSS`
- `next-intl`
- `next-themes`
- `axios`
- `lucide-react`

## Key Features | 关键功能

- `Bilingual routing / 双语路由`：Locale-based routes under `app/[locale]`
- `Resume workflow / 简历工作流`：Create, edit, preview, polish, and export resume content
- `Commerce UI / 商业化界面`：Pricing, packages, redemption, orders, and manual QR payment dialogs
- `Marketplace / 共享市场`：Browse and manage shared resumes
- `Admin console / 管理后台`：Users, orders, products, and redemption code operations

## Directory Map | 目录结构

```text
frontend/
├── app/                     # App Router pages and layouts
├── components/              # UI components, providers, and feature sections
├── i18n/                    # next-intl request configuration
├── lib/                     # API client, templates, helpers, and shared types
├── messages/                # Translation JSON files
├── static/                  # Static assets such as payment QR images
└── package.json
```

## Environment Variables | 环境变量

| Variable | Required | Description |
| --- | --- | --- |
| `NEXT_PUBLIC_API_BASE_URL` | Yes | Base URL for the backend API. Use `http://localhost:8080/api` locally and `/api` in production behind Nginx. |

Examples:

```bash
# local
NEXT_PUBLIC_API_BASE_URL=http://localhost:8080/api

# production behind reverse proxy
NEXT_PUBLIC_API_BASE_URL=/api
```

## Local Development | 本地开发

```bash
cd frontend
cp .env.example .env.local
npm install
npm run dev
```

Default URL: `http://localhost:3000`

## Available Scripts | 可用脚本

```bash
npm run dev
npm run build
npm run start
```

## Build Notes | 构建说明

- `NEXT_PUBLIC_*` variables are compiled into the production bundle.
- Set `.env.production` before running `npm run build`.
- If the Next.js dev server starts reporting missing chunk files under `.next/`, remove `frontend/.next` and restart the dev server.

## Production Deployment | 生产部署

Recommended runtime:

- `next start --hostname 127.0.0.1 --port 3000`
- Reverse proxy public traffic through `Nginx`
- Proxy `/api/*` to the backend service

Sample production env file:

```bash
cp .env.production.example .env.production
```

Then set:

```bash
NEXT_PUBLIC_API_BASE_URL=/api
```

## UI Notes | 界面说明

- Payment currently uses manual Alipay and WeChat QR code confirmation
- Theme switching is hydration-safe in SSR mode
- Locale switching is handled by `next-intl`

## Related Docs | 相关文档

- [../README.md](../README.md)
- [../backend/README.md](../backend/README.md)
