// Server tĩnh siêu nhỏ, không cần cài thêm package, chỉ để mở viewer/index.html
// và cho phép nó fetch() các file json trong scraper/output/.
import http from "http";
import fs from "fs";
import path from "path";

const ROOT = path.join(import.meta.dirname, ".."); // playwright_price_tracker/
const PORT = 5173;

const MIME = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json" };

const server = http.createServer((req, res) => {
  let urlPath = req.url.split("?")[0];
  if (urlPath === "/") urlPath = "/viewer/index.html";
  const filePath = path.join(ROOT, urlPath);

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404);
      res.end("Not found: " + urlPath);
      return;
    }
    const ext = path.extname(filePath);
    res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
    res.end(content);
  });
});

server.listen(PORT, () => {
  console.log(`Viewer đang chạy tại: http://localhost:${PORT}`);
});
