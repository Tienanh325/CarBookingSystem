# Buoc 07: UI Design Contract

## 1. Pham vi

Frontend web dau tien gom ba khong gian nghiep vu dung chung mot design system:

- Customer Portal: dat xe, theo doi tai xe, xem gia va thanh toan.
- Driver Portal: bat/tat nhan chuyen, xem yeu cau moi, cap nhat trang thai chuyen va thu nhap.
- Admin Portal: dashboard van hanh, chuyen di, tai xe, bang gia va khuyen mai.

Ten thuong hieu tam thoi trong giao dien la `GoRide`. Ten nay co the thay doi ma khong anh huong cau truc UI.

## 2. Nguyen tac trai nghiem

1. Hanh dong quan trong nhat phai nhin thay trong mot man hinh, khong can cuon: Dat xe, Nhan chuyen, Cap nhat trang thai.
2. Ban do la be mat chinh cua Customer va Driver; bang du lieu la be mat chinh cua Admin.
3. Mau trang thai phai nhat quan tren tat ca portal.
4. Moi man hinh co day du loading, empty, error, disabled va success state.
5. Tren mobile, thao tac chinh nam trong vung de cham bang mot tay; kich thuoc toi thieu 44 x 44 px.
6. Khong dua thong tin ky thuat vao giao dien nguoi dung, ngoai trang thai ket noi realtime can thiet.

## 3. Design tokens

### Mau sac

| Token | Gia tri | Muc dich |
| --- | --- | --- |
| `--ink` | `#17211d` | Chu chinh |
| `--muted` | `#64716b` | Chu phu |
| `--surface` | `#ffffff` | Nen noi dung |
| `--canvas` | `#f3f6f4` | Nen ung dung |
| `--line` | `#dce4df` | Vien va phan tach |
| `--brand` | `#087a55` | CTA, online, thanh cong |
| `--brand-strong` | `#055f42` | Hover/active |
| `--aqua` | `#087f8c` | Thong tin, ban do |
| `--amber` | `#bd7b00` | Dang cho/canh bao |
| `--danger` | `#c4493d` | Loi, huy, tu choi |
| `--violet` | `#6c5b9a` | Khuyen mai |

Khong dung gradient. Trang thai khong chi phan biet bang mau; luon kem icon hoac nhan chu.

### Typography

- Font: `Inter`, `Segoe UI`, system sans-serif.
- H1 trong workspace: 28-32 px; section heading: 18-22 px; body: 14-16 px; metadata: 12-13 px.
- Font weight: 400 cho noi dung, 600 cho nhan dieu khien, 700 cho KPI.
- Letter spacing: `0`.

### Khoang cach va hinh dang

- Luoi spacing: 4, 8, 12, 16, 24, 32 px.
- Border radius: 6 px cho control, 8 px cho card/modal.
- Control height: 44 px; icon button: 40 x 40 px.
- Shadow chi dung cho modal va panel noi tren ban do.

## 4. Information architecture

```text
GoRide Web
|-- Customer
|   |-- Dat xe
|   |-- Chuyen hien tai
|   `-- Lich su
|-- Driver
|   |-- Ban do hoat dong
|   |-- Chuyen moi
|   |-- Chuyen dang thuc hien
|   `-- Thu nhap
`-- Admin
    |-- Tong quan
    |-- Chuyen di
    |-- Tai xe
    |-- Bang gia
    `-- Khuyen mai
```

## 5. Hop dong man hinh

### Customer Portal

- Desktop: panel dat xe rong 400 px ben trai, ban do chiem phan con lai.
- Mobile: ban do cao 40-44vh, form dat xe nam ben duoi.
- Flow trang thai: `DRAFT -> SEARCHING_DRIVER -> ACCEPTED -> IN_PROGRESS -> COMPLETED`.
- Form gom diem don, diem den, loai xe, khuyen mai, thanh toan va tong gia.
- Khi da co tai xe: hien ten, danh gia, bien so, nut goi va huy chuyen.

### Driver Portal

- Toggle Online/Offline luon hien thi o dau panel.
- Khi online va chua co chuyen: hien request moi voi diem don, diem den, quang duong don va thu nhap du kien.
- Flow thao tac: `ACCEPT -> ARRIVED -> START -> COMPLETE`.
- Nut cap nhat trang thai chi co mot CTA chinh tai moi thoi diem.

### Admin Portal

- Desktop: sidebar 224 px va vung noi dung co mat do thong tin cao.
- Mobile/tablet: sidebar chuyen thanh thanh tab ngang co the cuon.
- Dashboard: KPI, doanh thu 7 ngay, phan bo trang thai, bang chuyen dang hoat dong.
- Cac bang co search, filter, status badge, pagination va action bang icon.
- Duyet/tu choi tai xe va sua bang gia phai co modal xac nhan.

## 6. Responsive breakpoints

| Breakpoint | Quy tac |
| --- | --- |
| `< 720px` | Mot cot, bottom navigation, map tren/form duoi, bang chuyen thanh danh sach |
| `720-1099px` | Panel 360 px + map, admin nav ngang |
| `>= 1100px` | Day du sidebar/panel, bang nhieu cot |

## 7. Accessibility

- Contrast chu toi thieu WCAG AA.
- Tat ca icon button co `aria-label` va tooltip.
- Focus ring 3 px ro rang; khong tat outline.
- Form co label that, thong bao loi gan control.
- `prefers-reduced-motion` tat animation khong can thiet.
- Ban phim co the truy cap moi control va modal.

## 8. Anh xa API

| UI | API |
| --- | --- |
| Dang nhap | `POST /api/auth/login` |
| Uoc tinh gia | `POST /api/rides/estimate` |
| Dat xe | `POST /api/rides` |
| Chuyen hien tai | `GET /api/rides/current` |
| Tai xe online/offline | `POST /api/drivers/me/online`, `/offline` |
| Tai xe nhan chuyen | `POST /api/drivers/rides/{id}/accept` |
| Dashboard admin | `GET /api/admin/dashboard` |
| Danh sach chuyen | `GET /api/admin/rides` |
| Duyet tai xe | `POST /api/admin/drivers/{id}/approve` |
| Bang gia | `/api/admin/pricing-rules` |

Frontend su dung truc tiep response contract `{ success, message, data }` tu backend, luu session trong `sessionStorage` va refresh access token khi can. Neu API mat ket noi, man hinh giu error state va cho phep thu lai; khong tu thay the bang demo data.

## 9. Tieu chi nghiem thu UI dot dau

- Ba portal co the dieu huong doc lap.
- Customer dat xe va thay duoc trang thai tim/da co tai xe.
- Driver online, nhan chuyen va chay het state machine.
- Admin xem dashboard, loc chuyen, duyet tai xe va xem bang gia/khuyen mai.
- Hoat dong tai 390 px, 768 px va 1440 px ma khong tran/che noi dung.
- Build production khong co TypeScript error.
