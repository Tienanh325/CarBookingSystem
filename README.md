# CarBookingSystem - GoRide

He thong dat xe va quan ly van hanh online tuong tu Xanh SM. Workspace da co backend, MySQL migration, REST API, Socket.IO va ba giao dien Customer, Driver, Admin ket noi du lieu that.

## Thanh phan da hoan thien

- Backend modular monolith: Express 5, TypeScript, Prisma, MySQL.
- Access token + refresh session luu database, RBAC va thu hoi socket khi logout.
- Tinh gia, tao/huy chuyen, tai xe nhan chuyen, state machine, payment tien mat va rating.
- Duyet tai xe, quan ly user/chuyen, bang gia, khuyen mai, payment va dashboard doanh thu.
- Realtime request/status/location qua Socket.IO voi room duoc phan quyen.
- Frontend responsive desktop/mobile; khong con demo data fallback.
- Kiem thu REST + MySQL + Socket.IO va Playwright cho ba portal.

## Chay nhanh tren Windows

Yeu cau Node.js va MySQL 8 da cai tai vi tri mac dinh.

```powershell
cd backend
npm install
powershell -ExecutionPolicy Bypass -File scripts/local-mysql.ps1
node scripts/bootstrap-local.cjs
npm run prisma:generate
npm run prisma:deploy
npm run db:seed
npm run dev
```

Mo terminal thu hai:

```powershell
cd frontend
npm install
npm run dev -- --host 127.0.0.1
```

- Web: `http://127.0.0.1:5173`
- API: `http://localhost:4000/api`
- Readiness: `http://localhost:4000/ready`
- Admin local: `0900000000` / `Admin@123456`

MySQL rieng cua project chay tai `127.0.0.1:3307`, data nam trong `.local/mysql` va khong anh huong service MySQL tai `3306`.

## Kiem tra

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

## Tai lieu

1. [Phan tich yeu cau](docs/01_PHAN_TICH_YEU_CAU.md)
2. [Actor va Use Case](docs/02_ACTOR_USE_CASE.md)
3. [User Flow](docs/03_USER_FLOW.md)
4. [Wireframe / UI UX](docs/04_WIREFRAME_UI_UX.md)
5. [Database Design](docs/05_DATABASE_DESIGN.md)
6. [API / Backend Design](docs/06_API_BACKEND_DESIGN.md)
7. [UI Design Contract](docs/07_UI_DESIGN_SPEC.md)
8. [Local Runbook](docs/08_LOCAL_RUNBOOK.md)

## Gioi han hien tai

- Payment that moi ho tro `CASH`; CARD/WALLET bi tu choi den khi co provider.
- Quang duong va thoi gian dang uoc tinh theo toa do, chua co routing/traffic provider.
- OTP SMS, push notification, object storage va Redis la cac tich hop production tiep theo.
- OpenStreetMap public tile can Internet; khi tile loi, toa do va nghiep vu van hoat dong.
