import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

const apiUrl = "http://127.0.0.1:4000/api";
const password = "Playwright@123";

type AuthResult = {
  user: { id: string; roles: string[] };
  tokens: { accessToken: string; refreshToken: string };
};

async function apiData<T>(response: import("@playwright/test").APIResponse): Promise<T> {
  const payload = await response.json();
  expect(response.ok(), JSON.stringify(payload)).toBeTruthy();
  expect(payload.success, JSON.stringify(payload)).toBeTruthy();
  return payload.data as T;
}

async function ensureUser(request: APIRequestContext, phone: string, fullName: string) {
  const registered = await request.post(`${apiUrl}/auth/register`, {
    data: { phone, fullName, password }
  });
  if (registered.ok()) return apiData<AuthResult>(registered);
  return apiData<AuthResult>(await request.post(`${apiUrl}/auth/login`, { data: { phone, password } }));
}

async function adminAuth(request: APIRequestContext) {
  return apiData<AuthResult>(
    await request.post(`${apiUrl}/auth/login`, {
      data: { phone: "0900000000", password: "Admin@123456" }
    })
  );
}

function headers(auth: AuthResult) {
  return { Authorization: `Bearer ${auth.tokens.accessToken}` };
}

async function ensureDriver(request: APIRequestContext, phone: string, suffix: string) {
  let auth = await ensureUser(request, phone, `Tài xế UI ${suffix}`);
  let profileResponse = await request.get(`${apiUrl}/drivers/me`, { headers: headers(auth) });

  if (profileResponse.status() === 403 || profileResponse.status() === 404) {
    const vehicleTypes = await apiData<Array<{ id: string; code: string }>>(
      await request.get(`${apiUrl}/vehicle-types`)
    );
    const vehicleType = vehicleTypes.find((item) => item.code === "CAR4") ?? vehicleTypes[0];
    profileResponse = await request.post(`${apiUrl}/drivers/register`, {
      headers: headers(auth),
      data: {
        licenseNumber: `GPLX-${suffix}`,
        identityNumber: `CCCD-${suffix}`,
        vehicle: {
          vehicleTypeId: vehicleType.id,
          plateNumber: `UIT-${suffix}`,
          brand: "VinFast",
          model: "VF e34",
          color: "Xanh"
        }
      }
    });
  }

  const profile = await apiData<{ id: string }>(profileResponse);
  const admin = await adminAuth(request);
  await apiData(
    await request.post(`${apiUrl}/admin/drivers/${profile.id}/approve`, {
      headers: headers(admin),
      data: {}
    })
  );
  auth = await apiData<AuthResult>(await request.post(`${apiUrl}/auth/login`, { data: { phone, password } }));
  await apiData(
    await request.post(`${apiUrl}/drivers/me/location`, {
      headers: headers(auth),
      data: { lat: 10.775, lng: 106.701, speed: 0 }
    })
  );
  await apiData(
    await request.post(`${apiUrl}/drivers/me/offline`, {
      headers: headers(auth),
      data: {}
    })
  );
  return auth;
}

async function login(page: Page, phone: string, loginPassword = password) {
  await page.goto("/");
  await page.getByLabel("Số điện thoại").fill(phone);
  await page.getByLabel("Mật khẩu").fill(loginPassword);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
}

async function expectNoHorizontalOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth
  }));
  expect(dimensions.content, JSON.stringify(dimensions)).toBeLessThanOrEqual(dimensions.viewport + 1);
}

test("customer uses MySQL vehicle data and receives a fare estimate", async ({ page, request }, testInfo) => {
  const suffix = testInfo.project.name.includes("mobile") ? "10000001" : "10000002";
  const phone = `07${suffix}`;
  await ensureUser(request, phone, `Khách hàng UI ${suffix}`);
  await login(page, phone);

  await expect(page.getByRole("heading", { name: "Bạn muốn đi đâu?" })).toBeVisible();
  await expect(page.getByTitle("Cập nhật trực tiếp")).toBeVisible({ timeout: 8_000 });
  await page.locator("details.manual-coordinate-entry").nth(0).getByText("Nhập tọa độ thủ công").click();
  await page.locator("details.manual-coordinate-entry").nth(1).getByText("Nhập tọa độ thủ công").click();
  await page.getByLabel("Điểm đón - Địa chỉ").fill("Chợ Bến Thành, Quận 1");
  await page.getByLabel("Điểm đón - Vĩ độ").fill("10.7723");
  await page.getByLabel("Điểm đón - Kinh độ").fill("106.6981");
  await page.getByLabel("Điểm đến - Địa chỉ").fill("Landmark 81, Bình Thạnh");
  await page.getByLabel("Điểm đến - Vĩ độ").fill("10.7950");
  await page.getByLabel("Điểm đến - Kinh độ").fill("106.7218");
  await page.getByRole("button", { name: "Tính giá" }).click();

  await expect(page.getByText(/Giá dự kiến/)).toBeVisible();
  await expect(page.locator(".booking-submit")).toHaveText(/Đặt xe/);
  await page.getByRole("button", { name: "Ví", exact: true }).click();
  await expect(page.getByRole("heading", { name: "GoRide Wallet" })).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test("approved driver can switch online through the real API", async ({ page, request }, testInfo) => {
  const suffix = testInfo.project.name.includes("mobile") ? "20000001" : "20000002";
  const phone = `07${suffix}`;
  await ensureDriver(request, phone, suffix);
  await login(page, phone);
  await page.getByRole("link", { name: "Tài xế" }).click();

  await expect(page.getByRole("heading", { name: "Không gian tài xế" })).toBeVisible();
  await page.getByRole("button", { name: "Bật Online" }).click();
  await expect(page.getByText("Trạng thái: Online")).toBeVisible();
  await page.getByRole("button", { name: "Tắt Online" }).click();
  await expect(page.getByText("Trạng thái: Offline")).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test("admin loads every operational screen from backend data", async ({ page }) => {
  await login(page, "0900000000", "Admin@123456");
  await expect(page.getByRole("heading", { name: "Tổng quan", exact: true })).toBeVisible({
    timeout: 10_000
  });
  await expect(page.getByTitle("Cập nhật trực tiếp")).toBeVisible({ timeout: 8_000 });

  for (const section of [
    "Chuyến đi",
    "Tài xế",
    "Bảng giá",
    "Phụ phí",
    "Khuyến mãi",
    "Tài khoản",
    "Thanh toán",
    "Rút tiền"
  ]) {
    await page.getByRole("button", { name: section, exact: true }).click();
    await expect(page.locator("h1", { hasText: section })).toBeVisible();
  }
  await expectNoHorizontalOverflow(page);
});
