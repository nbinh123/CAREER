export function formatMoney(v) {
  return new Intl.NumberFormat("vi-VN").format(v) + "đ";
}
