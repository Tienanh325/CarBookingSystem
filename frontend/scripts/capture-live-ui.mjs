import { chromium } from "playwright";

const baseUrl = process.env.UI_BASE_URL || "http://127.0.0.1:5173";
const browser = await chromium.launch();

async function login(page, phone, password) {
  await page.goto(baseUrl);
  await page.getByLabel("Số điện thoại").fill(phone);
  await page.getByLabel("Mật khẩu").fill(password);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await page.locator(".global-header").waitFor({ timeout: 15_000 });
}

async function waitForData(page) {
  await page.locator(".loading-line").waitFor({ state: "hidden", timeout: 15_000 }).catch(() => {});
}

try {
  const customer = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await login(customer, process.env.UI_CUSTOMER_PHONE || "0710000002", process.env.UI_TEST_PASSWORD || "Playwright@123");
  await waitForData(customer);
  await customer.screenshot({ path: "screenshots/live-customer-desktop.png", fullPage: true });

  const driver = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await login(driver, process.env.UI_DRIVER_PHONE || "0720000002", process.env.UI_TEST_PASSWORD || "Playwright@123");
  await driver.getByRole("link", { name: "Tài xế" }).click();
  await driver.getByRole("heading", { name: "Không gian tài xế" }).waitFor();
  await waitForData(driver);
  await driver.screenshot({ path: "screenshots/live-driver-desktop.png", fullPage: true });

  const admin = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true });
  await login(admin, process.env.UI_ADMIN_PHONE || "0900000000", process.env.UI_ADMIN_PASSWORD || "Admin@123456");
  await waitForData(admin);
  await admin.screenshot({ path: "screenshots/live-admin-mobile.png", fullPage: true });
} finally {
  await browser.close();
}
