# Ride Booking Backend

REST API va Socket.IO backend cho GoRide, su dung Express, TypeScript, Prisma va MySQL.

## Khoi tao MySQL local rieng cho project

Lua chon nay dung MySQL 8 da cai tren Windows, chay rieng tai cong `3307` va luu data trong `../.local/mysql`.

```powershell
npm install
powershell -ExecutionPolicy Bypass -File scripts/local-mysql.ps1
node scripts/bootstrap-local.cjs
npm run prisma:generate
npm run prisma:deploy
npm run db:seed
```

Script bootstrap tao database/user ung dung, sau do doi mat khau root ngau nhien. Credential root chi luu trong `.local/mysql/credentials.json`.

Ket noi ung dung local:

```text
mysql://ride_booking:ride_booking@127.0.0.1:3307/ride_booking
```

Dung MySQL project:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/local-mysql.ps1 -Stop
```

## Lua chon Docker

```powershell
docker compose up -d mysql
```

Khi dung Docker, doi `DATABASE_URL` trong `.env` sang cong `3306`, sau do chay migration va seed. Redis trong compose danh cho phase queue/cache sau; code hien tai khong bat buoc Redis.

## Chay API

```powershell
npm run dev
```

- API base: `http://localhost:4000/api`
- Health: `GET http://localhost:4000/health`
- Database readiness: `GET http://localhost:4000/ready`

Server ket noi Prisma truoc khi listen va fail fast neu MySQL khong san sang.

## Migration va seed

```powershell
npm run prisma:generate
npm run prisma:deploy
npm run db:seed
npx prisma migrate status
```

Migration hien tai:

- `20260919000000_init_mysql`: schema nghiep vu chinh.
- `20260919010000_live_sessions`: auth session va lich su tai xe tu choi chuyen.

Seed tao role, ba loai xe, pricing rule va admin local:

- Phone: `0900000000`
- Password: `Admin@123456`

Hay thay credential va JWT secret bang secret manager khi deploy staging/production.

## Kiem thu

```powershell
npm run typecheck
npm test
npm run build
npm run verify:live
```

`verify:live` yeu cau server dang chay. Script kiem tra register, RBAC, duyet tai xe, dat/nhan/hoan thanh chuyen, payment, rating, dashboard, Socket.IO va logout; du lieu tam duoc xoa sau khi chay.

## Realtime va bao mat

- Socket.IO xac thuc access token trong handshake.
- Client chi join duoc ride room khi la customer, driver hoac admin cua chuyen.
- Database chi luu hash refresh token; logout xoa session va ngat socket lien quan.
- Password hash duoc omit tai Prisma client.
- API co Zod validation, RBAC va rate limit JSON nhat quan.
- Driver chi nhan invalidation cua chuyen phu hop, khong nhan thong tin customer truoc khi accept.
