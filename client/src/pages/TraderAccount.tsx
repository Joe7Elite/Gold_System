import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../api';
import Modal from '../components/ui/Modal';
import Badge from '../components/ui/Badge';
import StatCard from '../components/ui/StatCard';
import { PageLoader } from '../components/ui/Spinner';
import EmptyState from '../components/ui/EmptyState';
import TraderOps, { OpKind, GiveType } from '../components/TraderOps';

type EditModal = 'none' | 'deal' | 'payment' | 'transfer';

export default function TraderAccount() {
  const { id } = useParams();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'all' | 'deals' | 'payments' | 'transfers'>('all');

  // شريط العمليات
  const [opModal, setOpModal] = useState<OpKind>('none');
  const [opInitial, setOpInitial] = useState<any>({});
  const [opGiveType, setOpGiveType] = useState<GiveType>('give');
  const [opId, setOpId] = useState(0);

  // Edit modal state
  const [editModal, setEditModal] = useState<EditModal>('none');
  const [editItem, setEditItem] = useState<any>(null);
  const [form, setForm] = useState<any>({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Traders list for reference
  const [traders, setTraders] = useState<any[]>([]);

  const load = () => {
    setLoading(true);
    api.get(`/traders/${id}/statement`)
      .then((r) => setData(r.data))
      .finally(() => setLoading(false));
  };

  const refresh = () => {
    api.get(`/traders/${id}/statement`).then((r) => setData(r.data));
    api.get('/traders').then((r) => setTraders(r.data));
  };

  const openOp = (kind: OpKind, extra: any = {}, gt?: GiveType) => {
    if (gt) setOpGiveType(gt);
    setOpInitial(extra);
    setOpId((n) => n + 1);
    setOpModal(kind);
  };

  useEffect(() => {
    load();
    api.get('/traders').then((r) => setTraders(r.data));
  }, [id]);

  if (loading) return <PageLoader />;
  if (!data) return (
    <div className="flex items-center justify-center py-20">
      <p className="text-red-500 font-medium">التاجر مش موجود</p>
    </div>
  );

  const { trader, deals, payments, transfers_out, transfers_in, summary } = data;
  const fmt = (n: number) => n?.toLocaleString('ar-EG') ?? '0';
  const fmtW = (n: number) => n?.toLocaleString('ar-EG', { maximumFractionDigits: 2 }) ?? '0';

  // عيار حساب التاجر (21 أو 18)
  const baseK = Number(trader.base_karat) === 18 ? 18 : 21;

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

  // ---- Edit handlers ----
  const openEdit = (item: any) => {
    setEditItem(item);
    setFormError('');
    if (item._type === 'deal') {
      setForm({
        weight: item.original_weight ?? item.weight,
        karat: item.original_karat ?? 21,
        price_per_gram: item.price_per_gram,
        deal_type: item.deal_type ?? 'buy',
        notes: item.notes ?? '',
      });
      setEditModal('deal');
    } else if (item._type === 'payment') {
      setForm({
        amount: item.amount,
        payment_type: item.payment_type ?? 'payment',
        notes: item.notes ?? '',
      });
      setEditModal('payment');
    } else if (item._type === 'transfer_out' || item._type === 'transfer_in') {
      setForm({
        weight: item.original_weight ?? item.weight,
        karat: item.original_karat ?? 21,
        notes: item.notes ?? '',
      });
      setEditModal('transfer');
    }
  };

  const closeEdit = () => {
    setEditModal('none');
    setEditItem(null);
    setForm({});
    setFormError('');
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setSubmitting(true);
    try {
      if (editModal === 'deal') {
        const karat = Number(form.karat) || 21;
        const origWeight = Number(form.weight);
        const weightBase = karat !== baseK ? (origWeight * karat) / baseK : origWeight;
        await api.put(`/transactions/deal/${editItem.id}`, {
          weight: weightBase,
          price_per_gram: Number(form.price_per_gram),
          original_karat: karat,
          original_weight: origWeight,
          deal_type: form.deal_type,
          notes: form.notes || '',
        });
      } else if (editModal === 'payment') {
        await api.put(`/transactions/payment/${editItem.id}`, {
          amount: Number(form.amount),
          payment_type: form.payment_type,
          notes: form.notes || '',
        });
      } else if (editModal === 'transfer') {
        const karat = Number(form.karat) || 21;
        const origWeight = Number(form.weight);
        // السيرفر بيحسب وزن كل تاجر بعيار حسابه
        await api.put(`/transactions/transfer/${editItem.id}`, {
          weight: origWeight,
          original_karat: karat,
          original_weight: origWeight,
          notes: form.notes || '',
        });
      }
      closeEdit();
      load();
    } catch (err: any) {
      setFormError(err.response?.data?.error || 'حصل مشكلة');
    } finally {
      setSubmitting(false);
    }
  };

  // ---- Delete handler ----
  const handleDelete = async (item: any) => {
    const typeLabel =
      item._type === 'deal' ? 'القطع' :
      item._type === 'payment' ? 'الدفعة' :
      'التحويل';
    if (!window.confirm(`هل أنت متأكد من حذف ${typeLabel}؟`)) return;

    const apiType =
      item._type === 'deal' ? 'deal' :
      item._type === 'payment' ? 'payment' :
      'transfer';

    try {
      await api.delete(`/transactions/${apiType}/${item.id}`);
      load();
    } catch (err: any) {
      alert(err.response?.data?.error || 'حصل مشكلة في الحذف');
    }
  };

  // Deal total preview
  const dealTotal = () => {
    const karat = Number(form.karat) || 21;
    const w = Number(form.weight) || 0;
    const p = Number(form.price_per_gram) || 0;
    const wb = karat !== baseK ? (w * karat) / baseK : w;
    return { weight21: wb, total: wb * p };
  };

  // Badge resolver for timeline items
  const getItemBadge = (item: any) => {
    if (item._type === 'deal') {
      if (item.deal_type === 'sell') return <Badge label="بيع" color="orange" />;
      if (item.deal_type === 'work') return <Badge label="شغل" color="red" />;
      if (item.deal_type === 'give') return <Badge label="لوجوهات" color="pink" />;
      if (item.deal_type === 'give_scrap') return <Badge label="كسر" color="pink" />;
      if (item.deal_type === 'give_local_bar') return <Badge label="سبيكة بلدي" color="yellow" />;
      return <Badge label="شراء" color="amber" />;
    }
    if (item._type === 'payment') {
      if (item.payment_type === 'loan') return <Badge label="سلفة" color="red" />;
      return <Badge label="دفع فلوس" color="green" />;
    }
    if (item._type === 'transfer_out') return <Badge label="تحويل صادر" color="blue" />;
    if (item._type === 'transfer_in') return <Badge label="تحويل وارد" color="purple" />;
    return null;
  };

  return (
    <div className="pb-4">
      {/* Header */}
      <div className="mb-5">
        <div className="flex items-center gap-2 mb-1">
          <Link
            to={trader.is_pinned ? '/saber' : '/traders'}
            className="text-stone-400 hover:text-stone-600 text-sm transition-colors"
          >
            {trader.is_pinned ? 'صابر فوده ←' : 'التجار ←'}
          </Link>
        </div>
        <h1 className="text-xl md:text-2xl font-bold text-stone-800">
          {trader.name}
          {baseK === 18 && (
            <span className="ms-2 align-middle inline-block text-xs font-semibold px-2 py-1 rounded-lg bg-amber-100 text-amber-800">
              عيار 18
            </span>
          )}
        </h1>
        {trader.phone && (
          <p className="text-stone-400 text-sm mt-1">تليفون: {trader.phone}</p>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <StatCard
          title="رصيد الفلوس"
          value={`${fmt(Math.abs(summary.money_balance))} ج`}
          color={summary.money_balance > 0 ? 'text-red-600' : summary.money_balance < 0 ? 'text-emerald-600' : 'text-stone-400'}
          sub={summary.money_balance > 0 ? 'عليك' : summary.money_balance < 0 ? 'ليك' : 'مفيش رصيد'}
          iconBg={summary.money_balance > 0 ? 'bg-red-50' : summary.money_balance < 0 ? 'bg-emerald-50' : 'bg-stone-100'}
          icon={
            <svg className={`w-6 h-6 ${summary.money_balance > 0 ? 'text-red-500' : summary.money_balance < 0 ? 'text-emerald-500' : 'text-stone-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
        <StatCard
          title="رصيد الدهب"
          value={`${fmtW(Math.abs(summary.gold_balance))} جم`}
          color={summary.gold_balance > 0 ? 'text-emerald-600' : summary.gold_balance < 0 ? 'text-red-600' : 'text-stone-400'}
          sub={summary.gold_balance > 0 ? 'ليك' : summary.gold_balance < 0 ? 'عليك' : 'مفيش رصيد'}
          iconBg="bg-amber-50"
          icon={
            <svg className="w-6 h-6 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          }
        />
      </div>

      {/* ===== شريط العمليات ===== */}
      <div className="card p-3 mb-5">
        <p className="text-xs font-semibold text-stone-400 mb-2 px-1">عمليات جديدة</p>
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
          {!trader.is_pinned && (
            <OpBtn
              label="قطع"
              primary
              onClick={() => openOp('deal', { trader_id: trader.id, _locked: true, original_karat: String(baseK) })}
            />
          )}
          <OpBtn
            label="استلام شغل"
            primary={trader.is_pinned}
            onClick={() => openOp('work', { trader_id: trader.id, _locked: true, original_karat: String(baseK) })}
          />
          <OpBtn
            label="إدي"
            onClick={() =>
              openOp(
                'give',
                { trader_id: trader.id, _locked: true, original_karat: String(baseK) },
                trader.is_pinned ? 'give_scrap' : 'give'
              )
            }
          />
          <OpBtn
            label="فلوس"
            onClick={() => openOp('payment', { trader_id: trader.id, _locked: true })}
          />
          {!trader.is_pinned && (
            <OpBtn
              label="تحويل"
              onClick={() =>
                openOp('transfer', {
                  from_trader_id: trader.id,
                  _lockedFrom: true,
                  original_karat: String(baseK),
                })
              }
            />
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-4">
        <div className="bg-stone-100 rounded-xl p-1 inline-flex gap-1">
          {([
            { key: 'all', label: `الكل (${timeline.length})` },
            { key: 'deals', label: `قطوعات (${deals.length})` },
            { key: 'payments', label: `مدفوعات (${payments.length})` },
            { key: 'transfers', label: `تحويلات (${transfers_out.length + transfers_in.length})` },
          ] as const).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`px-4 py-2 text-sm transition-all rounded-lg ${
                tab === key
                  ? 'bg-white shadow-sm text-stone-800 font-semibold'
                  : 'text-stone-500 hover:text-stone-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Desktop Timeline Table */}
      <div className="hidden md:block card overflow-hidden">
        <table className="w-full min-w-[700px] text-sm">
          <thead>
            <tr className="bg-stone-50/80">
              <th className="px-4 py-3 text-right uppercase text-xs tracking-wide text-stone-500 font-medium">النوع</th>
              <th className="px-4 py-3 text-right uppercase text-xs tracking-wide text-stone-500 font-medium">التفاصيل</th>
              <th className="px-4 py-3 text-right uppercase text-xs tracking-wide text-stone-500 font-medium">القيمة</th>
              <th className="px-4 py-3 text-right uppercase text-xs tracking-wide text-stone-500 font-medium">بواسطة</th>
              <th className="px-4 py-3 text-right uppercase text-xs tracking-wide text-stone-500 font-medium">التاريخ</th>
              <th className="px-4 py-3 text-right uppercase text-xs tracking-wide text-stone-500 font-medium">إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {filteredTimeline.length === 0 ? (
              <tr>
                <td colSpan={6}>
                  <EmptyState icon="📋" title="لا توجد عمليات" />
                </td>
              </tr>
            ) : (
              filteredTimeline.map((item: any, i: number) => (
                <tr key={`${item._type}-${item.id}-${i}`} className="border-t border-stone-50 hover:bg-gold-50/30 transition-colors">
                  <td className="px-4 py-3">
                    {getItemBadge(item)}
                  </td>
                  <td className="px-4 py-3 text-stone-600">
                    {item._type === 'deal' && (
                      <span>
                        {fmtW(item.weight)} جم × {fmt(item.price_per_gram)} ج
                        {item.original_karat !== baseK && (
                          <span className="text-stone-400"> (أصل: {fmtW(item.original_weight)} جم عيار {item.original_karat})</span>
                        )}
                        {item.notes ? <span className="block text-xs text-stone-400">{item.notes}</span> : null}
                      </span>
                    )}
                    {item._type === 'payment' && (
                      <span>{item.notes || (item.payment_type === 'loan' ? 'سلفة' : 'دفعة نقدية')}</span>
                    )}
                    {item._type === 'transfer_out' && (
                      <span>
                        تحويل لـ {item.to_trader_name} - {fmtW(item.weight)} جم
                        {item.notes ? <span className="block text-xs text-stone-400">{item.notes}</span> : null}
                      </span>
                    )}
                    {item._type === 'transfer_in' && (
                      <span>
                        استلام من {item.from_trader_name} - {fmtW(item.to_weight ?? item.weight)} جم
                        {item.notes ? <span className="block text-xs text-stone-400">{item.notes}</span> : null}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-bold text-sm">
                    {item._type === 'deal' && item.deal_type === 'buy' && (
                      <span className="text-red-600">{fmt(item.total_amount)} ج <span className="text-xs font-normal">عليك</span></span>
                    )}
                    {item._type === 'deal' && item.deal_type === 'sell' && (
                      <span className="text-emerald-600">{fmt(item.total_amount)} ج <span className="text-xs font-normal">ليك</span></span>
                    )}
                    {item._type === 'deal' && item.deal_type === 'work' && (
                      <div><span className="text-red-600">{fmtW(item.weight)} جم <span className="text-xs font-normal">عليك</span></span>{item.total_amount > 0 && <span className="text-red-500 text-xs block">{fmt(item.total_amount)} ج مصنعية عليك</span>}</div>
                    )}
                    {item._type === 'deal' && item.deal_type === 'give' && (
                      <span className="text-emerald-600">{fmtW(item.weight)} جم <span className="text-xs font-normal">ليك</span></span>
                    )}
                    {item._type === 'deal' && item.deal_type === 'give_local_bar' && (
                      <div><span className="text-emerald-600">{fmtW(item.weight)} جم <span className="text-xs font-normal">ليك</span></span>{item.total_amount > 0 && <span className="text-emerald-500 text-xs block">{fmt(item.total_amount)} ج ليك</span>}</div>
                    )}
                    {item._type === 'payment' && item.payment_type === 'loan' && (
                      <span className="text-red-600">{fmt(item.amount)} ج <span className="text-xs font-normal">عليك</span></span>
                    )}
                    {item._type === 'payment' && item.payment_type !== 'loan' && (
                      <span className="text-emerald-600">{fmt(item.amount)} ج <span className="text-xs font-normal">ليك</span></span>
                    )}
                    {item._type === 'transfer_out' && (
                      <span className="text-red-600">{fmtW(item.weight)} جم <span className="text-xs font-normal">عليك</span></span>
                    )}
                    {item._type === 'transfer_in' && (
                      <span className="text-emerald-600">{fmtW(item.to_weight ?? item.weight)} جم <span className="text-xs font-normal">ليك</span></span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-stone-400">{item.created_by_name}</td>
                  <td className="px-4 py-3 text-xs text-stone-400 whitespace-nowrap">{item._date}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      {item._type !== 'transfer_in' && (
                        <button
                          onClick={() => openEdit(item)}
                          title="تعديل"
                          className="w-7 h-7 flex items-center justify-center rounded-lg bg-amber-50 text-amber-600 hover:bg-amber-100 transition-colors"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                      )}
                      {item._type !== 'transfer_in' && (
                        <button
                          onClick={() => handleDelete(item)}
                          title="حذف"
                          className="w-7 h-7 flex items-center justify-center rounded-lg bg-red-50 text-red-500 hover:bg-red-100 transition-colors"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      )}
                      {item._type === 'transfer_in' && (
                        <span className="text-xs text-stone-300">—</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile Timeline Cards */}
      <div className="md:hidden space-y-2">
        {filteredTimeline.length === 0 ? (
          <EmptyState icon="📋" title="لا توجد عمليات" />
        ) : (
          filteredTimeline.map((item: any, i: number) => (
            <div key={`mobile-${item._type}-${item.id}-${i}`} className="card p-4 mb-2">
              {/* Top row: Badge + date */}
              <div className="flex items-center justify-between mb-2">
                {getItemBadge(item)}
                <span className="text-xs text-stone-400">{item._date}</span>
              </div>

              {/* Middle: details */}
              <div className="text-sm text-stone-600 mb-3">
                {item._type === 'deal' && (
                  <span>
                    {fmtW(item.weight)} جم × {fmt(item.price_per_gram)} ج
                    {item.original_karat !== baseK && (
                      <span className="text-stone-400"> (أصل: {fmtW(item.original_weight)} جم عيار {item.original_karat})</span>
                    )}
                    {item.notes ? <span className="block text-xs text-stone-400 mt-0.5">{item.notes}</span> : null}
                  </span>
                )}
                {item._type === 'payment' && (
                  <span>{item.notes || (item.payment_type === 'loan' ? 'سلفة' : 'دفعة نقدية')}</span>
                )}
                {item._type === 'transfer_out' && (
                  <span>
                    تحويل لـ {item.to_trader_name} - {fmtW(item.weight)} جم
                    {item.notes ? <span className="block text-xs text-stone-400 mt-0.5">{item.notes}</span> : null}
                  </span>
                )}
                {item._type === 'transfer_in' && (
                  <span>
                    استلام من {item.from_trader_name} - {fmtW(item.to_weight ?? item.weight)} جم
                    {item.notes ? <span className="block text-xs text-stone-400 mt-0.5">{item.notes}</span> : null}
                  </span>
                )}
              </div>

              {/* Bottom row: value + actions */}
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm">
                  {item._type === 'deal' && item.deal_type === 'buy' && (
                    <span className="text-red-600">{fmt(item.total_amount)} ج عليك</span>
                  )}
                  {item._type === 'deal' && item.deal_type === 'sell' && (
                    <span className="text-emerald-600">{fmt(item.total_amount)} ج ليك</span>
                  )}
                  {item._type === 'deal' && item.deal_type === 'work' && (
                    <span className="text-red-600">{fmtW(item.weight)} جم عليك{item.total_amount > 0 ? ` + ${fmt(item.total_amount)} ج` : ''}</span>
                  )}
                  {item._type === 'deal' && item.deal_type === 'give' && (
                    <span className="text-emerald-600">{fmtW(item.weight)} جم ليك</span>
                  )}
                  {item._type === 'deal' && item.deal_type === 'give_local_bar' && (
                    <span className="text-emerald-600">{fmtW(item.weight)} جم ليك{item.total_amount > 0 ? ` + ${fmt(item.total_amount)} ج` : ''}</span>
                  )}
                  {item._type === 'payment' && item.payment_type === 'loan' && (
                    <span className="text-red-600">{fmt(item.amount)} ج عليك</span>
                  )}
                  {item._type === 'payment' && item.payment_type !== 'loan' && (
                    <span className="text-emerald-600">{fmt(item.amount)} ج ليك</span>
                  )}
                  {item._type === 'transfer_out' && (
                    <span className="text-red-600">{fmtW(item.weight)} جم عليك</span>
                  )}
                  {item._type === 'transfer_in' && (
                    <span className="text-emerald-600">{fmtW(item.to_weight ?? item.weight)} جم ليك</span>
                  )}
                </span>
                <div className="flex gap-1">
                  {item._type !== 'transfer_in' && (
                    <button
                      onClick={() => openEdit(item)}
                      title="تعديل"
                      className="w-7 h-7 flex items-center justify-center rounded-lg bg-amber-50 text-amber-600 hover:bg-amber-100 transition-colors"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                  )}
                  {item._type !== 'transfer_in' && (
                    <button
                      onClick={() => handleDelete(item)}
                      title="حذف"
                      className="w-7 h-7 flex items-center justify-center rounded-lg bg-red-50 text-red-500 hover:bg-red-100 transition-colors"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* ===== NEW OPERATION MODAL ===== */}
      {opModal !== 'none' && (
        <TraderOps
          key={opId}
          kind={opModal}
          initial={opInitial}
          traders={traders}
          giveType={opGiveType}
          giveOptions={trader.is_pinned ? ['give_scrap', 'give_local_bar'] : undefined}
          onClose={() => setOpModal('none')}
          onDone={refresh}
        />
      )}

      {/* ===== EDIT MODALS ===== */}

      {/* Edit Deal */}
      {editModal === 'deal' && (
        <Modal title="تعديل القطع" onClose={closeEdit}>
          <form onSubmit={handleEditSubmit} className="space-y-3">
            {formError && (
              <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm">{formError}</div>
            )}
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">نوع العملية</label>
              <div className="flex gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="deal_type"
                    value="buy"
                    checked={form.deal_type === 'buy'}
                    onChange={() => setForm({ ...form, deal_type: 'buy' })}
                    className="accent-amber-600"
                  />
                  <span className="text-sm">شراء (بتاخد منه)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="deal_type"
                    value="sell"
                    checked={form.deal_type === 'sell'}
                    onChange={() => setForm({ ...form, deal_type: 'sell' })}
                    className="accent-orange-600"
                  />
                  <span className="text-sm">بيع (بتديله)</span>
                </label>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input
                type="number"
                step="any"
                placeholder="الوزن (جرام)"
                value={form.weight || ''}
                onChange={(e) => setForm({ ...form, weight: e.target.value })}
                className="input-field"
                required
              />
              <select
                value={form.karat || '21'}
                onChange={(e) => setForm({ ...form, karat: e.target.value })}
                className="input-field"
              >
                <option value="21">عيار 21</option>
                <option value="24">عيار 24 (سبايك)</option>
                <option value="18">عيار 18 (كسر)</option>
                <option value="14">عيار 14</option>
              </select>
            </div>
            <input
              type="number"
              step="any"
              placeholder="سعر الجرام"
              value={form.price_per_gram || ''}
              onChange={(e) => setForm({ ...form, price_per_gram: e.target.value })}
              className="input-field w-full"
              required
            />
            {form.weight && form.price_per_gram && (
              <div className="bg-amber-50 p-3 rounded-xl text-sm space-y-1">
                {Number(form.karat || 21) !== baseK && (
                  <div>الوزن بعيار {baseK}: <b>{dealTotal().weight21.toFixed(2)} جم</b></div>
                )}
                <div>الإجمالي: <b className="text-amber-700">{fmt(Math.round(dealTotal().total))} جنيه</b></div>
              </div>
            )}
            <textarea
              placeholder="ملاحظات"
              value={form.notes || ''}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="input-field w-full"
              rows={2}
            />
            <div className="flex gap-2 pt-2">
              <button type="submit" disabled={submitting} className="btn-primary flex-1">
                {submitting ? 'جاري...' : 'حفظ التعديل'}
              </button>
              <button type="button" onClick={closeEdit} className="btn-secondary flex-1">
                إلغاء
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Edit Payment */}
      {editModal === 'payment' && (
        <Modal title="تعديل الدفعة" onClose={closeEdit}>
          <form onSubmit={handleEditSubmit} className="space-y-3">
            {formError && (
              <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm">{formError}</div>
            )}
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">نوع الدفعة</label>
              <div className="flex gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="payment_type"
                    value="payment"
                    checked={form.payment_type === 'payment'}
                    onChange={() => setForm({ ...form, payment_type: 'payment' })}
                    className="accent-green-600"
                  />
                  <span className="text-sm">دفع فلوس</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="payment_type"
                    value="loan"
                    checked={form.payment_type === 'loan'}
                    onChange={() => setForm({ ...form, payment_type: 'loan' })}
                    className="accent-red-600"
                  />
                  <span className="text-sm">سلفة</span>
                </label>
              </div>
            </div>
            <input
              type="number"
              step="any"
              placeholder="المبلغ (جنيه)"
              value={form.amount || ''}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              className="input-field w-full"
              required
            />
            <textarea
              placeholder="ملاحظات"
              value={form.notes || ''}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="input-field w-full"
              rows={2}
            />
            <div className="flex gap-2 pt-2">
              <button type="submit" disabled={submitting} className="btn-primary flex-1">
                {submitting ? 'جاري...' : 'حفظ التعديل'}
              </button>
              <button type="button" onClick={closeEdit} className="btn-secondary flex-1">
                إلغاء
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Edit Transfer */}
      {editModal === 'transfer' && (
        <Modal title="تعديل التحويل" onClose={closeEdit}>
          {editItem && (
            <div className="bg-blue-50 p-3 rounded-xl text-sm mb-3 text-blue-700">
              {editItem._type === 'transfer_out'
                ? `تحويل لـ ${editItem.to_trader_name}`
                : `استلام من ${editItem.from_trader_name}`}
            </div>
          )}
          <form onSubmit={handleEditSubmit} className="space-y-3">
            {formError && (
              <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm">{formError}</div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <input
                type="number"
                step="any"
                placeholder="الوزن (جرام)"
                value={form.weight || ''}
                onChange={(e) => setForm({ ...form, weight: e.target.value })}
                className="input-field"
                required
              />
              <select
                value={form.karat || '21'}
                onChange={(e) => setForm({ ...form, karat: e.target.value })}
                className="input-field"
              >
                <option value="21">عيار 21</option>
                <option value="24">عيار 24 (سبايك)</option>
                <option value="18">عيار 18 (كسر)</option>
                <option value="14">عيار 14</option>
              </select>
            </div>
            {form.weight && Number(form.karat || 21) !== baseK && (
              <div className="bg-blue-50 p-3 rounded-xl text-sm">
                الوزن بعيار {baseK}:{' '}
                <b>{((Number(form.weight) * Number(form.karat || 21)) / baseK).toFixed(2)} جم</b>
              </div>
            )}
            <textarea
              placeholder="ملاحظات"
              value={form.notes || ''}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="input-field w-full"
              rows={2}
            />
            <div className="flex gap-2 pt-2">
              <button type="submit" disabled={submitting} className="btn-primary flex-1">
                {submitting ? 'جاري...' : 'حفظ التعديل'}
              </button>
              <button type="button" onClick={closeEdit} className="btn-secondary flex-1">
                إلغاء
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

function OpBtn({ label, onClick, primary }: { label: string; onClick: () => void; primary?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`py-2.5 rounded-xl text-sm font-semibold transition-colors ${
        primary
          ? 'bg-amber-600 text-white hover:bg-amber-700'
          : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
      }`}
    >
      {label}
    </button>
  );
}
