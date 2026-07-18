import { useState, useEffect, createContext, useContext } from "react";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell
} from "recharts";
import {
  Home, Package, UtensilsCrossed, ShoppingCart, TrendingUp,
  Plus, Edit2, Trash2, X, Search, Bell, DollarSign, Users,
  Clock, Check, ChefHat, Flame, AlertTriangle, Menu,
  BarChart2, ArrowUpRight, RefreshCw, Filter, Star
} from "lucide-react";

const AppCtx = createContext(null);
const useApp = () => useContext(AppCtx);

// ─── Mock Data ──────────────────────────────────────────
let nextIngId = 9;
let nextFoodId = 9;
let nextOrdId = 1015;

const initIngredients = () => [
  { id:"1", displayOrder:1, ingredientName:"Thịt bò", quantity:5000, smallUnit:"g", largeUnit:"kg", pricePerLargeUnit:280000, expiryDays:3, note:"Bảo quản lạnh", needContinuousRestock:true },
  { id:"2", displayOrder:2, ingredientName:"Mì tươi", quantity:3000, smallUnit:"g", largeUnit:"kg", pricePerLargeUnit:25000, expiryDays:2, note:"", needContinuousRestock:true },
  { id:"3", displayOrder:3, ingredientName:"Rau muống", quantity:2000, smallUnit:"g", largeUnit:"kg", pricePerLargeUnit:12000, expiryDays:1, note:"Mua hằng ngày", needContinuousRestock:true },
  { id:"4", displayOrder:4, ingredientName:"Nước mắm", quantity:5000, smallUnit:"ml", largeUnit:"chai", pricePerLargeUnit:35000, expiryDays:365, note:"", needContinuousRestock:false },
  { id:"5", displayOrder:5, ingredientName:"Đường", quantity:10000, smallUnit:"g", largeUnit:"kg", pricePerLargeUnit:22000, expiryDays:365, note:"", needContinuousRestock:false },
  { id:"6", displayOrder:6, ingredientName:"Hành lá", quantity:500, smallUnit:"g", largeUnit:"kg", pricePerLargeUnit:30000, expiryDays:3, note:"", needContinuousRestock:true },
  { id:"7", displayOrder:7, ingredientName:"Tỏi", quantity:800, smallUnit:"g", largeUnit:"kg", pricePerLargeUnit:45000, expiryDays:14, note:"", needContinuousRestock:false },
  { id:"8", displayOrder:8, ingredientName:"Ớt tươi", quantity:300, smallUnit:"g", largeUnit:"kg", pricePerLargeUnit:40000, expiryDays:7, note:"", needContinuousRestock:true },
];

const initFoods = () => [
  { id:"f1", foodName:"Phở Bò Tái", category:"Phở", costPrice:35000, originalPrice:75000, aiTrainingWeight:0.8, isAvailable:true, emoji:"🍜" },
  { id:"f2", foodName:"Bún Bò Huế", category:"Bún", costPrice:30000, originalPrice:70000, aiTrainingWeight:0.6, isAvailable:true, emoji:"🍲" },
  { id:"f3", foodName:"Cơm Sườn Nướng", category:"Cơm", costPrice:25000, originalPrice:65000, aiTrainingWeight:0.7, isAvailable:true, emoji:"🍱" },
  { id:"f4", foodName:"Mì Xào Hải Sản", category:"Mì", costPrice:40000, originalPrice:80000, aiTrainingWeight:0.5, isAvailable:true, emoji:"🍝" },
  { id:"f5", foodName:"Gỏi Cuốn Tôm", category:"Khai Vị", costPrice:20000, originalPrice:45000, aiTrainingWeight:0.4, isAvailable:true, emoji:"🥗" },
  { id:"f6", foodName:"Nước Chanh Dây", category:"Đồ Uống", costPrice:5000, originalPrice:25000, aiTrainingWeight:0.3, isAvailable:true, emoji:"🧃" },
  { id:"f7", foodName:"Chả Giò", category:"Khai Vị", costPrice:15000, originalPrice:40000, aiTrainingWeight:0.45, isAvailable:false, emoji:"🥟" },
  { id:"f8", foodName:"Bánh Flan", category:"Tráng Miệng", costPrice:8000, originalPrice:30000, aiTrainingWeight:0.35, isAvailable:true, emoji:"🍮" },
];

const seedOrders = () => {
  const statuses = ["COMPLETED","COMPLETED","COMPLETED","CANCELLED","PROCESSING"];
  const methods = ["CASH","BANKING","MOMO","ZALOPAY"];
  const items = [
    [{ foodName:"Phở Bò Tái", quantity:2, unitPrice:75000 },{ foodName:"Nước Chanh Dây", quantity:2, unitPrice:25000 }],
    [{ foodName:"Bún Bò Huế", quantity:1, unitPrice:70000 }],
    [{ foodName:"Cơm Sườn Nướng", quantity:3, unitPrice:65000 },{ foodName:"Gỏi Cuốn Tôm", quantity:2, unitPrice:45000 }],
    [{ foodName:"Mì Xào Hải Sản", quantity:2, unitPrice:80000 }],
    [{ foodName:"Chả Giò", quantity:4, unitPrice:40000 },{ foodName:"Bánh Flan", quantity:2, unitPrice:30000 }],
  ];
  return Array.from({ length:15 }, (_, i) => {
    const its = items[i % items.length];
    const sub = its.reduce((s,x)=>s+x.unitPrice*x.quantity,0);
    return {
      id:`ORD-${1000+i}`, items: its, subtotal: sub,
      discountAmount:0, totalAmount: sub,
      status: statuses[i%statuses.length],
      paymentMethod: methods[i%methods.length],
      isPaid: true,
      createdAt: new Date(Date.now()-i*7200000).toISOString(),
    };
  });
};

const rndBetween = (a,b) => Math.floor(Math.random()*(b-a+1))+a;

const revenueData = {
  day: Array.from({length:15},(_,h)=>({
    label:`${h+7}h`,
    revenue: (h>=4&&h<=6)||(h>=11&&h<=14) ? rndBetween(600000,1200000) : rndBetween(50000,300000),
    orders: (h>=4&&h<=6)||(h>=11&&h<=14) ? rndBetween(8,18) : rndBetween(1,6),
  })),
  week: ["T2","T3","T4","T5","T6","T7","CN"].map(d=>({
    label:d,
    revenue: rndBetween(3000000,8000000),
    orders: rndBetween(40,120),
  })),
  month: Array.from({length:30},(_,i)=>({
    label:`${i+1}`,
    revenue: rndBetween(2000000,9000000),
    orders: rndBetween(30,130),
  })),
};

const topSellers = [
  { name:"Phở Bò Tái", sold:145 },
  { name:"Bún Bò Huế", sold:120 },
  { name:"Cơm Sườn Nướng", sold:98 },
  { name:"Gỏi Cuốn Tôm", sold:87 },
  { name:"Mì Xào Hải Sản", sold:76 },
];

const hourlyCustomers = Array.from({length:15},(_,i)=>({
  hour:`${i+7}h`,
  customers: (i>=4&&i<=6)||(i>=11&&i<=14) ? rndBetween(12,22) : rndBetween(1,8),
  avgBill: rndBetween(55000,130000),
}));

const DAYS_VN = ["T2","T3","T4","T5","T6","T7","CN"];
const heatmapRaw = DAYS_VN.map((_,di)=>
  Array.from({length:15},(_,hi)=>({
    day: di, hour: hi+7,
    val: Math.round(rndBetween(5,100)*((hi>=4&&hi<=6)||(hi>=11&&hi<=14)?1.8:0.5)*(di<5?1:0.7)),
  }))
);

const pidIngredients = [
  { name:"Thịt bò",unit:"g",qCurrent:5000,expected:4500,history:[4200,4400,4600,4500],Kp:0.6,Ki:0.1,Kd:0.05 },
  { name:"Mì tươi",unit:"g",qCurrent:3000,expected:2800,history:[2600,2700,2900,2800],Kp:0.5,Ki:0.08,Kd:0.04 },
  { name:"Rau muống",unit:"g",qCurrent:2000,expected:1800,history:[1600,1700,1850,1800],Kp:0.7,Ki:0.12,Kd:0.06 },
  { name:"Hành lá",unit:"g",qCurrent:500,expected:450,history:[400,420,460,450],Kp:0.5,Ki:0.1,Kd:0.05 },
];

const TABLE_COUNT = 12;
const mkTables = () => Array.from({length:TABLE_COUNT},(_,i)=>({ id:i+1, name:`Bàn ${i+1}`, items:[], status:"empty", since:null }));

// ─── Utilities ──────────────────────────────────────────
const fmtVND = n => (n||0).toLocaleString("vi-VN")+"₫";
const fmtDate = s => new Date(s).toLocaleString("vi-VN",{dateStyle:"short",timeStyle:"short"});

// ─── Shared Components ───────────────────────────────────
function Modal({ open, onClose, title, children, maxW="max-w-lg" }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/25 backdrop-blur-sm" />
      <div className={`relative bg-white rounded-2xl shadow-xl w-full ${maxW} max-h-[90vh] overflow-y-auto`} onClick={e=>e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-green-100">
          <h3 className="text-base font-bold text-green-900">{title}</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-gray-100 transition-colors">
            <X size={16} className="text-gray-400" />
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

function Btn({ children, variant="primary", sm, className="", disabled, ...props }) {
  const base = `inline-flex items-center gap-1.5 font-semibold rounded-xl transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed ${sm?"text-xs px-3 py-1.5":"text-sm px-4 py-2"}`;
  const v = {
    primary:"bg-green-500 hover:bg-green-600 text-white",
    secondary:"bg-green-50 hover:bg-green-100 text-green-700 border border-green-200",
    danger:"bg-red-50 hover:bg-red-100 text-red-600 border border-red-200",
    ghost:"hover:bg-gray-100 text-gray-600",
    outline:"bg-white hover:bg-green-50 text-gray-700 border border-gray-200",
  };
  return <button className={`${base} ${v[variant]||v.primary} ${className}`} disabled={disabled} {...props}>{children}</button>;
}

function FormInput({ label, ...props }) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</label>}
      <input className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-300 focus:border-transparent transition bg-white" {...props} />
    </div>
  );
}

function StatusBadge({ status }) {
  const map = { PENDING:"bg-yellow-100 text-yellow-700", PROCESSING:"bg-blue-100 text-blue-700", COMPLETED:"bg-green-100 text-green-700", CANCELLED:"bg-red-100 text-red-600" };
  const lbl = { PENDING:"Chờ", PROCESSING:"Đang làm", COMPLETED:"Hoàn thành", CANCELLED:"Hủy" };
  return <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${map[status]||"bg-gray-100 text-gray-500"}`}>{lbl[status]||status}</span>;
}

function StatCard({ icon: Icon, label, value, sub, color="green" }) {
  const c = { green:"bg-green-500", blue:"bg-blue-500", amber:"bg-amber-500", rose:"bg-rose-500" };
  return (
    <div className="bg-white rounded-2xl p-5 border border-gray-100 flex items-start gap-4">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${c[color]} text-white`}>
        <Icon size={20} />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-gray-500 font-medium">{label}</p>
        <p className="text-xl font-bold text-gray-800 mt-0.5 truncate">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ─── HOME PAGE ───────────────────────────────────────────
function HomePage() {
  const miniRev = ["T2","T3","T4","T5","T6","T7","CN"].map((d,i)=>({ d, v:rndBetween(3,8)*1000000 }));
  const best = [
    { name:"Phở Bò Tái", sold:32, emoji:"🍜" },
    { name:"Bún Bò Huế", sold:25, emoji:"🍲" },
    { name:"Cơm Sườn Nướng", sold:18, emoji:"🍱" },
    { name:"Gỏi Cuốn Tôm", sold:14, emoji:"🥗" },
  ];
  const cats = [
    { emoji:"🍜", cat:"Phở", n:2 },
    { emoji:"🍲", cat:"Bún & Mì", n:3 },
    { emoji:"🍱", cat:"Cơm", n:2 },
    { emoji:"🥗", cat:"Khai Vị", n:3 },
  ];
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-green-900">Tổng quan hôm nay</h1>
        <p className="text-gray-500 text-sm mt-0.5">{new Date().toLocaleDateString("vi-VN",{weekday:"long",year:"numeric",month:"long",day:"numeric"})}</p>
      </div>
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard icon={DollarSign} label="Doanh thu hôm nay" value={fmtVND(8450000)} sub="+12% so với hôm qua" color="green" />
        <StatCard icon={ShoppingCart} label="Số đơn hôm nay" value="67" sub="Đang xử lý: 3" color="blue" />
        <StatCard icon={Users} label="Lượt khách" value="124" sub="Giờ cao điểm: 12h" color="amber" />
        <StatCard icon={TrendingUp} label="Bill trung bình" value={fmtVND(126119)} sub="↑ 8% so với tuần trước" color="rose" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-2xl p-5 border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-gray-700">Doanh thu 7 ngày qua</h3>
            <span className="text-xs text-green-600 font-semibold flex items-center gap-1"><ArrowUpRight size={14}/>+9.4%</span>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={miniRev}>
              <defs>
                <linearGradient id="gHome" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.25}/>
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0fdf4" />
              <XAxis dataKey="d" tick={{fontSize:12,fill:"#9ca3af"}} axisLine={false} tickLine={false} />
              <YAxis tick={{fontSize:11,fill:"#9ca3af"}} axisLine={false} tickLine={false} tickFormatter={v=>`${v/1000000}M`} />
              <Tooltip formatter={v=>[fmtVND(v),"Doanh thu"]} contentStyle={{borderRadius:12,border:"1px solid #dcfce7",fontSize:12}} />
              <Area type="monotone" dataKey="v" stroke="#22c55e" strokeWidth={2.5} fill="url(#gHome)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-gray-100">
          <div className="flex items-center gap-2 mb-4">
            <Flame size={17} className="text-orange-500" />
            <h3 className="font-bold text-gray-700">Bán chạy hôm nay</h3>
          </div>
          <div className="space-y-4">
            {best.map((item,i)=>(
              <div key={i} className="flex items-center gap-3">
                <span className="text-2xl">{item.emoji}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between mb-1">
                    <p className="text-sm font-semibold text-gray-700 truncate">{item.name}</p>
                    <span className="text-xs font-bold text-green-600 ml-2">{item.sold}</span>
                  </div>
                  <div className="h-1.5 bg-green-100 rounded-full">
                    <div className="h-full bg-green-400 rounded-full" style={{width:`${(item.sold/best[0].sold)*100}%`}} />
                  </div>
                </div>
              </div>
            ))}
          </div>
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
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {cats.map((c,i)=>(
            <div key={i} className="bg-white/20 backdrop-blur-sm rounded-xl p-3 text-center">
              <div className="text-3xl mb-1">{c.emoji}</div>
              <p className="text-sm font-bold">{c.cat}</p>
              <p className="text-xs text-green-100">{c.n} món</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── INGREDIENTS PAGE ────────────────────────────────────
const EMPTY_ING = { displayOrder:0, ingredientName:"", quantity:0, smallUnit:"", largeUnit:"", pricePerLargeUnit:0, expiryDays:0, note:"", needContinuousRestock:false };

function IngredientsPage() {
  const { ingredients, setIngredients } = useApp();
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(EMPTY_ING);
  const [editId, setEditId] = useState(null);
  const [deleteId, setDeleteId] = useState(null);

  const filtered = ingredients.filter(i=>i.ingredientName.toLowerCase().includes(search.toLowerCase()));
  const f = (k,v) => setForm(p=>({...p,[k]:v}));
  const openAdd = () => { setForm(EMPTY_ING); setModal("add"); };
  const openEdit = (ing) => { setForm({...ing}); setEditId(ing.id); setModal("edit"); };
  const closeModal = () => { setModal(null); setEditId(null); };
  const handleSave = () => {
    if (!form.ingredientName.trim()) return;
    if (modal==="add") setIngredients(p=>[...p,{...form,id:String(nextIngId++)}]);
    else setIngredients(p=>p.map(i=>i.id===editId?{...form,id:editId}:i));
    closeModal();
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black text-green-900">Nguyên liệu</h1>
          <p className="text-gray-500 text-sm">{ingredients.length} nguyên liệu trong kho</p>
        </div>
        <Btn onClick={openAdd}><Plus size={15}/>Thêm nguyên liệu</Btn>
      </div>
      <div className="relative">
        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Tìm nguyên liệu..."
          className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-300" />
      </div>
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-green-50 border-b border-green-100">
                {["STT","Tên nguyên liệu","Số lượng","ĐV nhỏ","ĐV lớn","Giá/ĐVL","Hạn SD","Ghi chú","Cần bổ sung",""].map((h,i)=>(
                  <th key={i} className="px-4 py-3 text-left text-xs font-bold text-green-800 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((ing,i)=>(
                <tr key={ing.id} className="border-t border-gray-50 hover:bg-green-50/40 transition-colors">
                  <td className="px-4 py-3 text-gray-400 font-mono text-xs">{ing.displayOrder}</td>
                  <td className="px-4 py-3 font-semibold text-gray-800">{ing.ingredientName}</td>
                  <td className="px-4 py-3 text-right font-mono text-gray-700">{ing.quantity.toLocaleString()}</td>
                  <td className="px-4 py-3 text-gray-500">{ing.smallUnit}</td>
                  <td className="px-4 py-3 text-gray-500">{ing.largeUnit}</td>
                  <td className="px-4 py-3 font-mono text-right text-gray-700">{fmtVND(ing.pricePerLargeUnit)}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${ing.expiryDays<=1?"bg-red-100 text-red-600":ing.expiryDays<=7?"bg-amber-100 text-amber-700":"bg-green-100 text-green-700"}`}>
                      {ing.expiryDays}d
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs max-w-32 truncate">{ing.note||"—"}</td>
                  <td className="px-4 py-3">
                    {ing.needContinuousRestock
                      ? <span className="flex items-center gap-1 text-xs font-semibold text-orange-600"><AlertTriangle size={12}/>Có</span>
                      : <span className="text-xs text-gray-400">Không</span>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1.5">
                      <Btn sm variant="secondary" onClick={()=>openEdit(ing)}><Edit2 size={12}/></Btn>
                      <Btn sm variant="danger" onClick={()=>setDeleteId(ing.id)}><Trash2 size={12}/></Btn>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length===0&&<tr><td colSpan={10} className="text-center py-12 text-gray-400 text-sm">Không tìm thấy nguyên liệu nào</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={!!modal} onClose={closeModal} title={modal==="add"?"Thêm nguyên liệu mới":"Chỉnh sửa nguyên liệu"}>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2"><FormInput label="Tên nguyên liệu *" value={form.ingredientName} onChange={e=>f("ingredientName",e.target.value)} /></div>
          <FormInput label="Số thứ tự" type="number" value={form.displayOrder} onChange={e=>f("displayOrder",+e.target.value)} />
          <FormInput label="Số lượng" type="number" value={form.quantity} onChange={e=>f("quantity",+e.target.value)} />
          <FormInput label="Đơn vị nhỏ" value={form.smallUnit} onChange={e=>f("smallUnit",e.target.value)} />
          <FormInput label="Đơn vị lớn" value={form.largeUnit} onChange={e=>f("largeUnit",e.target.value)} />
          <FormInput label="Giá / ĐVL (₫)" type="number" value={form.pricePerLargeUnit} onChange={e=>f("pricePerLargeUnit",+e.target.value)} />
          <FormInput label="Hạn sử dụng (ngày)" type="number" value={form.expiryDays} onChange={e=>f("expiryDays",+e.target.value)} />
          <div className="col-span-2"><FormInput label="Ghi chú" value={form.note} onChange={e=>f("note",e.target.value)} /></div>
          <div className="col-span-2 flex items-center gap-2 pt-1">
            <input type="checkbox" id="rst" checked={form.needContinuousRestock} onChange={e=>f("needContinuousRestock",e.target.checked)} className="accent-green-500 w-4 h-4 rounded" />
            <label htmlFor="rst" className="text-sm font-medium text-gray-600">Cần bổ sung liên tục</label>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-gray-100">
          <Btn variant="outline" onClick={closeModal}>Hủy</Btn>
          <Btn onClick={handleSave}><Check size={14}/>Lưu thay đổi</Btn>
        </div>
      </Modal>

      <Modal open={!!deleteId} onClose={()=>setDeleteId(null)} title="Xác nhận xóa">
        <p className="text-sm text-gray-600">Bạn có chắc chắn muốn xóa nguyên liệu này? Hành động này không thể hoàn tác.</p>
        <div className="flex justify-end gap-2 mt-5">
          <Btn variant="outline" onClick={()=>setDeleteId(null)}>Hủy</Btn>
          <Btn variant="danger" onClick={()=>{setIngredients(p=>p.filter(i=>i.id!==deleteId));setDeleteId(null);}}><Trash2 size={14}/>Xóa</Btn>
        </div>
      </Modal>
    </div>
  );
}

// ─── MENU PAGE ───────────────────────────────────────────
const CATS = ["Tất cả","Phở","Bún","Cơm","Mì","Khai Vị","Đồ Uống","Tráng Miệng"];
const EMOJIS = ["🍜","🍲","🍱","🍝","🥗","🧃","🥟","🍮","🍛","🥘","🫕","🧆"];
const EMPTY_FOOD = { foodName:"", category:"Phở", costPrice:0, originalPrice:0, aiTrainingWeight:0, isAvailable:true, emoji:"🍜" };

function MenuPage() {
  const { foods, setFoods } = useApp();
  const [catFilter, setCatFilter] = useState("Tất cả");
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(EMPTY_FOOD);
  const [editId, setEditId] = useState(null);

  const filtered = foods.filter(fd=>
    (catFilter==="Tất cả"||fd.category===catFilter) &&
    fd.foodName.toLowerCase().includes(search.toLowerCase())
  );
  const ff = (k,v) => setForm(p=>({...p,[k]:v}));
  const margin = fd => fd.originalPrice>0?Math.round((fd.originalPrice-fd.costPrice)/fd.originalPrice*100):0;

  const openAdd = () => { setForm(EMPTY_FOOD); setModal("add"); };
  const openEdit = fd => { setForm({...fd}); setEditId(fd.id); setModal("edit"); };
  const closeModal = () => { setModal(null); setEditId(null); };
  const handleSave = () => {
    if (!form.foodName.trim()) return;
    if (modal==="add") setFoods(p=>[...p,{...form,id:`f${nextFoodId++}`}]);
    else setFoods(p=>p.map(fd=>fd.id===editId?{...form,id:editId}:fd));
    closeModal();
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black text-green-900">Thực đơn</h1>
          <p className="text-gray-500 text-sm">{foods.length} món • {foods.filter(f=>f.isAvailable).length} đang bán</p>
        </div>
        <Btn onClick={openAdd}><Plus size={15}/>Thêm món mới</Btn>
      </div>
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-44">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Tìm món ăn..."
            className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-300" />
        </div>
        <div className="flex gap-2 flex-wrap">
          {CATS.map(c=>(
            <button key={c} onClick={()=>setCatFilter(c)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${catFilter===c?"bg-green-500 text-white":"bg-white border border-gray-200 text-gray-600 hover:border-green-300 hover:text-green-700"}`}>
              {c}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filtered.map(food=>{
          const m = margin(food);
          return (
            <div key={food.id} className={`bg-white rounded-2xl border overflow-hidden transition-all hover:shadow-md hover:-translate-y-0.5 ${food.isAvailable?"border-gray-100":"border-gray-200 opacity-60"}`}>
              <div className="h-28 bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 flex items-center justify-center text-5xl relative">
                {food.emoji}
                {!food.isAvailable && <div className="absolute inset-0 bg-gray-200/60 flex items-center justify-center"><span className="text-xs font-bold text-gray-500 bg-white rounded-lg px-2 py-1">Tạm nghỉ</span></div>}
              </div>
              <div className="p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h4 className="font-bold text-gray-800 text-sm leading-tight">{food.foodName}</h4>
                  <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 font-semibold ${food.isAvailable?"bg-green-100 text-green-700":"bg-gray-100 text-gray-500"}`}>
                    {food.isAvailable?"Đang bán":"Nghỉ"}
                  </span>
                </div>
                <p className="text-xs text-gray-400 mb-3 font-medium">{food.category}</p>
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Giá bán</span>
                    <span className="font-bold text-green-600">{fmtVND(food.originalPrice)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Giá vốn</span>
                    <span className="text-gray-600">{fmtVND(food.costPrice)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500">Biên LN</span>
                    <div className="flex items-center gap-1.5">
                      <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div style={{width:`${m}%`}} className={`h-full rounded-full ${m>50?"bg-green-400":m>30?"bg-amber-400":"bg-red-400"}`} />
                      </div>
                      <span className={`font-bold ${m>50?"text-green-600":m>30?"text-amber-600":"text-red-500"}`}>{m}%</span>
                    </div>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-gray-50">
                  <Btn sm variant="secondary" className="w-full justify-center" onClick={()=>openEdit(food)}><Edit2 size={12}/>Chỉnh sửa</Btn>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <Modal open={!!modal} onClose={closeModal} title={modal==="add"?"Thêm món mới":"Chỉnh sửa món ăn"}>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide block mb-2">Chọn emoji</label>
            <div className="flex gap-1.5 flex-wrap">
              {EMOJIS.map(e=>(
                <button key={e} onClick={()=>ff("emoji",e)}
                  className={`text-2xl w-10 h-10 rounded-xl transition-all ${form.emoji===e?"bg-green-100 ring-2 ring-green-400":"hover:bg-gray-100"}`}>
                  {e}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><FormInput label="Tên món *" value={form.foodName} onChange={e=>ff("foodName",e.target.value)} /></div>
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wide block mb-1.5">Danh mục</label>
              <select value={form.category} onChange={e=>ff("category",e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-300">
                {CATS.slice(1).map(c=><option key={c}>{c}</option>)}
              </select>
            </div>
            <FormInput label="Giá vốn (₫)" type="number" value={form.costPrice} onChange={e=>ff("costPrice",+e.target.value)} />
            <FormInput label="Giá bán (₫)" type="number" value={form.originalPrice} onChange={e=>ff("originalPrice",+e.target.value)} />
            <FormInput label="Trọng số AI [0–1]" type="number" step="0.01" min="0" max="1" value={form.aiTrainingWeight} onChange={e=>ff("aiTrainingWeight",+e.target.value)} />
          </div>
          <div className="flex items-center gap-2 pt-1">
            <input type="checkbox" id="avail" checked={form.isAvailable} onChange={e=>ff("isAvailable",e.target.checked)} className="accent-green-500 w-4 h-4" />
            <label htmlFor="avail" className="text-sm font-medium text-gray-600">Đang bán</label>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-gray-100">
          <Btn variant="outline" onClick={closeModal}>Hủy</Btn>
          <Btn onClick={handleSave}><Check size={14}/>Lưu</Btn>
        </div>
      </Modal>
    </div>
  );
}

// ─── ORDERS PAGE ─────────────────────────────────────────
function OrdersPage() {
  const { foods, orders, setOrders } = useApp();
  const [tables, setTables] = useState(mkTables);
  const [tab, setTab] = useState("tables");
  const [selectedId, setSelectedId] = useState(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [payMethod, setPayMethod] = useState("CASH");
  const [histSearch, setHistSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  useEffect(()=>{
    const iv = setInterval(()=>{
      const avail = foods.filter(f=>f.isAvailable);
      if (!avail.length) return;
      setTables(prev=>{
        const idx = Math.floor(Math.random()*TABLE_COUNT);
        const t = prev[idx];
        if (t.status==="empty"&&Math.random()>0.65) {
          const rf = avail[Math.floor(Math.random()*avail.length)];
          return prev.map((x,i)=>i===idx?{...x,status:"occupied",since:new Date(),items:[{foodId:rf.id,foodName:rf.foodName,unitPrice:rf.originalPrice,quantity:1,emoji:rf.emoji}]}:x);
        }
        return prev;
      });
    },4500);
    return ()=>clearInterval(iv);
  },[foods]);

  const activeTable = selectedId!=null ? tables.find(t=>t.id===selectedId) : null;
  const subtotal = activeTable?.items.reduce((s,i)=>s+i.unitPrice*i.quantity,0)||0;

  const addItem = food => {
    setTables(prev=>prev.map(t=>{
      if (t.id!==selectedId) return t;
      const ex = t.items.find(i=>i.foodId===food.id);
      if (ex) return {...t,items:t.items.map(i=>i.foodId===food.id?{...i,quantity:i.quantity+1}:i)};
      return {...t,status:"occupied",since:t.since||new Date(),items:[...t.items,{foodId:food.id,foodName:food.foodName,unitPrice:food.originalPrice,quantity:1,emoji:food.emoji}]};
    }));
  };
  const removeItem = foodId => {
    setTables(prev=>prev.map(t=>{
      if (t.id!==selectedId) return t;
      const items = t.items.map(i=>i.foodId===foodId?{...i,quantity:i.quantity-1}:i).filter(i=>i.quantity>0);
      return {...t,items,status:items.length?"occupied":"empty",since:items.length?t.since:null};
    }));
  };
  const handleCheckout = () => {
    if (!activeTable||!activeTable.items.length) return;
    const order = {
      id:`ORD-${nextOrdId++}`,tableId:activeTable.id,
      items:activeTable.items.map(i=>({foodName:i.foodName,quantity:i.quantity,unitPrice:i.unitPrice})),
      subtotal,discountAmount:0,totalAmount:subtotal,
      status:"COMPLETED",paymentMethod:payMethod,isPaid:true,
      createdAt:new Date().toISOString(),
    };
    setOrders(p=>[order,...p]);
    setTables(p=>p.map(t=>t.id===selectedId?{...mkTables()[selectedId-1]}:t));
    setCheckoutOpen(false);
    setSelectedId(null);
  };

  const filtHist = orders.filter(o=>{
    const ms = !histSearch||o.id.includes(histSearch)||o.items.some(i=>i.foodName.toLowerCase().includes(histSearch.toLowerCase()));
    const mst = !statusFilter||o.status===statusFilter;
    const d = new Date(o.createdAt);
    const mf = !dateFrom||d>=new Date(dateFrom);
    const mt = !dateTo||d<=new Date(dateTo+"T23:59:59");
    return ms&&mst&&mf&&mt;
  });

  const occupiedCount = tables.filter(t=>t.status==="occupied").length;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black text-green-900">Quản lý Order</h1>
          <p className="text-gray-500 text-sm">{occupiedCount}/{TABLE_COUNT} bàn đang có khách • <span className="text-green-600 font-semibold">●</span> Cập nhật thời gian thực</p>
        </div>
        <div className="flex gap-2">
          {[["tables","Sơ đồ bàn"],["history","Lịch sử đơn"]].map(([k,l])=>(
            <button key={k} onClick={()=>setTab(k)}
              className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${tab===k?"bg-green-500 text-white":"bg-white border border-gray-200 text-gray-600 hover:bg-green-50"}`}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {tab==="tables"?(
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 space-y-4">
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
              {tables.map(t=>{
                const tSub = t.items.reduce((s,i)=>s+i.unitPrice*i.quantity,0);
                const isSelected = t.id===selectedId;
                return (
                  <button key={t.id} onClick={()=>setSelectedId(t.id===selectedId?null:t.id)}
                    className={`rounded-2xl p-4 text-center transition-all border-2 ${isSelected?"border-green-500 bg-green-50":t.status==="occupied"?"border-orange-200 bg-orange-50 hover:border-orange-300":"border-gray-100 bg-white hover:border-green-200 hover:bg-green-50"}`}>
                    <div className={`text-3xl mb-1.5 ${t.status==="empty"?"opacity-25":""}`}>🪑</div>
                    <p className="font-bold text-sm text-gray-700">{t.name}</p>
                    {t.status==="occupied"?(
                      <div className="mt-1">
                        <p className="text-xs font-bold text-orange-600">{t.items.reduce((s,i)=>s+i.quantity,0)} món</p>
                        <p className="text-xs text-orange-500 mt-0.5">{fmtVND(tSub)}</p>
                      </div>
                    ):<p className="text-xs text-gray-400 mt-1">Trống</p>}
                  </button>
                );
              })}
            </div>
            <div className="flex gap-4 text-xs text-gray-500 bg-white rounded-xl px-4 py-3 border border-gray-100">
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded border-2 border-gray-200 bg-white inline-block"/>Trống</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded border-2 border-orange-200 bg-orange-50 inline-block"/>Có khách</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded border-2 border-green-500 bg-green-50 inline-block"/>Đang chọn</span>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 flex flex-col" style={{minHeight:480}}>
            {activeTable?(
              <>
                <div className="px-4 py-3.5 border-b border-gray-100 flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-gray-800">{activeTable.name}</h3>
                    {activeTable.since && <p className="text-xs text-gray-400">{fmtDate(activeTable.since.toISOString())}</p>}
                  </div>
                  <button onClick={()=>setSelectedId(null)} className="text-gray-400 hover:text-gray-600 w-7 h-7 rounded-lg hover:bg-gray-100 flex items-center justify-center"><X size={16}/></button>
                </div>
                <div className="flex-1 p-3 overflow-y-auto space-y-2">
                  {activeTable.items.length===0?(
                    <div className="text-center text-gray-400 py-10">
                      <ChefHat size={32} className="mx-auto mb-2 opacity-25" />
                      <p className="text-sm">Chưa có món nào</p>
                      <p className="text-xs mt-1">Chọn món từ menu bên dưới</p>
                    </div>
                  ):activeTable.items.map(item=>(
                    <div key={item.foodId} className="flex items-center gap-2.5 bg-green-50 rounded-xl p-2.5">
                      <span className="text-xl">{item.emoji}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-gray-700 truncate">{item.foodName}</p>
                        <p className="text-xs text-gray-400">{fmtVND(item.unitPrice)}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={()=>removeItem(item.foodId)} className="w-6 h-6 rounded-lg bg-white border border-gray-200 flex items-center justify-center text-red-500 font-bold hover:bg-red-50 text-sm">−</button>
                        <span className="w-6 text-center text-sm font-bold text-gray-800">{item.quantity}</span>
                        <button onClick={()=>addItem({id:item.foodId,foodName:item.foodName,originalPrice:item.unitPrice,emoji:item.emoji})} className="w-6 h-6 rounded-lg bg-green-500 flex items-center justify-center text-white font-bold text-sm hover:bg-green-600">+</button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="p-3 border-t border-gray-100">
                  <p className="text-xs text-gray-400 font-bold uppercase tracking-wide mb-2">Thêm món</p>
                  <div className="grid grid-cols-2 gap-1 max-h-28 overflow-y-auto">
                    {foods.filter(f=>f.isAvailable).map(food=>(
                      <button key={food.id} onClick={()=>addItem(food)}
                        className="flex items-center gap-1.5 p-1.5 rounded-lg hover:bg-green-50 text-left text-xs text-gray-600 border border-transparent hover:border-green-200 transition-all">
                        <span>{food.emoji}</span><span className="truncate">{food.foodName}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="p-4 border-t border-gray-100 bg-green-50/50 rounded-b-2xl">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-sm font-bold text-gray-700">Tổng cộng</span>
                    <span className="text-xl font-black text-green-600">{fmtVND(subtotal)}</span>
                  </div>
                  <Btn className="w-full justify-center" disabled={!activeTable.items.length} onClick={()=>setCheckoutOpen(true)}>
                    <Check size={15}/>Thanh toán
                  </Btn>
                </div>
              </>
            ):(
              <div className="flex-1 flex items-center justify-center p-8 text-center">
                <div className="text-gray-400">
                  <div className="text-5xl mb-3">🪑</div>
                  <p className="font-semibold text-gray-500 text-sm">Chọn một bàn để bắt đầu</p>
                  <p className="text-xs mt-1">Bàn màu cam đang có khách</p>
                </div>
              </div>
            )}
          </div>
        </div>
      ):(
        <div className="space-y-4">
          <div className="bg-white rounded-2xl p-4 border border-gray-100">
            <div className="flex flex-wrap gap-3">
              <div className="relative flex-1 min-w-44">
                <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input value={histSearch} onChange={e=>setHistSearch(e.target.value)} placeholder="Tìm theo mã đơn, tên món..."
                  className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-300" />
              </div>
              <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)} className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-300 bg-white">
                <option value="">Tất cả trạng thái</option>
                <option value="PENDING">Chờ</option><option value="PROCESSING">Đang làm</option>
                <option value="COMPLETED">Hoàn thành</option><option value="CANCELLED">Đã hủy</option>
              </select>
              <input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)} className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-300 bg-white" />
              <input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)} className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-300 bg-white" />
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-green-50 border-b border-green-100">
                    {["Mã đơn","Món","Tổng tiền","PTTT","Trạng thái","Thời gian"].map((h,i)=>(
                      <th key={i} className="px-4 py-3 text-left text-xs font-bold text-green-800 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtHist.slice(0,50).map(ord=>(
                    <tr key={ord.id} className="border-t border-gray-50 hover:bg-green-50/40 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs font-bold text-gray-600">{ord.id}</td>
                      <td className="px-4 py-3 text-xs text-gray-700 max-w-48 truncate">{ord.items.map(i=>`${i.foodName} ×${i.quantity}`).join(", ")}</td>
                      <td className="px-4 py-3 font-bold text-green-600 text-right whitespace-nowrap">{fmtVND(ord.totalAmount)}</td>
                      <td className="px-4 py-3 text-xs text-gray-500">{ord.paymentMethod}</td>
                      <td className="px-4 py-3"><StatusBadge status={ord.status} /></td>
                      <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">{fmtDate(ord.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filtHist.length===0&&<div className="text-center py-12 text-gray-400 text-sm">Không có đơn nào phù hợp</div>}
            </div>
          </div>
        </div>
      )}

      <Modal open={checkoutOpen} onClose={()=>setCheckoutOpen(false)} title={`Thanh toán — ${activeTable?.name}`}>
        {activeTable&&(
          <>
            <div className="space-y-2 mb-5 bg-green-50 rounded-xl p-4">
              {activeTable.items.map(item=>(
                <div key={item.foodId} className="flex justify-between text-sm">
                  <span className="text-gray-700">{item.emoji} {item.foodName} × {item.quantity}</span>
                  <span className="font-semibold">{fmtVND(item.unitPrice*item.quantity)}</span>
                </div>
              ))}
              <div className="border-t border-green-200 pt-2 mt-2 flex justify-between items-center">
                <span className="font-bold text-gray-700">Tổng cộng</span>
                <span className="font-black text-lg text-green-600">{fmtVND(subtotal)}</span>
              </div>
            </div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Phương thức thanh toán</p>
            <div className="grid grid-cols-2 gap-2">
              {[["CASH","💵 Tiền mặt"],["BANKING","🏦 Chuyển khoản"],["MOMO","🟣 MoMo"],["ZALOPAY","🔵 ZaloPay"]].map(([m,l])=>(
                <button key={m} onClick={()=>setPayMethod(m)}
                  className={`py-3 rounded-xl text-sm font-bold border-2 transition-all ${payMethod===m?"border-green-500 bg-green-50 text-green-700":"border-gray-200 text-gray-600 hover:border-green-200"}`}>
                  {l}
                </button>
              ))}
            </div>
            <div className="flex gap-2 mt-5">
              <Btn variant="outline" className="flex-1 justify-center" onClick={()=>setCheckoutOpen(false)}>Hủy</Btn>
              <Btn className="flex-1 justify-center" onClick={handleCheckout}><Check size={15}/>Xác nhận thanh toán</Btn>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}

// ─── ANALYST PAGE ────────────────────────────────────────
function AnalystPage() {
  const [tf, setTf] = useState("week");
  const [pidRows, setPidRows] = useState(pidIngredients.map(d=>({...d})));

  const data = revenueData[tf];
  const totalRev = data.reduce((s,d)=>s+d.revenue,0);
  const totalOrd = data.reduce((s,d)=>s+d.orders,0);
  const avgBill = totalOrd>0?Math.round(totalRev/totalOrd):0;

  const heatColor = val => {
    if (val<15) return "#f0fdf4";
    if (val<35) return "#bbf7d0";
    if (val<55) return "#4ade80";
    if (val<75) return "#22c55e";
    return "#15803d";
  };

  const calcPID = ing => {
    const e = ing.expected - ing.qCurrent;
    const sumE = ing.history.reduce((s,h)=>s+(ing.expected-h),0)+e;
    const lastE = ing.history.length>0?ing.expected-ing.history[ing.history.length-1]:0;
    return Math.max(0, Math.round(ing.qCurrent + ing.Kp*e + ing.Ki*sumE + ing.Kd*(e-lastE)));
  };
  const updateK = (idx,key,val) => setPidRows(p=>p.map((d,i)=>i===idx?{...d,[key]:parseFloat(val)||0}:d));

  const COLORS = ["#22c55e","#4ade80","#86efac","#bbf7d0","#dcfce7"];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black text-green-900">Phân tích & Thống kê</h1>
          <p className="text-gray-500 text-sm">Tổng quan hoạt động kinh doanh</p>
        </div>
        <div className="flex gap-2 bg-white border border-gray-200 rounded-xl p-1">
          {[["day","Ngày"],["week","Tuần"],["month","Tháng"]].map(([k,l])=>(
            <button key={k} onClick={()=>setTf(k)}
              className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${tf===k?"bg-green-500 text-white":"text-gray-500 hover:text-green-700"}`}>
              {l}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard icon={DollarSign} label={`Doanh thu (${tf==="day"?"hôm nay":tf==="week"?"tuần này":"tháng này"})`} value={fmtVND(totalRev)} color="green" />
        <StatCard icon={ShoppingCart} label="Tổng số đơn" value={totalOrd.toLocaleString()} color="blue" />
        <StatCard icon={Users} label="Bill trung bình" value={fmtVND(avgBill)} color="amber" />
        <StatCard icon={TrendingUp} label="Chi phí nguyên liệu" value={fmtVND(Math.round(totalRev*0.38))} color="rose" />
      </div>

      {/* Revenue chart */}
      <div className="bg-white rounded-2xl p-5 border border-gray-100">
        <h3 className="font-bold text-gray-700 mb-4">Biểu đồ doanh thu & số đơn</h3>
        <ResponsiveContainer width="100%" height={250}>
          <AreaChart data={data} margin={{top:5,right:10,bottom:0,left:0}}>
            <defs>
              <linearGradient id="gRev" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0fdf4" />
            <XAxis dataKey="label" tick={{fontSize:11,fill:"#9ca3af"}} axisLine={false} tickLine={false} interval={tf==="month"?4:0} />
            <YAxis yAxisId="rev" tick={{fontSize:10,fill:"#9ca3af"}} axisLine={false} tickLine={false} tickFormatter={v=>`${(v/1000000).toFixed(1)}M`} />
            <YAxis yAxisId="ord" orientation="right" tick={{fontSize:10,fill:"#9ca3af"}} axisLine={false} tickLine={false} />
            <Tooltip
              formatter={(v,n)=>[n==="revenue"?fmtVND(v):v, n==="revenue"?"Doanh thu":"Số đơn"]}
              contentStyle={{borderRadius:12,border:"1px solid #dcfce7",fontSize:12}} />
            <Legend iconType="circle" iconSize={8} wrapperStyle={{fontSize:12}} />
            <Area yAxisId="rev" type="monotone" dataKey="revenue" name="revenue" stroke="#22c55e" strokeWidth={2.5} fill="url(#gRev)" dot={false} />
            <Line yAxisId="ord" type="monotone" dataKey="orders" name="orders" stroke="#60a5fa" strokeWidth={2} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Top sellers + Hourly */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white rounded-2xl p-5 border border-gray-100">
          <div className="flex items-center gap-2 mb-4">
            <Flame size={16} className="text-orange-500" />
            <h3 className="font-bold text-gray-700">Món bán chạy nhất</h3>
          </div>
          <ResponsiveContainer width="100%" height={210}>
            <BarChart data={topSellers} layout="vertical" margin={{left:0,right:20,top:0,bottom:0}}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0fdf4" horizontal={false} />
              <XAxis type="number" tick={{fontSize:10,fill:"#9ca3af"}} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" tick={{fontSize:11,fill:"#4b5563"}} axisLine={false} tickLine={false} width={115} />
              <Tooltip contentStyle={{borderRadius:12,border:"1px solid #dcfce7",fontSize:12}} />
              <Bar dataKey="sold" name="Số lượng" radius={[0,8,8,0]}>
                {topSellers.map((_,i)=><Cell key={i} fill={COLORS[i%COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-gray-100">
          <div className="flex items-center gap-2 mb-4">
            <Clock size={16} className="text-blue-500" />
            <h3 className="font-bold text-gray-700">Lượng khách & Bill TB theo giờ</h3>
          </div>
          <ResponsiveContainer width="100%" height={210}>
            <BarChart data={hourlyCustomers} margin={{top:0,right:10,bottom:0,left:0}}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0fdf4" vertical={false} />
              <XAxis dataKey="hour" tick={{fontSize:10,fill:"#9ca3af"}} axisLine={false} tickLine={false} />
              <YAxis yAxisId="c" tick={{fontSize:10,fill:"#9ca3af"}} axisLine={false} tickLine={false} />
              <YAxis yAxisId="b" orientation="right" tick={{fontSize:10,fill:"#9ca3af"}} axisLine={false} tickLine={false} tickFormatter={v=>`${Math.round(v/1000)}k`} />
              <Tooltip formatter={(v,n)=>[n==="customers"?v:fmtVND(v),n==="customers"?"Khách":"Bill TB"]} contentStyle={{borderRadius:12,border:"1px solid #dcfce7",fontSize:12}} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{fontSize:12}} />
              <Bar yAxisId="c" dataKey="customers" name="customers" fill="#60a5fa" radius={[4,4,0,0]} />
              <Line yAxisId="b" type="monotone" dataKey="avgBill" name="avgBill" stroke="#f59e0b" strokeWidth={2} dot={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Heatmap */}
      <div className="bg-white rounded-2xl p-5 border border-gray-100">
        <div className="flex items-center gap-2 mb-4">
          <BarChart2 size={16} className="text-purple-500" />
          <h3 className="font-bold text-gray-700">Heatmap doanh thu — giờ × ngày</h3>
        </div>
        <div className="overflow-x-auto">
          <div style={{minWidth:520}}>
            <div className="flex gap-1 ml-8 mb-1">
              {Array.from({length:15},(_,i)=>(
                <div key={i} className="text-center text-xs text-gray-400 font-medium" style={{width:28}}>{i+7}h</div>
              ))}
            </div>
            {heatmapRaw.map((row,di)=>(
              <div key={di} className="flex items-center gap-1 mb-1">
                <div className="text-xs text-gray-500 font-bold text-right mr-1" style={{width:24}}>{DAYS_VN[di]}</div>
                {row.map((cell,hi)=>(
                  <div key={hi} title={`${DAYS_VN[di]} ${cell.hour}h: ${cell.val}`}
                    style={{backgroundColor:heatColor(cell.val),width:28,height:24,borderRadius:6,cursor:"default",flexShrink:0}} />
                ))}
              </div>
            ))}
            <div className="flex items-center gap-2 mt-3 ml-8">
              <span className="text-xs text-gray-400">Thấp</span>
              {["#f0fdf4","#bbf7d0","#4ade80","#22c55e","#15803d"].map(c=>(
                <div key={c} style={{backgroundColor:c,width:20,height:14,borderRadius:4}} />
              ))}
              <span className="text-xs text-gray-400">Cao</span>
            </div>
          </div>
        </div>
      </div>

      {/* PID Ingredient Planning */}
      <div className="bg-white rounded-2xl p-5 border border-gray-100">
        <div className="flex items-center gap-2 mb-1">
          <Package size={16} className="text-green-600" />
          <h3 className="font-bold text-gray-700">Quản lý nguyên liệu cần chuẩn bị — PID Controller</h3>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 mb-4 text-xs text-amber-800 font-mono">
          <strong>Q<sub>sau</sub> = Q<sub>hiện tại</sub> + K<sub>p</sub>·e + K<sub>i</sub>·Σe + K<sub>d</sub>·Δe</strong>
          &nbsp;&nbsp;|&nbsp;&nbsp; e = kỳ vọng − hiện tại &nbsp;|&nbsp; K ∈ [0, 1]
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-green-50 border-b border-green-100 text-xs font-bold text-green-800">
                <th className="px-3 py-2.5 text-left">Nguyên liệu</th>
                <th className="px-3 py-2.5 text-right">Q hiện tại</th>
                <th className="px-3 py-2.5 text-right">Kỳ vọng</th>
                <th className="px-3 py-2.5 text-center">K<sub>p</sub></th>
                <th className="px-3 py-2.5 text-center">K<sub>i</sub></th>
                <th className="px-3 py-2.5 text-center">K<sub>d</sub></th>
                <th className="px-3 py-2.5 text-right">Q cần chuẩn bị</th>
                <th className="px-3 py-2.5 text-center">Chênh lệch</th>
              </tr>
            </thead>
            <tbody>
              {pidRows.map((ing,idx)=>{
                const qNext = calcPID(ing);
                const diff = qNext - ing.qCurrent;
                return (
                  <tr key={idx} className="border-t border-gray-50 hover:bg-green-50/40 transition-colors">
                    <td className="px-3 py-3 font-semibold text-gray-800">{ing.name} <span className="text-xs text-gray-400 font-normal">({ing.unit})</span></td>
                    <td className="px-3 py-3 text-right font-mono text-gray-700">{ing.qCurrent.toLocaleString()}</td>
                    <td className="px-3 py-3 text-right font-mono text-gray-500">{ing.expected.toLocaleString()}</td>
                    {["Kp","Ki","Kd"].map(k=>(
                      <td key={k} className="px-3 py-3 text-center">
                        <input type="number" step="0.01" min="0" max="1" value={ing[k]}
                          onChange={e=>updateK(idx,k,e.target.value)}
                          className="w-16 text-center border border-gray-200 rounded-lg px-1 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-green-300" />
                      </td>
                    ))}
                    <td className="px-3 py-3 text-right font-black text-green-700 font-mono text-base">{qNext.toLocaleString()}</td>
                    <td className="px-3 py-3 text-center">
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${diff>0?"bg-orange-100 text-orange-600":diff<0?"bg-green-100 text-green-600":"bg-gray-100 text-gray-500"}`}>
                        {diff>0?`+${diff.toLocaleString()}`:diff===0?"Đủ":diff.toLocaleString()}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── SIDEBAR ─────────────────────────────────────────────
const NAV = [
  { path:"/", label:"Tổng quan", icon:Home },
  { path:"/ingredients", label:"Nguyên liệu", icon:Package },
  { path:"/menu", label:"Thực đơn", icon:UtensilsCrossed },
  { path:"/orders", label:"Order", icon:ShoppingCart },
  { path:"/analyst", label:"Phân tích", icon:TrendingUp },
];

function Sidebar({ page, setPage, mobileOpen, setMobileOpen }) {
  return (
    <>
      {mobileOpen&&<div className="fixed inset-0 z-30 bg-black/20 lg:hidden" onClick={()=>setMobileOpen(false)} />}
      <aside className={`fixed inset-y-0 left-0 z-40 w-56 bg-white border-r border-gray-100 flex flex-col transition-transform duration-300 lg:translate-x-0 lg:relative lg:flex ${mobileOpen?"translate-x-0":"-translate-x-full"}`}>
        <div className="p-5 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-green-400 to-emerald-600 rounded-xl flex items-center justify-center text-white text-xl">🍜</div>
            <div>
              <p className="font-black text-green-900 text-sm leading-tight">NhàHàng Pro</p>
              <p className="text-xs text-gray-400">Quản lý quán ăn</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {NAV.map(({path,label,icon:Icon})=>(
            <button key={path} onClick={()=>{setPage(path);setMobileOpen(false);}}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-all ${page===path?"bg-green-500 text-white":"text-gray-600 hover:bg-green-50 hover:text-green-700"}`}>
              <Icon size={18} strokeWidth={page===path?2.5:2} />
              {label}
            </button>
          ))}
        </nav>
        <div className="p-4 border-t border-gray-100">
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <span className="w-2 h-2 rounded-full bg-green-400 inline-block" style={{animation:"pulse 2s infinite"}} />
            Kết nối thời gian thực
          </div>
        </div>
      </aside>
    </>
  );
}

// ─── BOTTOM NAV (mobile) ─────────────────────────────────
function BottomNav({ page, setPage }) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 flex lg:hidden z-20">
      {NAV.map(({path,label,icon:Icon})=>(
        <button key={path} onClick={()=>setPage(path)}
          className={`flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-xs font-semibold transition-all ${page===path?"text-green-600":"text-gray-400"}`}>
          <Icon size={19} strokeWidth={page===path?2.5:1.8} />
          <span className="text-xs leading-tight" style={{fontSize:10}}>{label}</span>
        </button>
      ))}
    </nav>
  );
}

// ─── APP ─────────────────────────────────────────────────
export default function App() {
  const [page, setPage] = useState("/");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [ingredients, setIngredients] = useState(initIngredients);
  const [foods, setFoods] = useState(initFoods);
  const [orders, setOrders] = useState(seedOrders);

  const PAGE_MAP = { "/":HomePage, "/ingredients":IngredientsPage, "/menu":MenuPage, "/orders":OrdersPage, "/analyst":AnalystPage };
  const PageComp = PAGE_MAP[page]||HomePage;

  return (
    <AppCtx.Provider value={{ ingredients, setIngredients, foods, setFoods, orders, setOrders }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800;900&display=swap');
        *{font-family:'Nunito',sans-serif;}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}
        ::-webkit-scrollbar{width:4px;height:4px}
        ::-webkit-scrollbar-track{background:transparent}
        ::-webkit-scrollbar-thumb{background:#d1fae5;border-radius:9999px}
      `}</style>
      <div className="flex h-screen bg-gray-50 overflow-hidden">
        <Sidebar page={page} setPage={setPage} mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <header className="bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3 flex-shrink-0">
            <button className="lg:hidden text-gray-500 hover:text-green-600 w-9 h-9 rounded-xl hover:bg-green-50 flex items-center justify-center" onClick={()=>setMobileOpen(true)}>
              <Menu size={20} />
            </button>
            <div className="hidden sm:flex items-center gap-2 text-sm text-gray-500">
              <span className="text-gray-300">/</span>
              <span className="font-bold text-gray-700">{NAV.find(n=>n.path===page)?.label}</span>
            </div>
            <div className="flex items-center gap-3 ml-auto">
              <button className="relative w-9 h-9 rounded-xl bg-green-50 flex items-center justify-center text-green-600 hover:bg-green-100 transition-colors">
                <Bell size={17} />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-400 rounded-full" />
              </button>
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center text-white text-sm font-black">A</div>
                <div className="hidden sm:block">
                  <p className="text-xs font-bold text-gray-700 leading-tight">Admin</p>
                  <p className="text-xs text-gray-400">Chủ quán</p>
                </div>
              </div>
            </div>
          </header>
          <main className="flex-1 overflow-y-auto p-4 sm:p-6 pb-20 lg:pb-6">
            <PageComp />
          </main>
        </div>
      </div>
      <BottomNav page={page} setPage={setPage} />
    </AppCtx.Provider>
  );
}