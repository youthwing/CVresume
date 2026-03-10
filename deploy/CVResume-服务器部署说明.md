# CVResume 服务器部署说明

## 1. 当前线上环境

- 域名：`cv.wingod.top`
- 服务器部署根目录：`/www/wwwroot/CVresume-release`
- 后端目录：`/www/wwwroot/CVresume-release/backend`
- 前端目录：`/www/wwwroot/CVresume-release/frontend/.next/standalone`
- 前端监听：`127.0.0.1:3000`
- 后端监听：`127.0.0.1:8080`
- 数据库名：`crseume`
- 数据库用户：`crseume_user`
- 反向代理建议：
  - `/` -> `http://127.0.0.1:3000`
  - `/api` -> `http://127.0.0.1:8080`

## 2. 本地重新打包

在本地项目根目录执行：

```bash
cd /Users/blaizeer/projects/i/Crseume

NEXT_PUBLIC_API_BASE_URL=/api \
SKIP_BUILD_VALIDATION=true \
npm --prefix frontend run bundle:standalone

source "$HOME/.sdkman/bin/sdkman-init.sh"
sdk env
mvn -q -f backend/pom.xml -DskipTests package
```

打包完成后，会得到两个核心产物：

- 前端目录：`frontend/.next/standalone`
- 后端文件：`backend/target/crseume-backend-0.0.1-SNAPSHOT.jar`

## 3. 建议的打包归档方式

在本地项目根目录执行：

```bash
BUILD_TAG="$(git rev-parse --short HEAD)-$(date +%Y%m%d)"
TMP_DIR="/tmp/cvresume-package-$BUILD_TAG"

rm -rf "$TMP_DIR"
mkdir -p "$TMP_DIR"

cp backend/target/crseume-backend-0.0.1-SNAPSHOT.jar "$TMP_DIR/crseume-backend.jar"
tar -C frontend/.next -czf "cvresume-frontend-standalone-$BUILD_TAG.tar.gz" standalone
tar -C "$TMP_DIR" -czf "cvresume-backend-single-$BUILD_TAG.tar.gz" crseume-backend.jar

ls -lh "cvresume-frontend-standalone-$BUILD_TAG.tar.gz" "cvresume-backend-single-$BUILD_TAG.tar.gz"
```

这样会得到两个上传包：

- `cvresume-frontend-standalone-<版本>.tar.gz`
- `cvresume-backend-single-<版本>.tar.gz`

## 4. 上传到服务器

把两个压缩包都上传到：

```text
/www/wwwroot/CVresume-release/
```

如果用宝塔文件面板，直接上传即可。

## 5. 服务器更新部署

登录服务器终端后，执行下面这套命令。

先定义变量：

```bash
APP_ROOT="/www/wwwroot/CVresume-release"
FRONT_TAR="$APP_ROOT/cvresume-frontend-standalone-<版本>.tar.gz"
BACK_TAR="$APP_ROOT/cvresume-backend-single-<版本>.tar.gz"
```

先解压覆盖：

```bash
mkdir -p "$APP_ROOT/backend" "$APP_ROOT/frontend/.next"

rm -rf "$APP_ROOT/frontend/.next/standalone"
rm -f "$APP_ROOT/backend/crseume-backend.jar"

tar -xzf "$BACK_TAR" -C "$APP_ROOT/backend"
tar -xzf "$FRONT_TAR" -C "$APP_ROOT/frontend/.next"

chown -R www:www "$APP_ROOT"
```

再停止旧进程：

```bash
fuser -k 3000/tcp 8080/tcp 2>/dev/null || true
sleep 2
```

启动前端：

```bash
nohup env PORT=3000 HOSTNAME=127.0.0.1 \
node "$APP_ROOT/frontend/.next/standalone/server.js" \
> "$APP_ROOT/frontend/frontend.log" 2>&1 &
```

启动后端：

```bash
nohup env \
MYSQL_URL='jdbc:mysql://127.0.0.1:3306/crseume?createDatabaseIfNotExist=true&useUnicode=true&characterEncoding=utf8&useSSL=false&serverTimezone=Asia/Shanghai&allowPublicKeyRetrieval=true' \
MYSQL_USERNAME='crseume_user' \
MYSQL_PASSWORD='<MYSQL_PASSWORD>' \
FRONTEND_BASE_URL='https://cv.wingod.top' \
APP_CORS_ALLOWED_ORIGIN_PATTERNS='https://cv.wingod.top,http://cv.wingod.top' \
MAIL_HOST='smtp.qq.com' \
MAIL_PORT='465' \
MAIL_USERNAME='89919774@qq.com' \
MAIL_PASSWORD='<MAIL_PASSWORD>' \
AUTH_MAIL_FROM='89919774@qq.com' \
DASHSCOPE_API_KEY='<DASHSCOPE_API_KEY>' \
java -jar "$APP_ROOT/backend/crseume-backend.jar" --server.port=8080 \
> "$APP_ROOT/backend/backend.log" 2>&1 &
```

## 6. 部署后检查

执行：

```bash
ss -lntp | egrep ':(3000|8080)\s' || true
curl http://127.0.0.1:8080/actuator/health
curl -I http://127.0.0.1:3000
tail -n 50 /www/wwwroot/CVresume-release/frontend/frontend.log
tail -n 50 /www/wwwroot/CVresume-release/backend/backend.log
```

正常结果：

- `3000` 有 Node/Next 进程监听
- `8080` 有 Java 进程监听
- 后端健康检查返回：`{"status":"UP"}`
- 前端返回：`HTTP/1.1 200 OK` 或 `307 Temporary Redirect`

## 7. 宝塔网站配置

如果网站配置丢失，在宝塔按下面恢复：

1. `网站` -> `添加站点`
2. 域名填写：`cv.wingod.top`
3. 站点目录可用：`/www/wwwroot/cv.wingod.top`
4. 不创建数据库
5. 站点设置 -> `反向代理`

添加两条代理：

- 代理 1
  - 路径：`/`
  - 目标：`http://127.0.0.1:3000`
- 代理 2
  - 路径：`/api`
  - 目标：`http://127.0.0.1:8080`

然后到 `SSL` 页面给 `cv.wingod.top` 重新签发或启用证书。

## 8. 日常更新最短流程

以后每次代码改动后，只做下面四步：

1. 本地重新打包。
2. 上传两个新的 `tar.gz` 到 `/www/wwwroot/CVresume-release/`。
3. 在服务器执行“服务器更新部署”那一整段命令。
4. 执行“部署后检查”确认服务恢复。

## 9. 常见故障

### 9.1 端口被占用

报错示例：

- `EADDRINUSE: address already in use 127.0.0.1:3000`
- `Port 8080 was already in use`

处理：

```bash
fuser -k 3000/tcp 8080/tcp 2>/dev/null || true
sleep 2
```

然后重新启动前后端。

### 9.2 前端起不来

先看：

```bash
node -v
tail -n 100 /www/wwwroot/CVresume-release/frontend/frontend.log
```

要求：

- Node 建议 `22`

### 9.3 后端起不来

先看：

```bash
java -version
tail -n 100 /www/wwwroot/CVresume-release/backend/backend.log
```

要求：

- Java 必须 `21`

### 9.4 数据库连不上

先看：

```bash
tail -n 100 /www/wwwroot/CVresume-release/backend/backend.log
```

重点检查：

- `MYSQL_USERNAME`
- `MYSQL_PASSWORD`
- MySQL 服务是否正常

### 9.5 邮件验证码发不出去

重点检查：

- `MAIL_USERNAME`
- `MAIL_PASSWORD`
- `AUTH_MAIL_FROM`

QQ 邮箱推荐配置：

- `MAIL_HOST=smtp.qq.com`
- `MAIL_PORT=465`

## 10. 建议优化

当前是手动 `nohup` 启动，能用，但不稳。后续建议改成：

- 前端用 `pm2`
- 后端用 `systemd`

这样服务器重启后会自动拉起，不用手动进终端。

## 11. 安全提醒

不要把下面这些真实值直接写进长期保存的公开文档或截图：

- 数据库密码
- QQ 邮箱授权码
- 大模型 API Key

建议把它们单独保存在密码管理器里，部署时再临时填入命令。
