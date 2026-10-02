import { chromium } from "playwright";
import fs from "fs";
import path from "path";

const BASE_URL = "https://kinhtexaydung.gov.vn/tinh-thanh/thanh-pho-ha-noi/";
// Theo vị trí file script, không phụ thuộc thư mục đang đứng khi chạy lệnh
const DOWNLOAD_DIR = path.join(import.meta.dirname, "downloads");

function log(step, data) {
  console.log(`[${new Date().toISOString()}] ${step}`, data ?? "");
}

/**
 * Đứng ở trang CHI TIẾT (đã redirect tới sau khi click link),
 * tìm tất cả nút/link download trên trang đó và tải về từng cái.
 */
async function downloadFilesFromDetailPage(page, targetDir, filePrefix) {
  // Khớp cả link trong .embed_download, lẫn bất kỳ link nào có chữ "download"
  // trong text (:has-text không phân biệt hoa/thường) - phòng khi trang khác
  // không dùng đúng class .embed_download.
  const downloadLinks = page.locator('.embed_download a, a:has-text("download")');
  const count = await downloadLinks.count();
  log(`Tìm thấy ${count} nút download trên trang chi tiết`);

  const context = page.context();

  for (let i = 0; i < count; i++) {
    const btn = downloadLinks.nth(i);
    try {
      // Chờ 1 trong 2 khả năng: "download" bắn ra trên page hiện tại,
      // HOẶC 1 tab mới (popup) được mở ra (nút có thể mở link trong tab mới).
      const downloadOrPopup = Promise.race([
        page.waitForEvent("download", { timeout: 10000 }).then((d) => ({ type: "download", data: d })),
        context.waitForEvent("page", { timeout: 10000 }).then((p) => ({ type: "popup", data: p })),
      ]);

      await btn.click();
      const result = await downloadOrPopup;

      if (result.type === "download") {
        const download = result.data;
        const savePath = path.join(
          targetDir,
          `${filePrefix}_${i}_${download.suggestedFilename()}`,
        );
        await download.saveAs(savePath);
        log(`Đã tải: ${savePath}`);
      } else {
        // Nút mở ra tab mới -> file PDF/doc có thể đang hiển thị trực tiếp trong đó
        const popup = result.data;
        await popup.waitForLoadState("domcontentloaded");
        log(`Nút mở tab mới, không phải download trực tiếp. URL tab mới:`, popup.url());
        await popup.close();
      }
    } catch (error) {
      // Không có download, không có popup -> khả năng PDF mở ngay trong tab hiện tại
      log(
        `Không bắt được download/popup cho nút [${i}]. URL hiện tại sau khi click:`,
        page.url(),
      );
      log(`Chi tiết lỗi:`, error?.message);
    }
  }
}

/**
 * Cào + tải toàn bộ thông báo giá của 1 năm cụ thể, dùng chung cho mọi năm.
 * Yêu cầu: `page` đang đứng ở trang danh sách (BASE_URL) khi gọi hàm này.
 */
async function crawlYear(page, year) {
  const yearDir = path.join(DOWNLOAD_DIR, String(year));
  if (!fs.existsSync(yearDir)) {
    fs.mkdirSync(yearDir, { recursive: true });
  }

  const rows = page.locator(
    `.thongtincongbo_template .box_module:has-text("Năm ${year}") table tbody tr`,
  );
  const count = await rows.count();
  log(`Tìm thấy ${count} thông báo giá trong năm ${year}`);

  for (let i = 0; i < count; i++) {
    const row = rows.nth(i);
    const linkElement = row.locator("td:nth-child(1) a");
    const title = await linkElement.textContent();
    log(`Đang xử lý mục [${i + 1}/${count}] năm ${year}`, title?.trim());

    try {
      // Click vào link -> trang redirect sang trang chi tiết (cùng tab)
      await Promise.all([
        page.waitForNavigation({ waitUntil: "networkidle" }),
        linkElement.click(),
      ]);

      await downloadFilesFromDetailPage(page, yearDir, String(i));

      // Quay lại trang danh sách để tiếp tục vòng lặp cho mục tiếp theo
      await page.goBack({ waitUntil: "networkidle" });
    } catch (error) {
      log(`Lỗi khi xử lý mục [${i + 1}] năm ${year}`, error?.message);
      // Lỗi thì quay lại trang danh sách gốc để không bị kẹt
      await page.goto(BASE_URL, { waitUntil: "networkidle" });
    }
  }
}

async function main() {
  if (!fs.existsSync(DOWNLOAD_DIR)) {
    fs.mkdirSync(DOWNLOAD_DIR);
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(BASE_URL, { waitUntil: "networkidle" });
  await crawlYear(page, 2026);

  await page.goto(BASE_URL, { waitUntil: "networkidle" });
  await crawlYear(page, 2025);

  log("Hoàn tất toàn bộ các năm");
  await browser.close();
}

main().catch((error) => {
  log("CRASH - lỗi không lường trước, dừng toàn bộ script", error?.message);
  process.exit(1);
});
