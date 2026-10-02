import { chromium } from "playwright";
import fs from "fs";
import path from "path";

// Trang danh mục để cào (đổi URL này để cào danh mục khác của TGDĐ)
const CATEGORY_URL = "https://www.thegioididong.com/laptop-asus-vivobook";
const OUTPUT_FILE = path.join(import.meta.dirname, "..", "output", "tgdd.json");

function log(step, data) {
  console.log(`[${new Date().toISOString()}] ${step}`, data ?? "");
}

/**
 * Cào danh sách sản phẩm trên 1 trang danh mục của TGDĐ.
 * Mỗi sản phẩm nằm trong <li class="item"><a class="main-contain" ...></a></li>
 * Thẻ <a> có sẵn data-name, data-price, data-id rất sạch -> ưu tiên đọc từ đó
 * thay vì parse text hiển thị (đỡ lệ thuộc vào cách format "19.590.000₫").
 */
async function scrapeListing(page) {
  return page.evaluate(() => {
    const cards = [...document.querySelectorAll("li.item")];
    return cards
      .map((card) => {
        const a = card.querySelector("a.main-contain");
        if (!a) return null;
        const img = card.querySelector("img");
        return {
          id: a.getAttribute("data-id"),
          name: a.getAttribute("data-name"),
          price: a.getAttribute("data-price") ? Number(a.getAttribute("data-price")) : null,
          image: img?.getAttribute("data-src") || img?.getAttribute("src") || null,
          url: a.href,
        };
      })
      .filter((x) => x && x.name);
  });
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    locale: "vi-VN",
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
  });
  const page = await context.newPage();

  try {
    log("Mở trang danh mục", CATEGORY_URL);
    await page.goto(CATEGORY_URL, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForTimeout(2000);

    // TGDĐ lazy-load ảnh/sản phẩm khi cuộn xuống -> cuộn vài lần cho tải hết
    for (let i = 0; i < 5; i++) {
      await page.mouse.wheel(0, 2000);
      await page.waitForTimeout(600);
    }

    const products = await scrapeListing(page);
    log(`Cào được ${products.length} sản phẩm`);

    const record = {
      site: "tgdd",
      category_url: CATEGORY_URL,
      scraped_at: new Date().toISOString(),
      products,
    };

    fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(record, null, 2), "utf-8");
    log("Đã ghi file", OUTPUT_FILE);
  } catch (error) {
    log("LỖI khi cào TGDĐ", error?.message);
  } finally {
    await browser.close();
  }
}

main();
