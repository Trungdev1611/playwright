import { chromium } from "playwright";
import fs from "fs";
import path from "path";

const CATEGORY_URL = "https://cellphones.com.vn/laptop/asus.html";
const OUTPUT_FILE = path.join(import.meta.dirname, "..", "output", "cellphones.json");

function log(step, data) {
  console.log(`[${new Date().toISOString()}] ${step}`, data ?? "");
}

function parsePrice(text) {
  if (!text) return null;
  const digits = text.replace(/[^\d]/g, "");
  return digits ? Number(digits) : null;
}

/**
 * Mỗi sản phẩm nằm trong div.product-info-container.product-item.
 * CellphoneS không có sẵn data-* sạch như TGDĐ nên phải đọc text hiển thị,
 * rồi tự parse số từ chuỗi kiểu "23.590.000đ".
 */
async function scrapeListing(page) {
  return page.evaluate(() => {
    const cards = [...document.querySelectorAll(".product-info-container.product-item")];
    return cards
      .map((card) => {
        const a = card.querySelector("a.product__link");
        const name = card.querySelector(".product__name h3")?.textContent?.trim();
        const priceText = card.querySelector(".product__price--show")?.textContent?.trim();
        const img = card.querySelector(".product__image img");
        if (!a || !name) return null;
        return {
          name,
          priceText,
          image: img?.getAttribute("src") || null,
          url: a.href,
        };
      })
      .filter(Boolean);
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

    for (let i = 0; i < 5; i++) {
      await page.mouse.wheel(0, 2000);
      await page.waitForTimeout(600);
    }

    const raw = await scrapeListing(page);
    const products = raw.map((p) => ({
      name: p.name,
      price: parsePrice(p.priceText),
      image: p.image,
      url: p.url,
    }));
    log(`Cào được ${products.length} sản phẩm`);

    const record = {
      site: "cellphones",
      category_url: CATEGORY_URL,
      scraped_at: new Date().toISOString(),
      products,
    };

    fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(record, null, 2), "utf-8");
    log("Đã ghi file", OUTPUT_FILE);
  } catch (error) {
    log("LỖI khi cào CellphoneS", error?.message);
  } finally {
    await browser.close();
  }
}

main();
