// Y hệt bản web (src/utils/bestSellers.js).
export function getBestSellerIds(foods, topN = 3) {
  return new Set(
    [...foods]
      .filter((f) => f.isAvailable)
      .sort((a, b) => b.soldCount - a.soldCount)
      .slice(0, topN)
      .map((f) => f.id || f._id)
  );
}
