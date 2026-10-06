/**
 * Escape ký tự đặc biệt của LIKE/ILIKE (%, _, \) trong input người dùng.
 * Không phải SQL injection (giá trị vẫn được bind parameter) nhưng nếu không
 * escape, user gõ "%" hoặc "_" sẽ match mọi dòng → query quét toàn bảng.
 */
export const escapeLike = (value: string): string =>
  value.replace(/[\\%_]/g, (c) => `\\${c}`);

/** `%<escaped>%` dùng cho ILIKE contains. */
export const containsPattern = (value: string): string =>
  `%${escapeLike(value.trim())}%`;
