# Buoc 03: Thiet ke User Flow

## 1. Flow tong quan dat xe cua khach hang

```text
Mo app/web
  -> Dang nhap/dang ky
  -> Nhap diem don
  -> Nhap diem den
  -> Chon loai xe
  -> Xem gia tam tinh
  -> Ap ma khuyen mai neu co
  -> Xac nhan dat xe
  -> He thong tim tai xe
  -> Tai xe chap nhan
  -> Theo doi tai xe den diem don
  -> Bat dau chuyen di
  -> Ket thuc chuyen di
  -> Thanh toan
  -> Danh gia
  -> Xem hoa don/lich su
```

## 2. Flow tim tai xe

```text
Customer tao booking
  -> Backend tao ride request
  -> Tinh gia tam tinh
  -> Tim tai xe online gan diem don
  -> Gui yeu cau den tai xe uu tien
  -> Tai xe chap nhan?
      -> Co: gan tai xe vao chuyen
      -> Khong/het thoi gian: gui tai xe tiep theo
  -> Qua thoi gian tim kiem?
      -> Co: bao khong tim thay tai xe
      -> Khong: tiep tuc matching
```

## 3. Flow cua tai xe khi nhan chuyen

```text
Tai xe dang nhap
  -> Bat trang thai online
  -> Cap nhat vi tri lien tuc
  -> Nhan thong bao chuyen moi
  -> Xem diem don, diem den, gia uoc tinh
  -> Chap nhan hoac tu choi
  -> Neu chap nhan:
      -> Di den diem don
      -> Bam "Da den diem don"
      -> Don khach
      -> Bam "Bat dau chuyen"
      -> Dieu huong den diem den
      -> Bam "Hoan thanh"
      -> Xem tong tien va thu nhap
```

## 4. Flow huy chuyen

### Customer huy

```text
Customer bam huy chuyen
  -> Chon ly do huy
  -> He thong kiem tra trang thai chuyen
  -> Neu chua co tai xe: huy mien phi
  -> Neu tai xe da nhan/da den: co the tinh phi huy
  -> Cap nhat trang thai CANCELLED_BY_CUSTOMER
  -> Thong bao cho tai xe
```

### Driver huy

```text
Driver bam huy chuyen
  -> Chon ly do huy
  -> He thong ghi nhan su kien
  -> Cap nhat diem uy tin neu can
  -> Tim tai xe thay the hoac huy chuyen
  -> Thong bao cho customer
```

## 5. Flow thanh toan

```text
Chuyen hoan thanh
  -> Backend tinh gia cuoi cung
  -> Ap phi phat sinh/phu phi/khuyen mai
  -> Tao payment transaction
  -> Neu tien mat:
      -> Tai xe thu tien
      -> Ghi nhan cash payment
  -> Neu online:
      -> Gui yeu cau sang payment gateway
      -> Nhan webhook ket qua
      -> Cap nhat PAID/FAILED
  -> Tao hoa don
  -> Cap nhat thu nhap tai xe
```

## 6. Flow admin duyet tai xe

```text
Tai xe nop ho so
  -> Admin nhan thong bao ho so moi
  -> Kiem tra thong tin ca nhan
  -> Kiem tra GPLX, CCCD, dang ky xe
  -> Phe duyet?
      -> Co: trang thai APPROVED, tai xe duoc online
      -> Khong: REJECTED, ghi ly do
  -> Gui thong bao ket qua cho tai xe
```

## 7. Trang thai chuyen di

| Trang thai | Y nghia |
| --- | --- |
| REQUESTED | Khach vua tao yeu cau |
| SEARCHING_DRIVER | Dang tim tai xe |
| ACCEPTED | Tai xe da nhan |
| DRIVER_ARRIVING | Tai xe dang den diem don |
| ARRIVED | Tai xe da den diem don |
| IN_PROGRESS | Dang cho khach den diem den |
| COMPLETED | Chuyen da hoan thanh |
| CANCELLED_BY_CUSTOMER | Khach huy |
| CANCELLED_BY_DRIVER | Tai xe huy |
| CANCELLED_BY_SYSTEM | He thong/admin huy |
| NO_DRIVER_FOUND | Khong tim thay tai xe |

## 8. Dau ra cua buoc 03

- Luong dat xe end-to-end.
- Luong nhan chuyen cho tai xe.
- Luong huy, thanh toan va duyet tai xe.
- Trang thai chuyen di lam dau vao cho database va API.

