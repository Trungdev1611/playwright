import { chromium } from "playwright";
import fs from "fs";
import path from "path";

const CATEGORY_URL = "https://phongvu.vn/c/laptop-asus";
const OUTPUT_FILE = path.join(import.meta.dirname, "..", "output", "phongvu.json");

function log(step, data) {
  console.log(`[${new Date().toISOString()}] ${step}`, data ?? "");
}

function parsePrice(text) {
  if (!text) return null;
  const digits = text.replace(/[^\d]/g, "");
  return digits ? Number(digits) : null;
}

/**
 * Phong Vũ dùng CSS-in-JS nên class phần lớn bị băm ngẫu nhiên (css-xxxxx),
 * nhưng may là trang có giữ lại vài class/attribute có TÊN Ý NGHĨA rõ ràng
 * (data-testid, att-product-...) -> ưu tiên bám vào mấy cái này cho bền hơn
 * so với các css-xxxxx (class này đổi mỗi lần build lại web).
 */
async function scrapeListing(page) {
  return page.evaluate(() => {
    const cards = [...document.querySelectorAll('[data-testid="product-card"]')];
    return cards
      .map((card) => {
        const name = card.querySelector("h3[title]")?.getAttribute("title");
        const priceText = card.querySelector(".att-product-detail-latest-price")?.textContent?.trim();
        const img = card.querySelector('[data-testid="product-card-image"] img');
        const link = card.querySelector("a[href]");
        if (!name || !link) return null;
        return {
          name,
          priceText,
          image: img?.getAttribute("src") || null,
          url: new URL(link.getAttribute("href"), location.origin).href,
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

    for (let i = 0; i < 6; i++) {
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
      site: "phongvu",
      category_url: CATEGORY_URL,
      scraped_at: new Date().toISOString(),
      products,
    };

    fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(record, null, 2), "utf-8");
    log("Đã ghi file", OUTPUT_FILE);
  } catch (error) {
    log("LỖI khi cào Phong Vũ", error?.message);
  } finally {
    await browser.close();
  }
}

main();
