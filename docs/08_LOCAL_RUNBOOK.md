# Runbook local GoRide

Tai lieu nay ap dung cho project GoRide trong `backend/` va `frontend/`. Cac thu muc `Cookmate/` va `MySQL/` la project khac trong cung workspace.

## 1. Khoi dong MySQL rieng cua project

Yeu cau MySQL 8 da cai tai duong dan mac dinh tren Windows.

```powershell
cd backend
npm install
powershell -ExecutionPolicy Bypass -File scripts/local-mysql.ps1
node scripts/bootstrap-local.cjs
npm run prisma:generate
npm run prisma:deploy
npm run db:seed
```

Instance nay dung `127.0.0.1:3307`, data nam trong `.local/mysql` va khong anh huong MySQL system tai cong `3306`.

## 2. Khoi dong ung dung

Terminal backend:

```powershell
cd backend
npm run dev
```

Terminal frontend:

```powershell
cd frontend
npm install
npm run dev -- --host 127.0.0.1
```

- Web: `http://127.0.0.1:5173`
- API: `http://localhost:4000/api`
- Readiness: `http://localhost:4000/ready`
- Admin local: `0900000000` / `Admin@123456`

## 3. Kiem tra

```powershell
cd backend
npm run typecheck
npm test
npm run build
npm run verify:live

cd ..\frontend
npm run typecheck
npm run build
npm run test:e2e
```

`verify:live` tao va xoa du lieu tam de kiem tra REST, MySQL, RBAC, ride state machine, payment va Socket.IO.

## 4. Dung MySQL project

```powershell
cd backend
powershell -ExecutionPolicy Bypass -File scripts/local-mysql.ps1 -Stop
```

## 5. Gioi han hien tai

- Payment that moi ho tro `CASH`.
- Khoang cach/thoi gian la uoc tinh toa do, chua co routing/traffic provider.
- OTP SMS, push notification, object storage va Redis chua duoc tich hop.
- OpenStreetMap public tile can Internet; khi tile loi, nghiep vu va toa do van hoat dong.
