// [GIU-NGUYEN] copy nguyên vẹn.
/** Trích tên danh mục dù categoryId là object populate hay string */
export default function extractCatName(cat) {
  if (!cat) return "";
  return typeof cat === "object" ? (cat.name ?? "") : cat;
}
