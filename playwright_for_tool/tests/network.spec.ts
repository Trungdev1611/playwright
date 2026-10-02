import { test } from "@playwright/test";

test("nghe network request khi gõ vào ô search", async ({ page }) => {
  // let blockedCount = 0;
  // await page.route("**/*.{png,jpg,jpeg}", (route) => {
  //   blockedCount++;
  //   console.log("Blocked:", route.request().url());
  //   return route.abort();
  // });
  // Lắng nghe MỌI request trang này gửi đi, in ra URL

  page.on("request", (req) => {
    console.log(">>", req.method(), req.url());
  });

  await page.goto("https://playwright.dev/");

  // Gõ vào ô search để trang gọi API tìm kiếm ngầm
  await page.getByRole("button", { name: "Search" }).click();
  await page.getByPlaceholder("Search docs").fill("locator");

  // Chờ 1 chút để request kịp bắn ra (cách tạm, chưa phải best-practice)
  await page.waitForTimeout(2000);
  await page.screenshot({ path: "screenshot.png", fullPage: true });
  // console.log("Tổng số request đã chặn:", blockedCount);
});
