import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../api';

export default function TraderAccount() {
  const { id } = useParams();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'all' | 'deals' | 'payments' | 'transfers'>('all');

  useEffect(() => {
    api.get(`/traders/${id}/statement`).then((r) => setData(r.data)).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="text-center py-10 text-gray-500">جاري التحميل...</div>;
  if (!data) return <div className="text-center py-10 text-red-500">التاجر مش موجود</div>;

  const { trader, deals, payments, transfers_out, transfers_in, summary } = data;
  const fmt = (n: number) => n.toLocaleString('ar-EG');
  const fmtW = (n: number) => n.toLocaleString('ar-EG', { maximumFractionDigits: 2 });

  // Build unified timeline
  const timeline = [
    ...deals.map((d: any) => ({ ...d, _type: 'deal', _date: d.created_at, _sort: new Date(d.created_at).getTime() })),
    ...payments.map((p: any) => ({ ...p, _type: 'payment', _date: p.created_at, _sort: new Date(p.created_at).getTime() })),
    ...transfers_out.map((t: any) => ({ ...t, _type: 'transfer_out', _date: t.created_at, _sort: new Date(t.created_at).getTime() })),
    ...transfers_in.map((t: any) => ({ ...t, _type: 'transfer_in', _date: t.created_at, _sort: new Date(t.created_at).getTime() })),
  ].sort((a, b) => b._sort - a._sort);

  const filteredTimeline = tab === 'all' ? timeline :
    tab === 'deals' ? timeline.filter((t) => t._type === 'deal') :
    tab === 'payments' ? timeline.filter((t) => t._type === 'payment') :
    timeline.filter((t) => t._type === 'transfer_out' || t._type === 'transfer_in');

  const tabClass = (t: string) =>
    `px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === t ? 'bg-amber-600 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'}`;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link to="/traders" className="text-gray-400 hover:text-gray-600">&rarr; التجار</Link>
        <h1 className="text-2xl font-bold text-gray-800">كشف حساب: {trader.name}</h1>
      </div>

      {trader.phone && <p className="text-gray-500 mb-4 -mt-4">تليفون: {trader.phone}</p>}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <SummaryCard title="رصيد الفلوس" value={`${fmt(summary.money_balance)} ج`}
          color={summary.money_balance > 0 ? 'text-red-600' : summary.money_balance < 0 ? 'text-green-600' : 'text-gray-400'}
          sub={summary.money_balance > 0 ? 'عليك' : summary.money_balance < 0 ? 'ليك' : 'مفيش رصيد'} />
        <SummaryCard title="رصيد الدهب" value={`${fmtW(summary.gold_balance)} جم`} color="text-amber-600" sub="عيار 21" />
        <SummaryCard title="إجمالي القطوعات" value={`${fmt(summary.total_deals)} ج`} color="text-gray-700" sub={`${fmtW(summary.total_gold_bought)} جم`} />
        <SummaryCard title="إجمالي المدفوعات" value={`${fmt(summary.total_payments)} ج`} color="text-green-600" sub={`تحويلات: ${fmtW(summary.total_gold_out)} جم`} />
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        <button className={tabClass('all')} onClick={() => setTab('all')}>الكل ({timeline.length})</button>
        <button className={tabClass('deals')} onClick={() => setTab('deals')}>قطوعات ({deals.length})</button>
        <button className={tabClass('payments')} onClick={() => setTab('payments')}>مدفوعات ({payments.length})</button>
        <button className={tabClass('transfers')} onClick={() => setTab('transfers')}>تحويلات ({transfers_out.length + transfers_in.length})</button>
      </div>

      {/* Timeline */}
      <div className="bg-white rounded-xl shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-right font-medium text-gray-600">النوع</th>
              <th className="px-4 py-3 text-right font-medium text-gray-600">التفاصيل</th>
              <th className="px-4 py-3 text-right font-medium text-gray-600">القيمة</th>
              <th className="px-4 py-3 text-right font-medium text-gray-600">بواسطة</th>
              <th className="px-4 py-3 text-right font-medium text-gray-600">التاريخ</th>
            </tr>
          </thead>
          <tbody>
            {filteredTimeline.map((item: any, i: number) => (
              <tr key={`${item._type}-${item.id}-${i}`} className="border-t hover:bg-gray-50">
                <td className="px-4 py-3">
                  <TypeBadge type={item._type} />
                </td>
                <td className="px-4 py-3 text-gray-600">
                  {item._type === 'deal' && (
                    <span>{fmtW(item.weight)} جم × {fmt(item.price_per_gram)} ج
                      {item.original_karat !== 21 && <span className="text-gray-400"> (أصل: {fmtW(item.original_weight)} جم عيار {item.original_karat})</span>}
                    </span>
                  )}
                  {item._type === 'payment' && <span>{item.notes || 'دفعة نقدية'}</span>}
                  {item._type === 'transfer_out' && <span>تحويل لـ {item.to_trader_name} - {fmtW(item.weight)} جم</span>}
                  {item._type === 'transfer_in' && <span>استلام من {item.from_trader_name} - {fmtW(item.weight)} جم</span>}
                </td>
                <td className="px-4 py-3 font-bold">
                  {item._type === 'deal' && <span className="text-red-600">+{fmt(item.total_amount)} ج</span>}
                  {item._type === 'payment' && <span className="text-green-600">-{fmt(item.amount)} ج</span>}
                  {item._type === 'transfer_out' && <span className="text-blue-600">-{fmtW(item.weight)} جم</span>}
                  {item._type === 'transfer_in' && <span className="text-purple-600">+{fmtW(item.weight)} جم</span>}
                </td>
                <td className="px-4 py-3 text-gray-400 text-xs">{item.created_by_name}</td>
                <td className="px-4 py-3 text-gray-400 text-xs">{item._date}</td>
              </tr>
            ))}
            {filteredTimeline.length === 0 && (
              <tr><td colSpan={5} className="text-center py-8 text-gray-400">لا توجد عمليات</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SummaryCard({ title, value, color, sub }: { title: string; value: string; color: string; sub: string }) {
  return (
    <div className="bg-white rounded-xl shadow p-5">
      <div className="text-sm text-gray-500">{title}</div>
      <div className={`text-2xl font-bold mt-1 ${color}`}>{value}</div>
      <div className="text-xs text-gray-400 mt-1">{sub}</div>
    </div>
  );
}

function TypeBadge({ type }: { type: string }) {
  const styles: Record<string, string> = {
    deal: 'bg-amber-100 text-amber-700',
    payment: 'bg-green-100 text-green-700',
    transfer_out: 'bg-blue-100 text-blue-700',
    transfer_in: 'bg-purple-100 text-purple-700',
  };
  const labels: Record<string, string> = {
    deal: 'قطع',
    payment: 'دفع فلوس',
    transfer_out: 'تحويل صادر',
    transfer_in: 'تحويل وارد',
  };
  return <span className={`px-2 py-1 rounded text-xs font-medium ${styles[type]}`}>{labels[type]}</span>;
}
