import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../api';

type EditModal = 'none' | 'deal' | 'payment' | 'transfer';

export default function TraderAccount() {
  const { id } = useParams();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'all' | 'deals' | 'payments' | 'transfers'>('all');

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

  useEffect(() => {
    load();
    api.get('/traders').then((r) => setTraders(r.data));
  }, [id]);

  if (loading) return <div className="text-center py-10 text-gray-500">جاري التحميل...</div>;
  if (!data) return <div className="text-center py-10 text-red-500">التاجر مش موجود</div>;

  const { trader, deals, payments, transfers_out, transfers_in, summary } = data;
  const fmt = (n: number) => n?.toLocaleString('ar-EG') ?? '0';
  const fmtW = (n: number) => n?.toLocaleString('ar-EG', { maximumFractionDigits: 2 }) ?? '0';

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
        const weight21 = karat !== 21 ? (origWeight * karat) / 21 : origWeight;
        await api.put(`/transactions/deal/${editItem.id}`, {
          weight: weight21,
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
        const weight21 = karat !== 21 ? (origWeight * karat) / 21 : origWeight;
        await api.put(`/transactions/transfer/${editItem.id}`, {
          weight: weight21,
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
    const w21 = karat !== 21 ? (w * karat) / 21 : w;
    return { weight21: w21, total: w21 * p };
  };

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
        <SummaryCard
          title="رصيد الفلوس"
          value={`${fmt(summary.money_balance)} ج`}
          color={summary.money_balance > 0 ? 'text-red-600' : summary.money_balance < 0 ? 'text-green-600' : 'text-gray-400'}
          sub={summary.money_balance > 0 ? 'عليك' : summary.money_balance < 0 ? 'ليك' : 'مفيش رصيد'}
        />
        <SummaryCard
          title="رصيد الدهب"
          value={`${fmtW(summary.gold_balance)} جم`}
          color="text-amber-600"
          sub="عيار 21"
        />
        <SummaryCard
          title="إجمالي المشتريات / المبيعات"
          value={`${fmt(summary.deals_net)} ج`}
          color="text-gray-700"
          sub={`شراء: ${fmtW(summary.total_gold_bought)} جم | بيع: ${fmtW(summary.total_gold_sold)} جم`}
        />
        <SummaryCard
          title="إجمالي المدفوعات"
          value={`${fmt(summary.payments_net)} ج`}
          color="text-green-600"
          sub={`صادر: ${fmtW(summary.total_gold_out)} جم | وارد: ${fmtW(summary.total_gold_in)} جم`}
        />
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 mb-4">
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
              <th className="px-4 py-3 text-right font-medium text-gray-600">إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {filteredTimeline.map((item: any, i: number) => (
              <tr key={`${item._type}-${item.id}-${i}`} className="border-t hover:bg-gray-50">
                <td className="px-4 py-3">
                  <TypeBadge type={item._type} dealType={item.deal_type} paymentType={item.payment_type} />
                </td>
                <td className="px-4 py-3 text-gray-600">
                  {item._type === 'deal' && (
                    <span>
                      {fmtW(item.weight)} جم × {fmt(item.price_per_gram)} ج
                      {item.original_karat !== 21 && (
                        <span className="text-gray-400"> (أصل: {fmtW(item.original_weight)} جم عيار {item.original_karat})</span>
                      )}
                      {item.notes ? <span className="block text-xs text-gray-400">{item.notes}</span> : null}
                    </span>
                  )}
                  {item._type === 'payment' && (
                    <span>{item.notes || (item.payment_type === 'loan' ? 'سلفة' : 'دفعة نقدية')}</span>
                  )}
                  {item._type === 'transfer_out' && (
                    <span>
                      تحويل لـ {item.to_trader_name} - {fmtW(item.weight)} جم
                      {item.notes ? <span className="block text-xs text-gray-400">{item.notes}</span> : null}
                    </span>
                  )}
                  {item._type === 'transfer_in' && (
                    <span>
                      استلام من {item.from_trader_name} - {fmtW(item.weight)} جم
                      {item.notes ? <span className="block text-xs text-gray-400">{item.notes}</span> : null}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 font-bold">
                  {item._type === 'deal' && item.deal_type === 'sell' && (
                    <span className="text-green-600">-{fmt(item.total_amount)} ج</span>
                  )}
                  {item._type === 'deal' && item.deal_type !== 'sell' && (
                    <span className="text-red-600">+{fmt(item.total_amount)} ج</span>
                  )}
                  {item._type === 'payment' && item.payment_type === 'loan' && (
                    <span className="text-red-600">+{fmt(item.amount)} ج</span>
                  )}
                  {item._type === 'payment' && item.payment_type !== 'loan' && (
                    <span className="text-green-600">-{fmt(item.amount)} ج</span>
                  )}
                  {item._type === 'transfer_out' && (
                    <span className="text-blue-600">-{fmtW(item.weight)} جم</span>
                  )}
                  {item._type === 'transfer_in' && (
                    <span className="text-purple-600">+{fmtW(item.weight)} جم</span>
                  )}
                </td>
                <td className="px-4 py-3 text-gray-400 text-xs">{item.created_by_name}</td>
                <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">{item._date}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    {(item._type !== 'transfer_in') && (
                      <button
                        onClick={() => openEdit(item)}
                        className="px-2 py-1 bg-amber-100 text-amber-700 rounded text-xs hover:bg-amber-200 transition-colors"
                      >
                        تعديل
                      </button>
                    )}
                    {(item._type !== 'transfer_in') && (
                      <button
                        onClick={() => handleDelete(item)}
                        className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs hover:bg-red-200 transition-colors"
                      >
                        حذف
                      </button>
                    )}
                    {item._type === 'transfer_in' && (
                      <span className="text-xs text-gray-300">—</span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {filteredTimeline.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center py-8 text-gray-400">لا توجد عمليات</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ===== EDIT MODALS ===== */}
      {editModal !== 'none' && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={closeEdit}
        >
          <div
            className="bg-white rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Edit Deal */}
            {editModal === 'deal' && (
              <>
                <h2 className="text-lg font-bold mb-4">تعديل القطع</h2>
                <form onSubmit={handleEditSubmit} className="space-y-3">
                  {formError && (
                    <div className="bg-red-50 text-red-600 p-2 rounded text-sm">{formError}</div>
                  )}
                  {/* Deal type */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">نوع العملية</label>
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
                      className="px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-amber-500"
                      required
                    />
                    <select
                      value={form.karat || '21'}
                      onChange={(e) => setForm({ ...form, karat: e.target.value })}
                      className="px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-amber-500"
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
                    className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-amber-500"
                    required
                  />
                  {form.weight && form.price_per_gram && (
                    <div className="bg-amber-50 p-3 rounded-lg text-sm space-y-1">
                      {Number(form.karat || 21) !== 21 && (
                        <div>الوزن بعيار 21: <b>{dealTotal().weight21.toFixed(2)} جم</b></div>
                      )}
                      <div>الإجمالي: <b className="text-amber-700">{fmt(Math.round(dealTotal().total))} جنيه</b></div>
                    </div>
                  )}
                  <textarea
                    placeholder="ملاحظات"
                    value={form.notes || ''}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-amber-500"
                    rows={2}
                  />
                  <ModalButtons submitting={submitting} onCancel={closeEdit} label="حفظ التعديل" />
                </form>
              </>
            )}

            {/* Edit Payment */}
            {editModal === 'payment' && (
              <>
                <h2 className="text-lg font-bold mb-4">تعديل الدفعة</h2>
                <form onSubmit={handleEditSubmit} className="space-y-3">
                  {formError && (
                    <div className="bg-red-50 text-red-600 p-2 rounded text-sm">{formError}</div>
                  )}
                  {/* Payment type */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">نوع الدفعة</label>
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
                    className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-amber-500"
                    required
                  />
                  <textarea
                    placeholder="ملاحظات"
                    value={form.notes || ''}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-amber-500"
                    rows={2}
                  />
                  <ModalButtons submitting={submitting} onCancel={closeEdit} label="حفظ التعديل" />
                </form>
              </>
            )}

            {/* Edit Transfer */}
            {editModal === 'transfer' && (
              <>
                <h2 className="text-lg font-bold mb-4">تعديل التحويل</h2>
                {editItem && (
                  <div className="bg-blue-50 p-3 rounded-lg text-sm mb-3 text-blue-700">
                    {editItem._type === 'transfer_out'
                      ? `تحويل لـ ${editItem.to_trader_name}`
                      : `استلام من ${editItem.from_trader_name}`}
                  </div>
                )}
                <form onSubmit={handleEditSubmit} className="space-y-3">
                  {formError && (
                    <div className="bg-red-50 text-red-600 p-2 rounded text-sm">{formError}</div>
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="number"
                      step="any"
                      placeholder="الوزن (جرام)"
                      value={form.weight || ''}
                      onChange={(e) => setForm({ ...form, weight: e.target.value })}
                      className="px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-amber-500"
                      required
                    />
                    <select
                      value={form.karat || '21'}
                      onChange={(e) => setForm({ ...form, karat: e.target.value })}
                      className="px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-amber-500"
                    >
                      <option value="21">عيار 21</option>
                      <option value="24">عيار 24 (سبايك)</option>
                      <option value="18">عيار 18 (كسر)</option>
                      <option value="14">عيار 14</option>
                    </select>
                  </div>
                  {form.weight && Number(form.karat || 21) !== 21 && (
                    <div className="bg-blue-50 p-3 rounded-lg text-sm">
                      الوزن بعيار 21:{' '}
                      <b>{((Number(form.weight) * Number(form.karat || 21)) / 21).toFixed(2)} جم</b>
                    </div>
                  )}
                  <textarea
                    placeholder="ملاحظات"
                    value={form.notes || ''}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-amber-500"
                    rows={2}
                  />
                  <ModalButtons submitting={submitting} onCancel={closeEdit} label="حفظ التعديل" />
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ---- Sub-components ----

function SummaryCard({ title, value, color, sub }: { title: string; value: string; color: string; sub: string }) {
  return (
    <div className="bg-white rounded-xl shadow p-5">
      <div className="text-sm text-gray-500">{title}</div>
      <div className={`text-2xl font-bold mt-1 ${color}`}>{value}</div>
      <div className="text-xs text-gray-400 mt-1">{sub}</div>
    </div>
  );
}

function TypeBadge({
  type,
  dealType,
  paymentType,
}: {
  type: string;
  dealType?: string;
  paymentType?: string;
}) {
  // Determine label and style based on type + sub-type
  if (type === 'deal') {
    if (dealType === 'sell') {
      return (
        <span className="px-2 py-1 rounded text-xs font-medium bg-orange-100 text-orange-700">
          بيع
        </span>
      );
    }
    // default: buy
    return (
      <span className="px-2 py-1 rounded text-xs font-medium bg-amber-100 text-amber-700">
        شراء
      </span>
    );
  }

  if (type === 'payment') {
    if (paymentType === 'loan') {
      return (
        <span className="px-2 py-1 rounded text-xs font-medium bg-red-100 text-red-700">
          سلفة
        </span>
      );
    }
    return (
      <span className="px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-700">
        دفع فلوس
      </span>
    );
  }

  if (type === 'transfer_out') {
    return (
      <span className="px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-700">
        تحويل صادر
      </span>
    );
  }

  if (type === 'transfer_in') {
    return (
      <span className="px-2 py-1 rounded text-xs font-medium bg-purple-100 text-purple-700">
        تحويل وارد
      </span>
    );
  }

  return null;
}

function ModalButtons({
  submitting,
  onCancel,
  label,
}: {
  submitting: boolean;
  onCancel: () => void;
  label: string;
}) {
  return (
    <div className="flex gap-2 pt-2">
      <button
        type="submit"
        disabled={submitting}
        className="flex-1 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg disabled:opacity-50 transition-colors"
      >
        {submitting ? 'جاري...' : label}
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="flex-1 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg transition-colors"
      >
        إلغاء
      </button>
    </div>
  );
}
