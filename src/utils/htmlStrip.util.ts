// backend/utils/htmlStrip.ts
import { decode } from "he";

/**
 * Đếm số ký tự nội dung thực tế của một chuỗi HTML.
 * Dùng `he` để decode toàn bộ entity HTML5 (named, numeric, hex) —
 * mô phỏng chính xác hành vi `textContent` của browser, thay vì tự viết
 * regex decode thủ công (dễ thiếu entity khi CKEditor sinh ra do paste
 * nội dung từ Word/Google Docs...).
 *
 * Lưu ý: vẫn dùng regex để bỏ tag (không cần full HTML parser vì input
 * luôn đến từ CKEditor 5, không phải HTML tùy ý từ nguồn không tin cậy).
 * Nếu sau này input HTML có thể đến từ nguồn khác (untrusted), nên cân
 * nhắc dùng jsdom/cheerio để parse DOM thật thay vì regex.
 */
export function stripHtmlToText(html: string): string {
  if (!html) return "";
  const withoutTags = html.replace(/<[^>]*>/g, "");
  const decoded = decode(withoutTags);
  return decoded.replace(/\s+/g, " ").trim();
}

export function stripHtmlLength(html: string): number {
  return stripHtmlToText(html).length;
}