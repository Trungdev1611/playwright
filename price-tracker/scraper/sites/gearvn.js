import { chromium } from "playwright";
import fs from "fs";
import path from "path";

const CATEGORY_URL = "https://gearvn.com/search?q=laptop+asus";
const OUTPUT_FILE = path.join(import.meta.dirname, "..", "output", "gearvn.json");

function log(step, data) {
  console.log(`[${new Date().toISOString()}] ${step}`, data ?? "");
}

function parsePrice(text) {
  if (!text) return null;
  const digits = text.replace(/[^\d]/g, "");
  return digits ? Number(digits) : null;
}

/**
 * GearVN: cả thẻ card chính là 1 <a class="product-card" href="...">.
 * GearVN dùng class Tailwind sinh tự động (không có tên ý nghĩa) nên không
 * selector trực tiếp theo class giá được -> tìm theo PATTERN giá "xxx.xxxđ"
 * trong text của các phần tử lá (leaf), loại bỏ dòng "Mua kèm ..." (giá combo
 * phụ, không phải giá chính), giá chính là phần tử còn lại CUỐI CÙNG (nếu có
 * giá gốc gạch ngang + giá khuyến mãi thì giá khuyến mãi hiện sau).
 */
async function scrapeListing(page) {
  return page.evaluate(() => {
    const priceRe = /\d{1,3}(?:[.,]\d{3}){1,3}\s?(đ|₫)/;
    const cards = [...document.querySelectorAll("a.product-card")];
    return cards
      .map((card) => {
        const name = card.querySelector("p.line-clamp-2, p[class*='line-clamp']")?.textContent?.trim();
        const img = card.querySelector("img");

        const priceLeaves = [...card.querySelectorAll("*")]
          .filter((e) => e.children.length === 0 && priceRe.test(e.textContent || ""))
          .map((e) => e.textContent.trim())
          .filter((t) => !/kèm/i.test(t));
        const priceText = priceLeaves[priceLeaves.length - 1] || null;

        if (!name) return null;
        return {
          name,
          priceText,
          image: img?.getAttribute("src") || null,
          url: card.href,
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
      await page.mouse.wheel(0, 2500);
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
      site: "gearvn",
      category_url: CATEGORY_URL,
      scraped_at: new Date().toISOString(),
      products,
    };

    fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(record, null, 2), "utf-8");
    log("Đã ghi file", OUTPUT_FILE);
  } catch (error) {
    log("LỖI khi cào GearVN", error?.message);
  } finally {
    await browser.close();
  }
}

main();
