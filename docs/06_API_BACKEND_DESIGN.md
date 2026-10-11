# Buoc 06: Thiet ke API / Backend

## 1. Dinh huong kien truc backend

Giai doan do an nen bat dau bang modular monolith de de phat trien, test va deploy. Ben trong backend chia module ro rang, sau nay co the tach thanh microservice neu luu luong lon.

Module de xuat:

- Auth Module.
- User Module.
- Driver Module.
- Vehicle Module.
- Ride/Booking Module.
- Matching Module.
- Pricing Module.
- Payment Module.
- Wallet/Ledger Module.
- Reconciliation Worker.
- Promotion Module.
- Notification Module.
- Support Module.
- Admin Module.
- Report Module.

## 2. Cong nghe de xuat

| Thanh phan | Lua chon de xuat |
| --- | --- |
| Backend framework | Express 5 + TypeScript (da trien khai) |
| Database | MySQL 8.4 LTS |
| Cache/Queue | Redis du kien; ban hien tai chua bat buoc |
| Realtime | WebSocket/Socket.IO |
| Auth | JWT + Refresh Token |
| Map | Leaflet + OpenStreetMap; routing provider la phase sau |
| Payment | CASH, GoRide Wallet, VietQR/IPN HMAC |
| Storage | S3-compatible/Object Storage |
| Logging | Winston/Pino, ELK/OpenSearch tuy quy mo |

## 3. Nhom API chinh

### 3.1 Auth API

| Method | Endpoint | Mo ta | Auth |
| --- | --- | --- | --- |
| POST | `/api/auth/register` | Dang ky tai khoan | No |
| POST | `/api/auth/login` | Dang nhap | No |
| POST | `/api/auth/send-otp` | Gui OTP | No |
| POST | `/api/auth/verify-otp` | Xac thuc OTP | No |
| POST | `/api/auth/refresh-token` | Cap token moi | Refresh |
| POST | `/api/auth/logout` | Dang xuat | Yes |

### 3.2 Customer API

| Method | Endpoint | Mo ta |
| --- | --- | --- |
| GET | `/api/customers/me` | Lay thong tin ca nhan |
| PATCH | `/api/customers/me` | Cap nhat ho so |
| GET | `/api/customers/me/addresses` | Danh sach dia chi da luu |
| POST | `/api/customers/me/addresses` | Them dia chi |
| DELETE | `/api/customers/me/addresses/{id}` | Xoa dia chi |

### 3.3 Ride API

| Method | Endpoint | Mo ta |
| --- | --- | --- |
| POST | `/api/rides/estimate` | Uoc tinh gia va thoi gian |
| POST | `/api/rides` | Tao yeu cau dat xe |
| GET | `/api/rides/current?as=customer|driver` | Lay chuyen dang hoat dong theo vai tro |
| GET | `/api/rides/{id}` | Chi tiet chuyen |
| GET | `/api/rides?as=customer|driver` | Lich su chuyen theo vai tro |
| POST | `/api/rides/{id}/cancel` | Huy chuyen |
| POST | `/api/rides/{id}/rating` | Danh gia chuyen |
| GET | `/api/rides/{id}/invoice` | Hoa don chuyen hoan thanh |

Vi du request tao chuyen:

```json
{
  "pickup": {
    "address": "12 Nguyen Trai, Quan 1, TP.HCM",
    "lat": 10.7712,
    "lng": 106.6891
  },
  "dropoff": {
    "address": "99 Le Loi, Quan 1, TP.HCM",
    "lat": 10.7751,
    "lng": 106.7002
  },
  "vehicleTypeId": "uuid",
  "paymentMethod": "CASH",
  "promotionCode": "WELCOME"
}
```

### 3.4 Driver API

| Method | Endpoint | Mo ta |
| --- | --- | --- |
| POST | `/api/drivers/register` | Dang ky lam tai xe |
| GET | `/api/drivers/me` | Ho so tai xe |
| PATCH | `/api/drivers/me` | Cap nhat ho so |
| POST | `/api/drivers/me/online` | Bat online |
| POST | `/api/drivers/me/offline` | Tat online |
| POST | `/api/drivers/me/location` | Cap nhat vi tri |
| GET | `/api/drivers/me/ride-requests` | Lay yeu cau chuyen moi |
| POST | `/api/drivers/rides/{id}/accept` | Chap nhan chuyen |
| POST | `/api/drivers/rides/{id}/reject` | Tu choi chuyen |
| POST | `/api/drivers/rides/{id}/arrived` | Bao da den diem don |
| POST | `/api/drivers/rides/{id}/heading` | Dang di den diem don |
| POST | `/api/drivers/rides/{id}/start` | Xac minh PIN va bat dau chuyen |
| POST | `/api/drivers/rides/{id}/complete` | Hoan thanh chuyen |
| POST | `/api/drivers/rides/{id}/cancel` | Tai xe huy chuyen |
| GET | `/api/drivers/me/earnings` | Xem thu nhap |
| GET | `/api/drivers/me/wallet` | Bang ke vi tai xe |
| POST | `/api/drivers/me/withdrawals` | Tao yeu cau rut tien |

### 3.5 Wallet/Payment API

| Method | Endpoint | Mo ta | Auth |
| --- | --- | --- | --- |
| GET | `/api/customers/me/wallet` | Bon bucket so du va ledger vi khach | Customer |
| POST | `/api/customers/me/wallet/top-ups` | Tao lenh nap tien/QR VietQR | Customer |
| GET | `/api/payments/rides/{id}` | Payment, reference va refund cua chuyen | Customer/Admin |
| POST | `/api/payments/rides/{id}/refunds` | Tao yeu cau hoan tien | Customer |
| POST | `/api/payments/vietqr/ipn` | Nhan giao dich, verify HMAC va phan loai | HMAC |

Thanh toan WALLET dung authorize/capture: khi dat xe he thong chuyen tien
`available -> held`; khi hoan thanh moi capture gia thuc te. Tien giu duoc release khi gia
thuc te thap hon hoac chuyen bi huy. Refund khong ghi co truc tiep ma tao request cho admin.

### 3.6 Admin API

| Method | Endpoint | Mo ta |
| --- | --- | --- |
| GET | `/api/admin/dashboard` | So lieu tong quan |
| GET | `/api/admin/users` | Danh sach nguoi dung |
| PATCH | `/api/admin/users/{id}/status` | Khoa/mo tai khoan |
| GET | `/api/admin/drivers` | Danh sach tai xe |
| GET | `/api/admin/drivers/{id}` | Chi tiet tai xe |
| POST | `/api/admin/drivers/{id}/approve` | Duyet tai xe |
| POST | `/api/admin/drivers/{id}/reject` | Tu choi ho so |
| GET | `/api/admin/rides` | Danh sach chuyen |
| GET | `/api/admin/rides/{id}` | Chi tiet chuyen |
| POST | `/api/admin/rides/{id}/cancel` | Admin huy chuyen |
| GET | `/api/admin/payments` | Danh sach thanh toan |
| GET | `/api/admin/reports/revenue` | Bao cao doanh thu |
| GET | `/api/admin/reports/finance.csv?period=day|month&date=...` | CSV doanh thu, hoa hong, cash, top-up, refund, withdrawal |
| GET | `/api/admin/withdrawals` | Danh sach yeu cau rut |
| POST | `/api/admin/withdrawals/{id}/approve` | Duyet rut tien |
| POST | `/api/admin/withdrawals/{id}/reject` | Tu choi rut tien |
| GET | `/api/admin/refunds` | Danh sach yeu cau hoan tien |
| POST | `/api/admin/refunds/{id}/approve` | Duyet va ghi co vi khach |
| POST | `/api/admin/refunds/{id}/reject` | Tu choi hoan tien |
| POST | `/api/admin/reconciliation/run` | Chay job doi soat ngay |
| GET | `/api/admin/reconciliation/runs` | Lich su job doi soat |
| GET | `/api/admin/reconciliation/items` | Giao dich/ngoai le theo phan loai |
| POST | `/api/admin/reconciliation/items/{id}/resolve` | ACCEPT hoac IGNORE ngoai le |

### 3.7 Doi soat provider

Worker chay khi server khoi dong va lap lai theo `RECONCILIATION_INTERVAL_MINUTES`.
No doc giao dich trong `RECONCILIATION_LOOKBACK_HOURS`, ingest qua cung mot ham voi IPN,
danh dau payment/top-up PENDING da het han va settlement thu nhap tai xe.

Provider adapter duoc cau hinh qua:

```env
VIETQR_RECONCILIATION_URL=https://provider.example/transactions
VIETQR_RECONCILIATION_TOKEN=secret-bearer-token
RECONCILIATION_INTERVAL_MINUTES=15
RECONCILIATION_LOOKBACK_HOURS=48
```

Backend goi `GET VIETQR_RECONCILIATION_URL?from=<ISO>&to=<ISO>` voi Bearer token neu co.
Response chap nhan mot array hoac `{ "transactions": [...] }`; moi item gom
`transactionId`, `reference`, `amount`, `paidAt`. Neu chua cau hinh URL, job van expire
lenh cu va settlement ledger noi bo, nhung khong fetch provider.

Phan loai: `EXACT`, `UNDERPAID`, `OVERPAID`, `REFERENCE_NOT_FOUND`, `DUPLICATE`,
`EXPIRED`. Chi `EXACT` tu dong ghi nhan. Cac ngoai le vao `REVIEW_REQUIRED`; admin co the
ACCEPT sai lech co target hoac IGNORE. Missing reference va duplicate chi duoc IGNORE.

### 3.8 Pricing/Promotion API

| Method | Endpoint | Mo ta |
| --- | --- | --- |
| GET | `/api/admin/pricing-rules` | Danh sach cau hinh gia |
| POST | `/api/admin/pricing-rules` | Tao cau hinh gia |
| PATCH | `/api/admin/pricing-rules/{id}` | Cap nhat cau hinh gia |
| GET | `/api/admin/promotions` | Danh sach khuyen mai |
| POST | `/api/admin/promotions` | Tao khuyen mai |
| PATCH | `/api/admin/promotions/{id}` | Cap nhat khuyen mai |
| POST | `/api/promotions/validate` | Kiem tra ma khuyen mai |
| GET/POST/PATCH | `/api/admin/surcharges` | Quan ly phu phi |
| PATCH | `/api/admin/surcharges/context/weather` | Cap nhat thoi tiet |

OpenAPI 3.1 duoc phuc vu tai `/openapi.json`; Swagger UI tai `/api-docs`.

## 4. WebSocket/Reatime events

| Event | Tu | Den | Mo ta |
| --- | --- | --- | --- |
| `driver.location.updated` | Driver | Customer/Admin | Tai xe cap nhat vi tri |
| `ride.request.created` | Backend | Driver | Gui chuyen moi |
| `ride.accepted` | Backend | Customer | Tai xe da nhan |
| `ride.status.changed` | Backend | Customer/Driver/Admin | Trang thai chuyen thay doi |
| `ride.cancelled` | Backend | Customer/Driver | Chuyen bi huy |
| `ride.driver-reassigned` | Backend | Customer/Driver | Tai xe huy, he thong matching lai |
| `payment.updated` | Backend | Customer | IPN cap nhat thanh toan |
| `wallet.updated` | Backend | Customer | So du vi thay doi |
| `data.changed` | Backend | Admin | Vo hieu hoa cache man hinh van hanh |

## 5. Logic matching tai xe

Quy trinh de xuat:

1. Lay danh sach tai xe `ONLINE`, `APPROVED`, khong co chuyen dang hoat dong.
2. Loc theo loai xe phu hop.
3. Gui tin hieu co chuyen moi vao room rieng cua cac tai xe phu hop; tai xe tu tai danh sach qua API.
4. Tai xe dau tien claim thanh cong se nhan chuyen bang conditional update trong transaction.
5. Cac tai xe khac nhan invalidation va chuyen bien mat khoi danh sach.

Tinh ban kinh, xep hang theo ETA/rating va chia vong matching la phase nang cap khi co routing provider va Redis/queue.

## 6. Bao mat backend

- Su dung JWT access token ngan han va refresh session dai han; database chi luu SHA-256 hash cua refresh token.
- Phan quyen theo Role-Based Access Control.
- Validate tat ca request body.
- Rate limit API dang nhap, OTP, dat xe.
- Log moi thao tac tai chinh va thao tac admin vao `audit_logs`; ghi log trong cung transaction nghiep vu.
- Khong tra ve thong tin nhay cam nhu password hash, token, giay to ca nhan khong can thiet.
- Webhook thanh toan phai xac minh chu ky.
- API tai xe chi duoc thao tac tren chuyen duoc gan cho chinh tai xe do.
- Logout xoa session va ngat ngay cac Socket.IO client thuoc session do.
- OTP va CARD tra loi chua cau hinh thay vi gia lap thanh cong.

## 7. Xu ly loi API chuan

Dang response loi:

```json
{
  "success": false,
  "error": {
    "code": "RIDE_NOT_FOUND",
    "message": "Khong tim thay chuyen di",
    "details": {}
  }
}
```

Ma loi goi y:

- `AUTH_INVALID_TOKEN`
- `AUTH_PERMISSION_DENIED`
- `RIDE_NOT_FOUND`
- `RIDE_INVALID_STATUS`
- `DRIVER_NOT_AVAILABLE`
- `NO_DRIVER_FOUND`
- `PAYMENT_FAILED`
- `PROMOTION_INVALID`
- `VALIDATION_ERROR`

## 8. Dau ra cua buoc 06

- Xac dinh module backend.
- Danh sach API chinh cho customer, driver va admin.
- Dinh nghia realtime event.
- Logic matching tai xe.
- Quy tac bao mat va chuan response loi.
