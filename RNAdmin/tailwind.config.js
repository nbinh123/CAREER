// tailwind.config.js
// Port từ Admin/tailwind.config.js gốc (không có theme custom trong bản gốc,
// nên giữ nguyên default Tailwind palette — đã đủ vì toàn bộ app dùng
// green/emerald/red/amber/blue/rose/gray là các màu có sẵn của Tailwind).
module.exports = {
  content: ["./App.js", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {},
  },
  plugins: [],
};
