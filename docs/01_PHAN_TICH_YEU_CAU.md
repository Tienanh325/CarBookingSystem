# Buoc 01: Phan tich yeu cau

## 1. Muc tieu

Xac dinh ro he thong can lam gi, ai su dung, nghiep vu nao la cot loi va cac tieu chi chat luong can dat duoc de phat trien he thong dat xe online.

## 2. Nhom nguoi dung

| Nhom | Mo ta | Muc tieu su dung |
| --- | --- | --- |
| Khach hang | Nguoi can dat xe | Dat xe, theo doi tai xe, thanh toan, danh gia |
| Tai xe | Nguoi cung cap dich vu van chuyen | Nhan chuyen, dieu huong, hoan thanh chuyen, xem thu nhap |
| Admin | Bo phan quan tri he thong | Quan ly nguoi dung, tai xe, xe, gia cuoc, khuyen mai, khieu nai |
| Dieu phoi/CSKH | Bo phan ho tro van hanh | Theo doi chuyen, xu ly su co, ho tro khach/tai xe |
| Ke toan | Bo phan tai chinh | Doi soat doanh thu, hoa hong, thanh toan cho tai xe |

## 3. Yeu cau chuc nang cho khach hang

| Ma | Chuc nang | Mo ta | Uu tien |
| --- | --- | --- | --- |
| KH-01 | Dang ky/dang nhap | Dang nhap bang so dien thoai, OTP, hoac tai khoan | Cao |
| KH-02 | Quan ly ho so | Cap nhat ten, avatar, email, dia chi yeu thich | Trung binh |
| KH-03 | Tim diem don/diem den | Tim kiem dia chi tren ban do | Cao |
| KH-04 | Dat xe | Chon loai xe, xem gia tam tinh, dat xe | Cao |
| KH-05 | Theo doi chuyen di | Xem vi tri tai xe, trang thai chuyen | Cao |
| KH-06 | Huy chuyen | Huy truoc hoac sau khi tai xe nhan theo quy dinh | Cao |
| KH-07 | Thanh toan | Tien mat, vi dien tu, the ngan hang | Cao |
| KH-08 | Khuyen mai | Ap ma giam gia, xem uu dai | Trung binh |
| KH-09 | Danh gia | Cham sao, nhan xet tai xe/chuyen di | Cao |
| KH-10 | Lich su chuyen | Xem chi tiet cac chuyen da di | Cao |
| KH-11 | Khieu nai/ho tro | Gui phan anh ve chuyen di | Trung binh |

## 4. Yeu cau chuc nang cho tai xe

| Ma | Chuc nang | Mo ta | Uu tien |
| --- | --- | --- | --- |
| TX-01 | Dang ky tai xe | Gui thong tin ca nhan, GPLX, xe, tai khoan ngan hang | Cao |
| TX-02 | Xac minh ho so | Cho admin phe duyet truoc khi hoat dong | Cao |
| TX-03 | Bat/tat trang thai online | San sang nhan chuyen hoac nghi | Cao |
| TX-04 | Nhan chuyen | Xem thong tin chuyen va chap nhan/tu choi | Cao |
| TX-05 | Dieu huong | Xem diem don, diem den, ban do | Cao |
| TX-06 | Cap nhat trang thai | Da den diem don, da don khach, dang di, hoan thanh | Cao |
| TX-07 | Huy chuyen | Huy theo ly do hop le | Trung binh |
| TX-08 | Xem thu nhap | Doanh thu ngay/tuan/thang, phi nen tang | Cao |
| TX-09 | Rut tien/doi soat | Quan ly so du va yeu cau thanh toan | Trung binh |
| TX-10 | Nhan thong bao | Chuyen moi, canh bao, ho tro | Cao |

## 5. Yeu cau chuc nang cho admin

| Ma | Chuc nang | Mo ta | Uu tien |
| --- | --- | --- | --- |
| AD-01 | Dashboard | Tong quan doanh thu, chuyen di, tai xe, su co | Cao |
| AD-02 | Quan ly khach hang | Tim kiem, khoa/mo tai khoan, xem lich su | Cao |
| AD-03 | Quan ly tai xe | Duyet ho so, khoa/mo, xep hang, theo doi hoat dong | Cao |
| AD-04 | Quan ly xe | Loai xe, bien so, trang thai, thong tin dang ki | Cao |
| AD-05 | Quan ly chuyen di | Loc, xem chi tiet, can thiep khi co loi | Cao |
| AD-06 | Quan ly gia cuoc | Cau hinh gia theo loai xe, km, gio cao diem | Cao |
| AD-07 | Quan ly khuyen mai | Tao ma giam gia, dieu kien ap dung, ngan sach | Trung binh |
| AD-08 | Quan ly thanh toan | Giao dich, hoan tien, doi soat | Cao |
| AD-09 | Quan ly khieu nai | Tiep nhan, phan cong, xu ly, ket luan | Trung binh |
| AD-10 | Bao cao | Bao cao doanh thu, hieu suat tai xe, ti le huy | Cao |
| AD-11 | Phan quyen | Admin, dieu phoi, CSKH, ke toan | Cao |

## 6. Quy tac nghiep vu cot loi

- Mot khach hang chi co the co mot chuyen dang hoat dong tai mot thoi diem.
- Tai xe chi nhan duoc chuyen khi trang thai la `ONLINE` va ho so da duoc phe duyet.
- Gia cuoc tam tinh co the khac gia cuoc cuoi cung neu phat sinh thoi gian cho, phu phi hoac thay doi lo trinh.
- Huy chuyen sau khi tai xe da di chuyen den diem don co the bi tinh phi.
- Tai xe khong duoc nhan chuyen moi khi dang co chuyen `ACCEPTED`, `ARRIVED`, `IN_PROGRESS`.
- Moi giao dich thanh toan phai co ma tham chieu va trang thai doi soat.
- Khuyen mai chi duoc ap dung neu con hieu luc, con ngan sach va dung dieu kien.

## 7. Yeu cau phi chuc nang

| Nhom | Yeu cau |
| --- | --- |
| Hieu nang | API dat xe phan hoi duoi 2 giay trong dieu kien binh thuong |
| Realtime | Cap nhat vi tri tai xe gan thoi gian thuc, do tre muc tieu duoi 3 giay |
| Bao mat | Ma hoa mat khau/token, phan quyen theo vai tro, chong truy cap trai phep |
| San sang | He thong can co logging, monitoring, retry cho tac vu quan trong |
| Mo rong | Tach module ro rang de sau nay co the mo rong thanh microservice |
| Du lieu | Du lieu giao dich, chuyen di, thanh toan phai nhat quan va co lich su |
| UX | Luong dat xe toi gian, minh bach gia, trang thai chuyen de hieu |

## 8. Dau ra cua buoc 01

- Danh sach yeu cau chuc nang theo tung nhom nguoi dung.
- Danh sach yeu cau phi chuc nang.
- Quy tac nghiep vu cot loi.
- Co so de chuyen sang actor, use case va thiet ke luong.

