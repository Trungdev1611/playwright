import { test } from '@playwright/test';

// Log có cấu trúc đơn giản: luôn có timestamp, dùng được cả khi chạy production thật
function log(step: string, data?: unknown) {
  console.log(`[${new Date().toISOString()}] ${step}`, data ?? '');
}

test('giả lập lỗi, chỉ lưu trace khi fail', async ({ context, page }) => {
  // Bắt đầu ghi trace thủ công (độc lập với trace mặc định của Playwright Test)
  await context.tracing.start({ screenshots: true, snapshots: true });

  try {
    log('step: goto');
    await page.goto('https://playwright.dev/');

    log('step: tìm nút KHÔNG TỒN TẠI -> cố tình gây lỗi');
    // Nút này không có thật trên trang -> click sẽ timeout -> ném lỗi
    await page.getByRole('button', { name: 'Nut Khong Ton Tai ABC' }).click({ timeout: 3000 });

    log('step: xong, không có lỗi gì (sẽ không chạy tới đây)');

    // Thành công -> dừng trace, KHÔNG lưu file (bỏ qua, tiết kiệm dung lượng)
    await context.tracing.stop();
  } catch (err) {
    log('ERROR', (err as Error).message);

    // Thất bại -> dừng trace và LƯU lại để debug sau
    const path = `trace-error-${Date.now()}.zip`;
    await context.tracing.stop({ path });
    log('trace đã lưu tại', path);

    throw err; // vẫn cho test fail như bình thường, không nuốt lỗi
  }
});
