import { useEffect, useState } from 'react';
import api from '../api';

export default function Dashboard() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/dashboard').then((r) => setData(r.data)).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-center py-10 text-gray-500">جاري التحميل...</div>;
  if (!data) return null;

  const { stats, recent } = data;
  const fmt = (n: number) => n.toLocaleString('ar-EG');
  const fmtW = (n: number) => n.toLocaleString('ar-EG', { maximumFractionDigits: 2 });

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">لوحة التحكم</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card title="عدد التجار" value={stats.total_traders} color="text-gray-800" />
        <Card title="رصيد الفلوس (عليك)" value={`${fmt(stats.money_balance)} ج`}
          color={stats.money_balance > 0 ? 'text-red-600' : 'text-green-600'} />
        <Card title="إجمالي الذهب المقطوع" value={`${fmtW(stats.total_gold)} جم`} color="text-amber-600" />
        <Card title="إجمالي التحويلات" value={`${fmtW(stats.total_transfers)} جم`} color="text-blue-600" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <RecentPanel title="آخر القطوعات" bg="bg-amber-50" titleColor="text-amber-800"
          items={recent.deals} renderItem={(d: any) => (
            <div className="flex justify-between items-center text-sm">
              <div>
                <div className="font-medium">{d.trader_name}</div>
                <div className="text-gray-400">{fmtW(d.weight)} جم × {fmt(d.price_per_gram)}</div>
              </div>
              <div className="text-amber-600 font-bold">{fmt(d.total_amount)} ج</div>
            </div>
          )} />
        <RecentPanel title="آخر المدفوعات" bg="bg-green-50" titleColor="text-green-800"
          items={recent.payments} renderItem={(p: any) => (
            <div className="flex justify-between items-center text-sm">
              <div className="font-medium">{p.trader_name}</div>
              <div className="text-green-600 font-bold">{fmt(p.amount)} ج</div>
            </div>
          )} />
        <RecentPanel title="آخر التحويلات" bg="bg-blue-50" titleColor="text-blue-800"
          items={recent.transfers} renderItem={(t: any) => (
            <div className="flex justify-between items-center text-sm">
              <span>من {t.from_name} لـ {t.to_name}</span>
              <span className="text-blue-600 font-bold">{fmtW(t.weight)} جم</span>
            </div>
          )} />
      </div>
    </div>
  );
}

function Card({ title, value, color }: { title: string; value: any; color: string }) {
  return (
    <div className="bg-white rounded-xl shadow p-6">
      <div className="text-sm text-gray-500">{title}</div>
      <div className={`text-2xl font-bold mt-1 ${color}`}>{value}</div>
    </div>
  );
}

function RecentPanel({ title, bg, titleColor, items, renderItem }: any) {
  return (
    <div className="bg-white rounded-xl shadow overflow-hidden">
      <div className={`p-4 border-b ${bg}`}>
        <h2 className={`font-bold ${titleColor}`}>{title}</h2>
      </div>
      <div className="p-4">
        {items.length === 0 ? (
          <p className="text-gray-400 text-center py-4">لا توجد بيانات</p>
        ) : (
          <div className="space-y-3">
            {items.map((item: any, i: number) => (
              <div key={i} className="border-b pb-2 last:border-0">{renderItem(item)}</div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
