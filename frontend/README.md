# GoRide Frontend

React/Vite frontend responsive cho ba khong gian nghiep vu:

- Customer: dang ky/dang nhap, tinh gia, dat/huy/theo doi chuyen, lich su va danh gia.
- Driver: dang ky ho so, online/offline, GPS, nhan chuyen, state machine va thu nhap.
- Admin: dashboard, user, tai xe, chuyen di, pricing, promotion va payment.

Frontend chi dung API that; khong con demo data fallback.

## Chay local

Khoi dong MySQL va backend truoc, sau do:

```powershell
npm install
npm run dev -- --host 127.0.0.1
```

Mo `http://127.0.0.1:5173`. Vite proxy `/api` va `/socket.io` sang backend tai `http://localhost:4000`.

Neu deploy tach domain, dat `VITE_API_URL` thanh URL `/api` cua backend va them origin frontend vao `APP_ORIGIN` phia backend.

## Kiem tra

```powershell
npm run typecheck
npm run build
npm run test:e2e
```

Playwright kiem tra backend readiness, sau do chay 6 ca desktop/mobile cho Customer, Driver va Admin. MySQL phai da bootstrap/migrate/seed.

Chup lai ba man hinh live sau khi chay E2E:

```powershell
npm run capture:ui
```

## Ban do va realtime

- Leaflet tai tile tu OpenStreetMap public service.
- Khi tile khong truy cap duoc, UI hien canh bao; marker, toa do va API van hoat dong.
- Duong noi tren ban do chi la uoc tinh thang, khong phai chi duong giao thong.
- Socket.IO tu refresh session, reconnect va cap nhat yeu cau/trang thai/vi tri chuyen.
