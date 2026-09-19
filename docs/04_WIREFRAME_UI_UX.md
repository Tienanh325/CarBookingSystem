# Buoc 04: Thiet ke Wireframe / UI UX

## 1. Nguyen tac UI/UX

- Dat xe phai nhanh: nguoi dung nhap diem don/diem den trong it buoc nhat co the.
- Gia cuoc va trang thai phai minh bach.
- Ban do la thanh phan trung tam cua trai nghiem dat xe.
- Nut hanh dong chinh phai ro rang: Dat xe, Huy, Goi tai xe, Thanh toan, Danh gia.
- Admin web uu tien bang du lieu, bo loc, thao tac nhanh va bao cao.
- Giao dien tai xe uu tien thao tac mot tay, nut lon, thong tin gon.

## 2. Man hinh Customer Web/App

### 2.1 Dang nhap / Dang ky

Thanh phan:

- Logo/ten ung dung.
- O nhap so dien thoai.
- Nut gui OTP.
- O nhap OTP.
- Dieu khoan su dung.

Wireframe:

```text
+--------------------------------+
| Ten ung dung                    |
| Dat xe nhanh, an toan           |
|                                |
| [ So dien thoai              ] |
| [ Gui ma OTP                 ] |
|                                |
| [ Ma OTP                     ] |
| [ Dang nhap                  ] |
+--------------------------------+
```

### 2.2 Trang dat xe

Thanh phan:

- Ban do.
- O diem don.
- O diem den.
- Dia chi da luu.
- Danh sach loai xe.
- Gia tam tinh.
- Ma khuyen mai.
- Nut dat xe.

Wireframe:

```text
+------------------------------------------------+
| Header: Tai khoan | Lich su | Ho tro           |
+------------------------------------------------+
|                                                |
|                    BAN DO                      |
|                                                |
+------------------------------------------------+
| Diem don: [ Vi tri hien tai                ]   |
| Diem den: [ Nhap diem den                  ]   |
| Loai xe:  [ Bike ] [ Car 4 ] [ Car 7 ]         |
| Khuyen mai: [ Nhap ma ]                        |
| Gia tam tinh: 85.000 VND                       |
| [ Dat xe ]                                     |
+------------------------------------------------+
```

### 2.3 Man hinh dang tim tai xe

- Hien thi loading/tien trinh tim tai xe.
- Diem don, diem den, gia tam tinh.
- Nut huy yeu cau.

### 2.4 Man hinh tai xe da nhan

- Anh/ten tai xe.
- Bien so, loai xe, danh gia.
- Vi tri tai xe tren ban do.
- ETA tai xe den diem don.
- Nut goi/nhan tin.
- Nut huy chuyen.

### 2.5 Man hinh hoan thanh va danh gia

- Tong tien.
- Phuong thuc thanh toan.
- Hoa don tom tat.
- Cham sao.
- Nhan xet.

## 3. Man hinh Driver App

### 3.1 Home tai xe

Thanh phan:

- Toggle Online/Offline.
- Ban do.
- Thu nhap hom nay.
- So chuyen hom nay.
- Thong bao chuyen moi.

Wireframe:

```text
+--------------------------------+
| Trang thai: [ Online ]         |
| Thu nhap hom nay: 520.000 VND  |
+--------------------------------+
|                                |
|             BAN DO             |
|                                |
+--------------------------------+
| Chuyen moi                     |
| Don: 12 Nguyen Trai            |
| Den: 99 Le Loi                 |
| Gia uoc tinh: 92.000 VND       |
| [ Tu choi ]      [ Nhan chuyen]|
+--------------------------------+
```

### 3.2 Dang thuc hien chuyen

- Trang thai hien tai.
- Diem tiep theo can den.
- Ban do dieu huong.
- Nut cap nhat trang thai.
- Nut goi khach.
- Nut bao cao su co.

## 4. Admin Web

### 4.1 Dashboard

Thanh phan:

- Tong doanh thu.
- So chuyen hoan thanh.
- So chuyen dang dien ra.
- So tai xe online.
- Ti le huy.
- Bieu do doanh thu theo ngay.
- Bang chuyen dang co su co.

### 4.2 Quan ly chuyen di

Bo loc:

- Ma chuyen.
- Khach hang.
- Tai xe.
- Trang thai.
- Thoi gian.
- Phuong thuc thanh toan.

Cot bang:

- Ma chuyen.
- Khach hang.
- Tai xe.
- Diem don/diem den.
- Gia.
- Trang thai.
- Thoi gian tao.
- Hanh dong.

### 4.3 Quan ly tai xe

Cot bang:

- Ho ten.
- So dien thoai.
- Bien so xe.
- Loai xe.
- Trang thai ho so.
- Trang thai hoat dong.
- Diem danh gia.
- Hanh dong.

### 4.4 Quan ly gia cuoc

- Loai xe.
- Gia mo cua.
- Gia moi km.
- Gia moi phut.
- Phi cho.
- Phu phi gio cao diem.
- Trang thai ap dung.

## 5. Dieu huong UI

### Customer

```text
Home/Dat xe
  -> Tim diem den
  -> Chon xe
  -> Xac nhan
  -> Theo doi chuyen
  -> Thanh toan
  -> Danh gia
```

### Driver

```text
Home
  -> Online
  -> Chuyen moi
  -> Chi tiet chuyen
  -> Dieu huong
  -> Hoan thanh
  -> Thu nhap
```

### Admin

```text
Dashboard
  -> Chuyen di
  -> Khach hang
  -> Tai xe
  -> Xe
  -> Gia cuoc
  -> Khuyen mai
  -> Thanh toan
  -> Khieu nai
  -> Bao cao
  -> Cau hinh
```

## 6. Dau ra cua buoc 04

- Dinh huong giao dien cho customer, driver va admin.
- Wireframe muc thap cho cac man hinh quan trong.
- Nguyen tac UX de phat trien web/mobile o cac buoc sau.

