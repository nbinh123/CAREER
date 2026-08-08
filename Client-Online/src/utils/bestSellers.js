// Food schema không có field "isBestSeller" - ta tự suy ra từ soldCount.
// topN: số món bán chạy nhất muốn đánh dấu trên toàn bộ menu.
export function getBestSellerIds(foods, topN = 3) {
  return new Set(
    [...foods]
      .filter((f) => f.isAvailable)
      .sort((a, b) => b.soldCount - a.soldCount)
      .slice(0, topN)
      .map((f) => f.id || f._id)
  );
}
