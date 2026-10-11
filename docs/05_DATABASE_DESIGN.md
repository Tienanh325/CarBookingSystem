# Buoc 05: Thiet ke Database

## 1. Dinh huong cong nghe

De phu hop do an va de trien khai chac chan, co the dung:

- MySQL 8.4 LTS: du lieu chinh, giao dich, quan he.
- Redis (phase production): cache, OTP, presence va hang doi tam. Ban hien tai chua bat buoc Redis.
- Object Storage (phase production): luu anh dai dien, giay to tai xe, hoa don.
- Elasticsearch/OpenSearch, neu can: tim kiem va log nang cao.

## 2. Danh sach bang chinh

| Bang | Muc dich |
| --- | --- |
| users | Tai khoan chung cua customer, driver, admin |
| roles | Vai tro he thong |
| user_roles | Gan vai tro cho user |
| customer_profiles | Ho so khach hang |
| driver_profiles | Ho so tai xe |
| vehicles | Xe cua tai xe |
| vehicle_types | Loai xe va cau hinh co ban |
| driver_documents | Giay to xac minh tai xe |
| addresses | Dia chi da luu cua customer |
| rides | Chuyen di |
| ride_status_logs | Lich su trang thai chuyen |
| driver_locations | Vi tri gan nhat cua tai xe |
| pricing_rules | Cau hinh gia cuoc |
| promotions | Ma khuyen mai |
| promotion_usages | Lich su dung ma |
| payments | Giao dich thanh toan |
| driver_wallets | Vi/so du tai xe |
| wallet_transactions | Bien dong so du |
| customer_wallets | So du vi khach hang |
| customer_wallet_transactions | So cai vi khach hang |
| wallet_top_ups | Lenh nap tien VietQR |
| withdrawal_requests | Yeu cau rut tien tai xe |
| refund_requests | Yeu cau hoan tien can admin phe duyet |
| payment_webhook_events | Giao dich provider, chong trung va ket qua phan loai doi soat |
| reconciliation_runs | Lich su job doi soat dinh ky/thu cong |
| surcharge_rules | Cau hinh phu phi linh hoat |
| pricing_contexts | Trang thai thoi tiet tinh gia |
| ride_location_points | Mau GPS trong chuyen |
| invoices | Hoa don cuoc xe |
| ratings | Danh gia chuyen di |
| support_tickets | Khieu nai/ho tro |
| notifications | Thong bao |
| audit_logs | Lich su thao tac admin/he thong |
| auth_sessions | Phien refresh token da bam va ngay het han |
| ride_rejections | Chuyen ma mot tai xe da tu choi |

## 3. Thiet ke bang cot loi

### 3.1 users

| Cot | Kieu | Ghi chu |
| --- | --- | --- |
| id | CHAR(36) PK (UUID) | Ma user |
| phone | VARCHAR UNIQUE | So dien thoai |
| email | VARCHAR NULL | Email |
| password_hash | VARCHAR NULL | Neu dung password |
| full_name | VARCHAR | Ho ten |
| avatar_url | TEXT NULL | Anh dai dien |
| status | ENUM | ACTIVE, LOCKED, DELETED |
| last_login_at | TIMESTAMP NULL | Lan dang nhap cuoi |
| created_at | TIMESTAMP | Ngay tao |
| updated_at | TIMESTAMP | Ngay cap nhat |

### 3.2 driver_profiles

| Cot | Kieu | Ghi chu |
| --- | --- | --- |
| id | CHAR(36) PK (UUID) | Ma ho so |
| user_id | CHAR(36) FK users.id | Tai khoan tai xe |
| license_number | VARCHAR | So GPLX |
| identity_number | VARCHAR | CCCD/CMND |
| verification_status | ENUM | PENDING, APPROVED, REJECTED, SUSPENDED |
| online_status | ENUM | ONLINE, OFFLINE, BUSY |
| rating_avg | DECIMAL | Diem trung binh |
| total_rides | INT | Tong chuyen |
| approved_at | TIMESTAMP NULL | Ngay duyet |
| created_at | TIMESTAMP | Ngay tao |

### 3.3 vehicles

| Cot | Kieu | Ghi chu |
| --- | --- | --- |
| id | CHAR(36) PK (UUID) | Ma xe |
| driver_id | CHAR(36) FK driver_profiles.id | Chu xe |
| vehicle_type_id | CHAR(36) FK vehicle_types.id | Loai xe |
| plate_number | VARCHAR UNIQUE | Bien so |
| brand | VARCHAR | Hang xe |
| model | VARCHAR | Mau xe |
| color | VARCHAR | Mau xe |
| registration_status | ENUM | PENDING, APPROVED, REJECTED |
| is_active | BOOLEAN | Xe dang su dung |

### 3.4 rides

| Cot | Kieu | Ghi chu |
| --- | --- | --- |
| id | CHAR(36) PK (UUID) | Ma chuyen |
| customer_id | CHAR(36) FK users.id | Khach hang |
| driver_id | CHAR(36) FK driver_profiles.id NULL | Tai xe nhan chuyen |
| vehicle_type_id | CHAR(36) FK vehicle_types.id | Loai xe dat |
| pickup_address | TEXT | Dia chi don |
| pickup_lat | DECIMAL | Vi do don |
| pickup_lng | DECIMAL | Kinh do don |
| dropoff_address | TEXT | Dia chi den |
| dropoff_lat | DECIMAL | Vi do den |
| dropoff_lng | DECIMAL | Kinh do den |
| estimated_distance_km | DECIMAL | Quang duong uoc tinh |
| estimated_duration_min | INT | Thoi gian uoc tinh |
| estimated_fare | DECIMAL | Gia uoc tinh |
| final_fare | DECIMAL NULL | Gia cuoi cung |
| actual_distance_km | DECIMAL NULL | Quang duong sau loc GPS |
| actual_duration_min | INT NULL | Thoi gian tu START den COMPLETE |
| waiting_minutes | INT | Thoi gian tai xe cho tai diem don |
| waiting_fee | DECIMAL | Phi cho sau grace period |
| cancellation_fee | DECIMAL | Phi huy theo trang thai |
| pricing_snapshot | JSON | Cong thuc gia tai luc dat xe |
| fare_breakdown | JSON | Chi tiet gia cuoi cung |
| promotion_id | UUID NULL | Ma khuyen mai |
| payment_method | ENUM | CASH, CARD, WALLET, VIETQR |
| status | ENUM | Trang thai chuyen |
| requested_at | TIMESTAMP | Tao yeu cau |
| accepted_at | TIMESTAMP NULL | Tai xe nhan |
| started_at | TIMESTAMP NULL | Bat dau |
| completed_at | TIMESTAMP NULL | Hoan thanh |
| cancelled_at | TIMESTAMP NULL | Huy |
| cancel_reason | TEXT NULL | Ly do huy |

### 3.5 payments

| Cot | Kieu | Ghi chu |
| --- | --- | --- |
| id | CHAR(36) PK (UUID) | Ma giao dich |
| ride_id | CHAR(36) FK rides.id | Chuyen di |
| customer_id | CHAR(36) FK users.id | Nguoi tra |
| amount | DECIMAL | So tien |
| method | ENUM | CASH, CARD, WALLET, VIETQR |
| provider | VARCHAR NULL | Cong thanh toan |
| provider_transaction_id | VARCHAR NULL | Ma giao dich ngoai |
| payment_reference | VARCHAR UNIQUE NULL | Reference VietQR |
| expires_at | TIMESTAMP NULL | Han thanh toan online |
| status | ENUM | PENDING, AUTHORIZED, PARTIALLY_PAID, PAID, FAILED, VOIDED, REFUND_PENDING, REFUNDED |
| authorized_amount | DECIMAL | So tien vi dang giu |
| captured_amount | DECIMAL | So tien da ghi nhan thanh toan |
| refunded_amount | DECIMAL | Tong tien da hoan |
| paid_at | TIMESTAMP NULL | Thoi diem thanh toan |
| created_at | TIMESTAMP | Ngay tao |

### 3.6 Wallet ledger

Ca `customer_wallets` va `driver_wallets` deu co bon bucket:

| Cot | Y nghia |
| --- | --- |
| available_balance | So du co the chi tieu/rut ngay |
| held_balance | So du dang khoa cho cuoc xe hoac lenh rut |
| pending_settlement | Khoan da phat sinh nhung dang cho ket chuyen |
| platform_receivable | Khoan chu vi con no nen tang |

Moi thay doi so du phai co mot dong ledger trong `customer_wallet_transactions` hoac
`wallet_transactions`. Moi dong luu `amount`, `type`, `status` va bon cot delta tuong ung:
`available_delta`, `held_delta`, `pending_settlement_delta`, `platform_receivable_delta`.
Tong cac delta cho phep truy vet viec tien di chuyen giua cac bucket, thay vi chi luu so du cuoi.

Quy tac chinh:

- Dat xe bang WALLET: `available -> held` va payment chuyen `AUTHORIZED`.
- Hoan thanh: capture tu `held`; phan giu duoc release ve `available`; thieu tien tao `platform_receivable`.
- Thu nhap tai xe khong tien mat: vao `pending_settlement`, job doi soat moi release sang `available`.
- Tao lenh rut: `available -> held`; duyet thi consume `held`, tu choi thi release.
- Nap tien uu tien tat toan `platform_receivable`, phan con lai moi vao `available`.

### 3.7 Refund va doi soat

`refund_requests` lien ket voi payment, ride va customer; luu so tien, ly do, nguoi yeu cau,
nguoi duyet, trang thai va ly do tu choi. Khi tao request, khoan hoan nam trong
`pending_settlement`; chi khi admin duyet moi ghi co `available_balance`.

`payment_webhook_events` luu moi giao dich provider hop le ve chu ky, ke ca giao dich khong
tim thay reference. Cac cot quan trong gom expected amount, paid/expiry time, source
(`WEBHOOK`/`PROVIDER_POLL`), target va hai lop trang thai:

- Classification: `EXACT`, `UNDERPAID`, `OVERPAID`, `REFERENCE_NOT_FOUND`, `DUPLICATE`, `EXPIRED`.
- Reconciliation status: `MATCHED`, `REVIEW_REQUIRED`, `RESOLVED`, `IGNORED`.

`reconciliation_runs` luu cua so doi soat, so giao dich provider, so exact/exception/duplicate,
trang thai `RUNNING|COMPLETED|FAILED` va loi neu co.

## 4. Quan he du lieu

```text
users 1--1 customer_profiles
users 1--1 driver_profiles
users N--N roles qua user_roles
driver_profiles 1--N vehicles
vehicle_types 1--N vehicles
vehicle_types 1--N rides
users(customer) 1--N rides
driver_profiles 1--N rides
rides 1--N ride_status_logs
rides 1--1 payments
payments 1--N refund_requests
rides 1--1 ratings
promotions 1--N promotion_usages
driver_profiles 1--1 driver_wallets
driver_wallets 1--N wallet_transactions
users 1--1 customer_wallets
customer_wallets 1--N customer_wallet_transactions
wallet_top_ups 1--N customer_wallet_transactions
rides 1--N ride_location_points
rides 1--1 invoices
users 1--N auth_sessions
rides N--N driver_profiles qua ride_rejections
```

## 5. Index de toi uu

- `users(phone)` unique index.
- `rides(customer_id, requested_at)`.
- `rides(driver_id, requested_at)`.
- `rides(status, requested_at)`.
- `driver_profiles(online_status, verification_status)`.
- `driver_locations(driver_id)`.
- `driver_locations(lat, lng)`; co the nang cap sang cot `POINT` va Spatial Index cua MySQL khi can truy van ban kinh lon.
- `payments(status, created_at)`.
- `payments(payment_reference)` unique index.
- `payment_webhook_events(provider_transaction_id)` unique index de bao dam idempotency.
- `payment_webhook_events(classification, reconciliation_status, created_at)`.
- `refund_requests(status, created_at)` va `refund_requests(payment_id, status)`.
- `reconciliation_runs(provider, started_at)`.
- Ledger: `(wallet_id, created_at)` cho ca vi khach va vi tai xe.
- `promotions(code)` unique index.
- `auth_sessions(userId)`.
- `ride_rejections(rideId, driverId)` composite primary key.

## 6. Trang thai quan trong

### Ride status

```text
REQUESTED
SEARCHING_DRIVER
ACCEPTED
DRIVER_ARRIVING
ARRIVED
IN_PROGRESS
COMPLETED
CANCELLED_BY_CUSTOMER
CANCELLED_BY_DRIVER
CANCELLED_BY_SYSTEM
NO_DRIVER_FOUND
```

### Payment status

```text
PENDING
AUTHORIZED
PARTIALLY_PAID
PAID
FAILED
VOIDED
REFUND_PENDING
REFUNDED
```

### Financial invariants

```text
available_balance >= 0
held_balance >= 0
pending_settlement >= 0
platform_receivable >= 0
captured_amount >= refunded_amount
provider_transaction_id chi duoc ingest mot lan
```

Moi thao tac tai chinh (hold/capture/release, top-up, settlement, withdrawal, refund,
doi soat va export bao cao) dong thoi ghi `audit_logs` trong cung database transaction.

### Driver verification status

```text
PENDING
APPROVED
REJECTED
SUSPENDED
```

## 7. Dau ra cua buoc 05

- Danh sach bang database cot loi.
- Cot quan trong cho cac bang nghiep vu chinh.
- Quan he giua cac bang.
- Index va enum can thiet cho backend.
