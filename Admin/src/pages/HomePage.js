import { ArrowUpRight, DollarSign, Flame, ShoppingCart, TrendingUp, Users } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import StatCard from "../components/StatCard";
import { getData } from "../utils/callAPI";
import { useEffect, useState } from "react";

const fmtVND = n => (n || 0).toLocaleString("vi-VN") + "₫";

export default function HomePage() {
  const [miniRev, setMiniRev] = useState([]);
  const [todayData, setTodayData] = useState({});
  const [topDishes, setTopDishes] = useState([{
    name: "Chưa có dữ liệu",
    sold: 0,
  }]);

  useEffect(() => {
    getData({ url: "/analyst/stats" })
      .then(response => {
        setTodayData(response.data.data);
      })
      .catch(err => console.error("Failed to fetch today's data:", err));
  }, []);

  useEffect(() => {
    getData({ url: "/analyst/week-revenue" })
      .then(response => {
        setMiniRev(response.data.data)
        // setTodayData(response.data.data);
      })
      .catch(err => console.error("Failed to fetch week's data:", err));
  }, []);

  const maxRevenue = Math.max(...miniRev.map(i => i.v), 0);

  const maxYAxis = maxRevenue * 2;

  const ticks = Array.from(
    { length: 6 },
    (_, i) => Math.round((maxYAxis / 5) * i)
  );

  useEffect(() => {
    // Giả sử bạn có một API để lấy dữ liệu doanh thu 7 ngày qua
    getData({ url: "/analyst/top-dishes?period=week" })
      .then(response => {
        const data = response.data.data;
        const filteredData = data.filter(item => item.name !== "Các món khác");
        setTopDishes(filteredData);
      })
      .catch(err => console.error("Failed to fetch top 5 dishes:", err));
  }, []);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-green-900">Tổng quan 7 ngày gần nhất</h1>
        <p className="text-gray-500 text-sm mt-0.5">{new Date().toLocaleDateString("vi-VN", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</p>
      </div>
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard icon={DollarSign} label="Doanh thu" value={fmtVND(todayData?.totalRev)} sub="+12% so với hôm qua" color="green" />
        <StatCard icon={ShoppingCart} label="Số đơn" value={todayData?.totalBills} sub="Đang xử lý: 3" color="blue" />
        <StatCard icon={Users} label="Tổng chi phí" value={fmtVND(todayData?.totalCost)} sub="Giờ cao điểm: 12h" color="amber" />
        <StatCard icon={TrendingUp} label="Bill trung bình" value={fmtVND(todayData?.avgBill)} sub="↑ 8% so với tuần trước" color="rose" />
      </div>
      <div className="grid grid-cols-1 gap-6">
        <div className="bg-white rounded-2xl p-5 border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-gray-700">Doanh thu 7 ngày qua</h3> 
            <span className="text-xs text-green-600 font-semibold flex items-center gap-1"><ArrowUpRight size={14} />+9.4%</span>
          </div>
          <ResponsiveContainer width="100%" height={320}>
            <AreaChart data={miniRev}>
              <defs>
                <linearGradient id="gHome" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0fdf4" />
              <XAxis dataKey="d" tick={{ fontSize: 12, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
              <YAxis
                ticks={ticks}
                domain={[0, maxYAxis]}
                tick={{ fontSize: 11, fill: "#9ca3af" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => {
                  if (v === 0) return "";

                  if (v >= 1_000_000) {
                    return `${(v / 1_000_000).toFixed(1)}M`;
                  }

                  return `${Math.round(v / 1000)}K`;
                }}
              />
              <Tooltip formatter={v => [fmtVND(v), "Doanh thu"]} contentStyle={{ borderRadius: 12, border: "1px solid #dcfce7", fontSize: 12 }} />
              <Area type="monotone" dataKey="v" stroke="#22c55e" strokeWidth={2.5} fill="url(#gHome)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

      </div>
      <div className="bg-white rounded-2xl p-5 border border-gray-100">
        <div className="flex items-center gap-2 mb-4">
          <Flame size={17} className="text-orange-500" />
          <h3 className="font-bold text-gray-700">Bán chạy tuần này</h3>
        </div>
        <div className="space-y-4">
          {topDishes.map((item, i) => {
            // Ưu tiên dùng sold, nếu không có thì dùng value, mặc định là 0
            const currentValue = item?.sold || item?.value || 0;
            // Lấy giá trị lớn nhất từ item đầu tiên để làm mốc 100%
            const maxValue = topDishes[0]?.sold || topDishes[0]?.value || 1;
            // Tính phần trăm width
            const percent = (currentValue / maxValue) * 100;

            return (
              <div key={i} className="flex items-center gap-3">
                {/* <span className="text-2xl">{item.emoji}</span> */}
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between mb-1">
                    <p className="text-sm font-semibold text-gray-700 truncate">{item?.name}</p>
                    <span className="text-xs font-bold text-green-600 ml-2">{currentValue}</span>
                  </div>
                  <div className="h-1.5 bg-green-100 rounded-full">
                    <div
                      className="h-full bg-green-400 rounded-full"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="bg-gradient-to-r from-green-500 via-emerald-500 to-teal-500 rounded-2xl p-6 text-white">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-xl font-black">Menu hôm nay</h3>
            <p className="text-green-100 text-sm mt-1">8 món • 6 danh mục • 7 món đang bán</p>
          </div>
          <span className="bg-white/20 rounded-xl px-3 py-1.5 text-sm font-bold backdrop-blur-sm">Đang mở</span>
        </div>
        {/* <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {cats.map((c, i) => (
            <div key={i} className="bg-white/20 backdrop-blur-sm rounded-xl p-3 text-center">
              <div className="text-3xl mb-1">{c.emoji}</div>
              <p className="text-sm font-bold">{c.cat}</p>
              <p className="text-xs text-green-100">{c.n} món</p>
            </div>
          ))}
        </div> */}
      </div>
    </div>
  );
}
