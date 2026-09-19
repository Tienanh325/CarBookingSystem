# Buoc 02: Xac dinh Actor va Use Case

## 1. Actor chinh

| Actor | Vai tro | Quyen han tong quat |
| --- | --- | --- |
| Guest | Nguoi chua dang nhap | Xem gioi thieu, dang ky, dang nhap |
| Customer | Khach hang | Dat xe, thanh toan, danh gia, quan ly tai khoan |
| Driver | Tai xe | Nhan chuyen, cap nhat trang thai, xem thu nhap |
| Admin | Quan tri vien | Quan ly toan bo du lieu va cau hinh he thong |
| Operator | Dieu phoi | Theo doi/chinh sua chuyen trong pham vi van hanh |
| Support | CSKH | Xu ly khieu nai, ho tro khach/tai xe |
| Accountant | Ke toan | Xem giao dich, doi soat, thanh toan tai xe |
| Payment Gateway | Cong thanh toan | Xu ly thanh toan online va webhook |
| Map Service | Dich vu ban do | Tim dia chi, tinh khoang cach, dieu huong |
| Notification Service | Dich vu thong bao | Gui push notification, SMS, email |

## 2. Use Case cho Customer

| Ma | Use Case | Tac nhan phu | Ket qua |
| --- | --- | --- | --- |
| UC-C01 | Dang ky/dang nhap | SMS/OTP Service | Customer vao duoc he thong |
| UC-C02 | Tim dia diem | Map Service | Co toa do diem don/diem den |
| UC-C03 | Uoc tinh gia | Pricing Service | Hien thi gia tam tinh |
| UC-C04 | Tao yeu cau dat xe | Matching Service | He thong tim tai xe phu hop |
| UC-C05 | Theo doi tai xe | Realtime Service | Customer biet vi tri va trang thai |
| UC-C06 | Huy chuyen | Backend | Chuyen chuyen sang trang thai huy |
| UC-C07 | Thanh toan chuyen di | Payment Gateway | Giao dich thanh cong/that bai |
| UC-C08 | Danh gia chuyen di | Backend | Luu diem danh gia |
| UC-C09 | Gui khieu nai | Support/Admin | Tao ticket ho tro |

## 3. Use Case cho Driver

| Ma | Use Case | Tac nhan phu | Ket qua |
| --- | --- | --- | --- |
| UC-D01 | Dang ky lam tai xe | Admin | Ho so cho duyet |
| UC-D02 | Cap nhat trang thai online | Backend | Tai xe san sang nhan chuyen |
| UC-D03 | Nhan de xuat chuyen | Matching Service | Tai xe thay thong tin chuyen |
| UC-D04 | Chap nhan/tu choi chuyen | Backend | Chuyen duoc gan hoac tim tai xe khac |
| UC-D05 | Cap nhat vi tri | Realtime Service | Khach/admin thay vi tri moi |
| UC-D06 | Cap nhat trang thai chuyen | Backend | Chuyen di qua cac moc nghiep vu |
| UC-D07 | Hoan thanh chuyen | Payment/Pricing | Tinh tien va ghi nhan doanh thu |
| UC-D08 | Xem thu nhap | Backend | Tai xe xem so lieu thu nhap |
| UC-D09 | Yeu cau ho tro | Support | Tao ticket ho tro |

## 4. Use Case cho Admin/Operator/Support

| Ma | Use Case | Actor | Ket qua |
| --- | --- | --- | --- |
| UC-A01 | Dang nhap admin | Admin/Operator/Support | Truy cap dashboard theo vai tro |
| UC-A02 | Quan ly customer | Admin/Support | Xem, khoa/mo, ho tro tai khoan |
| UC-A03 | Duyet ho so tai xe | Admin | Tai xe duoc phe duyet/tu choi |
| UC-A04 | Quan ly xe va loai xe | Admin | Cap nhat du lieu xe |
| UC-A05 | Giam sat chuyen di | Admin/Operator | Theo doi chuyen dang dien ra |
| UC-A06 | Can thiep chuyen di | Operator | Huy, gan lai tai xe, ghi chu su co |
| UC-A07 | Quan ly gia cuoc | Admin | Cap nhat cau hinh tinh gia |
| UC-A08 | Quan ly khuyen mai | Admin/Marketing | Tao va theo doi ma giam gia |
| UC-A09 | Xu ly khieu nai | Support | Ticket co trang thai xu ly |
| UC-A10 | Doi soat thanh toan | Accountant/Admin | Xac nhan doanh thu, cong no |
| UC-A11 | Xem bao cao | Admin/Accountant | Co so lieu kinh doanh |

## 5. Ma tran phan quyen

| Chuc nang | Customer | Driver | Support | Operator | Accountant | Admin |
| --- | --- | --- | --- | --- | --- | --- |
| Dat xe | Co | Khong | Khong | Khong | Khong | Khong |
| Nhan chuyen | Khong | Co | Khong | Khong | Khong | Khong |
| Xem chuyen cua minh | Co | Co | Co | Co | Co | Co |
| Xem tat ca chuyen | Khong | Khong | Co | Co | Co | Co |
| Can thiep chuyen | Khong | Khong | Han che | Co | Khong | Co |
| Quan ly gia cuoc | Khong | Khong | Khong | Khong | Khong | Co |
| Duyet tai xe | Khong | Khong | Khong | Khong | Khong | Co |
| Doi soat | Khong | Xem ca nhan | Khong | Khong | Co | Co |
| Quan ly phan quyen | Khong | Khong | Khong | Khong | Khong | Co |

## 6. Dau ra cua buoc 02

- Xac dinh day du actor noi bo va ben ngoai.
- Xac dinh use case chinh cho customer, driver va admin.
- Co ma tran phan quyen lam dau vao cho thiet ke backend va admin web.

