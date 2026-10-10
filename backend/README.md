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

## Ban do, lich hen va dieu phoi

- Routing mac dinh dung OSRM va luu GeoJSON polyline, quang duong bo, ETA vao chuyen xe.
- Neu khai bao `MAPBOX_ACCESS_TOKEN`, backend tu dong dung profile `mapbox/driving-traffic` de ETA co du lieu giao thong hien tai va lich su.
- Tim dia chi dung Photon/OSM qua backend proxy co debounce o frontend, gioi han 1 request/giay va cache 10 phut. Co the thay bang private Photon qua `GEOCODING_BASE_URL`.
- Moi chuyen ho tro toi da 2 diem dung; phi dung tinh theo `waitingFeePerMinute` va 5 phut moi diem.
- Lich hen bat dau dieu phoi truoc 30 phut. Worker luu trang thai trong MySQL nen khoi dong lai khong mat countdown.
- Dieu phoi chi gui loi moi cho mot tai xe gan nhat, mo ban kinh 1 km, 3 km, 5 km theo tung moc 30 giay. Moi loi moi mac dinh co 20 giay de phan hoi.

Bien moi trong `.env`:

```text
ROUTING_BASE_URL=https://router.project-osrm.org
MAPBOX_ACCESS_TOKEN=
GEOCODING_BASE_URL=https://photon.komoot.io
MATCHING_OFFER_SECONDS=20
SCHEDULE_MATCH_LEAD_MINUTES=30
MATCHING_MAX_WAIT_SECONDS=180
```

Public Photon va OSRM phu hop development/demo. Production nen dung instance rieng hoac nha cung cap co SLA.

## Thanh toan, vi va phu phi

He thong ho tro `CASH`, `WALLET` va `VIETQR` (gia tri `CARD` duoc giu trong schema de tuong thich nhung chua mo).

- `POST /api/customers/me/wallet/top-ups`: tao lenh nap vi va tra ve URL anh VietQR.
- `GET /api/customers/me/wallet`: so du, lich su giao dich va lenh nap dang cho.
- `POST /api/rides` voi `paymentMethod=WALLET`: tru vi trong cung transaction tao chuyen.
- `POST /api/rides` voi `paymentMethod=VIETQR`: tao payment `PENDING` va tra `payment.vietQr`.
- `GET /api/payments/rides/:id`: xem trang thai payment va thong tin QR.
- `POST /api/payments/vietqr/ipn`: IPN cong khai, xac thuc HMAC va chong xu ly trung theo transaction ID.
- `GET /api/drivers/me/wallet`: bang ke gross fare, hoa hong, tien mat tai xe da thu va so du kha dung.
- `POST /api/drivers/me/withdrawals`: tao yeu cau va giu so du trong `pendingBalance`.
- `GET /api/admin/withdrawals`, `POST /api/admin/withdrawals/:id/approve|reject`: quy trinh duyet rut tien. Chi approve moi tru `balance`.

Chu ky IPN la HMAC-SHA256 (hex) cua chuoi:

```text
transactionId|reference|amount|paidAt
```

voi `VIETQR_WEBHOOK_SECRET`. Vi du body:

```json
{
  "transactionId": "BANK-20261011-001",
  "reference": "RIDE...",
  "amount": 85000,
  "paidAt": "2026-10-11T10:30:00.000Z",
  "signature": "<64 hex chars>"
}
```

IPN cap nhat `payment.status=PAID`; `ride.status` van la trang thai van hanh cua cuoc xe. Giao dich vi khach duoc hoan tu dong neu khach/tai xe/admin huy hoac khong tim thay tai xe. Chuyen VietQR da thanh toan khi bi huy duoc hoan vao GoRide Wallet (khong chuyen nguoc ve ngan hang trong phase nay).

Phu phi duoc snapshot vao chuyen (`surchargeAmount`, `surchargeBreakdown`) khi bao gia:

- Seed mac dinh: cao diem sang/chieu ngay thuong, dem 22:00-05:00, mua va ngap.
- `GET|POST|PATCH /api/admin/surcharges`: quan ly rule theo loai xe, khung gio, thu trong tuan va thoi tiet.
- `GET|PATCH /api/admin/surcharges/context/weather`: cap nhat trang thai `NORMAL|RAIN|HEAVY_RAIN|FLOOD` de engine gia tu dong ap dung.
- Mui gio tinh phu phi la `Asia/Ho_Chi_Minh`; lich hen dung thoi diem du kien don khach.

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
