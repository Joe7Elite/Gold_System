import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';

type Modal = 'none' | 'add-trader' | 'deal' | 'payment' | 'transfer';

export default function Traders() {
  const [traders, setTraders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState<Modal>('none');
  const [form, setForm] = useState<any>({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = () => api.get('/traders').then((r) => setTraders(r.data)).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const fmt = (n: number) => n?.toLocaleString('ar-EG') || '0';
  const fmtW = (n: number) => n?.toLocaleString('ar-EG', { maximumFractionDigits: 2 }) || '0';

  const filtered = traders.filter((t) => t.name.includes(search) || t.phone?.includes(search));

  const openModal = (type: Modal, prefill?: any) => {
    setModal(type);
    setForm(prefill || {});
    setFormError('');
  };

  const closeModal = () => { setModal('none'); setForm({}); setFormError(''); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setSubmitting(true);
    try {
      if (modal === 'add-trader') {
        await api.post('/traders', form);
      } else if (modal === 'deal') {
        const karat = Number(form.original_karat) || 21;
        const origWeight = Number(form.weight);
        const weight21 = karat !== 21 ? (origWeight * karat) / 21 : origWeight;
        await api.post('/transactions/deal', {
          trader_id: form.trader_id,
          weight: weight21,
          price_per_gram: Number(form.price_per_gram),
          original_karat: karat,
          original_weight: origWeight,
          notes: form.notes || '',
        });
      } else if (modal === 'payment') {
        await api.post('/transactions/payment', {
          trader_id: form.trader_id,
          amount: Number(form.amount),
          notes: form.notes || '',
        });
      } else if (modal === 'transfer') {
        const karat = Number(form.original_karat) || 21;
        const origWeight = Number(form.weight);
        const weight21 = karat !== 21 ? (origWeight * karat) / 21 : origWeight;
        await api.post('/transactions/transfer', {
          from_trader_id: form.from_trader_id,
          to_trader_id: form.to_trader_id,
          weight: weight21,
          original_karat: karat,
          original_weight: origWeight,
          notes: form.notes || '',
        });
      }
      closeModal();
      load();
    } catch (err: any) {
      setFormError(err.response?.data?.error || 'حصل مشكلة');
    } finally {
      setSubmitting(false);
    }
  };

  // Calculate deal total preview
  const dealTotal = () => {
    const karat = Number(form.original_karat) || 21;
    const w = Number(form.weight) || 0;
    const p = Number(form.price_per_gram) || 0;
    const w21 = karat !== 21 ? (w * karat) / 21 : w;
    return { weight21: w21, total: w21 * p };
  };

  if (loading) return <div className="text-center py-10 text-gray-500">جاري التحميل...</div>;

  return (
    <div>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h1 className="text-2xl font-bold text-gray-800">التجار</h1>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => openModal('add-trader')} className="px-4 py-2 bg-gray-700 hover:bg-gray-800 text-white rounded-lg text-sm">
            + تاجر جديد
          </button>
          <button onClick={() => openModal('deal')} className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm">
            قطع دهب
          </button>
          <button onClick={() => openModal('payment')} className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm">
            دفع فلوس
          </button>
          <button onClick={() => openModal('transfer')} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm">
            تحويل دهب
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="mb-4">
        <input placeholder="بحث بالاسم أو التليفون..." value={search} onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-md px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-amber-500" />
      </div>

      {/* Traders Table */}
      <div className="bg-white rounded-xl shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-right font-medium text-gray-600">الاسم</th>
              <th className="px-4 py-3 text-right font-medium text-gray-600">التليفون</th>
              <th className="px-4 py-3 text-right font-medium text-gray-600">رصيد الفلوس</th>
              <th className="px-4 py-3 text-right font-medium text-gray-600">رصيد الدهب (جم)</th>
              <th className="px-4 py-3 text-right font-medium text-gray-600">إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((t) => (
              <tr key={t.id} className="border-t hover:bg-gray-50">
                <td className="px-4 py-3">
                  <Link to={`/traders/${t.id}`} className="text-amber-700 hover:underline font-medium">{t.name}</Link>
                </td>
                <td className="px-4 py-3 text-gray-500">{t.phone || '-'}</td>
                <td className="px-4 py-3">
                  <span className={`font-bold ${t.money_balance > 0 ? 'text-red-600' : t.money_balance < 0 ? 'text-green-600' : 'text-gray-400'}`}>
                    {fmt(t.money_balance)} ج
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="font-bold text-amber-600">{fmtW(t.gold_balance)} جم</span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    <button onClick={() => openModal('deal', { trader_id: t.id })} className="px-2 py-1 bg-amber-100 text-amber-700 rounded text-xs hover:bg-amber-200">قطع</button>
                    <button onClick={() => openModal('payment', { trader_id: t.id })} className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs hover:bg-green-200">دفع</button>
                    <button onClick={() => openModal('transfer', { from_trader_id: t.id })} className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs hover:bg-blue-200">تحويل</button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={5} className="text-center py-8 text-gray-400">لا يوجد تجار</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ===== MODALS ===== */}
      {modal !== 'none' && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={closeModal}>
          <div className="bg-white rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-auto" onClick={(e) => e.stopPropagation()}>

            {/* Add Trader */}
            {modal === 'add-trader' && (
              <>
                <h2 className="text-lg font-bold mb-4">إضافة تاجر جديد</h2>
                <form onSubmit={handleSubmit} className="space-y-3">
                  {formError && <div className="bg-red-50 text-red-600 p-2 rounded text-sm">{formError}</div>}
                  <input placeholder="اسم التاجر *" value={form.name || ''} onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-amber-500" required />
                  <input placeholder="التليفون" value={form.phone || ''} onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-amber-500" />
                  <input placeholder="العنوان" value={form.address || ''} onChange={(e) => setForm({ ...form, address: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-amber-500" />
                  <textarea placeholder="ملاحظات" value={form.notes || ''} onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-amber-500" rows={2} />
                  <ModalButtons submitting={submitting} onCancel={closeModal} label="إضافة" />
                </form>
              </>
            )}

            {/* Gold Deal (قطع) */}
            {modal === 'deal' && (
              <>
                <h2 className="text-lg font-bold mb-4">قطع دهب</h2>
                <form onSubmit={handleSubmit} className="space-y-3">
                  {formError && <div className="bg-red-50 text-red-600 p-2 rounded text-sm">{formError}</div>}
                  <select value={form.trader_id || ''} onChange={(e) => setForm({ ...form, trader_id: Number(e.target.value) })}
                    className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-amber-500" required>
                    <option value="">اختار التاجر</option>
                    {traders.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                  <div className="grid grid-cols-2 gap-3">
                    <input type="number" step="any" placeholder="الوزن (جرام)" value={form.weight || ''} onChange={(e) => setForm({ ...form, weight: e.target.value })}
                      className="px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-amber-500" required />
                    <select value={form.original_karat || '21'} onChange={(e) => setForm({ ...form, original_karat: e.target.value })}
                      className="px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-amber-500">
                      <option value="21">عيار 21</option>
                      <option value="24">عيار 24 (سبايك)</option>
                      <option value="18">عيار 18 (كسر)</option>
                      <option value="14">عيار 14</option>
                    </select>
                  </div>
                  <input type="number" step="any" placeholder="سعر الجرام" value={form.price_per_gram || ''} onChange={(e) => setForm({ ...form, price_per_gram: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-amber-500" required />
                  {form.weight && form.price_per_gram && (
                    <div className="bg-amber-50 p-3 rounded-lg text-sm space-y-1">
                      {Number(form.original_karat || 21) !== 21 && (
                        <div>الوزن بعيار 21: <b>{dealTotal().weight21.toFixed(2)} جم</b></div>
                      )}
                      <div>الإجمالي: <b className="text-amber-700">{fmt(Math.round(dealTotal().total))} جنيه</b></div>
                    </div>
                  )}
                  <textarea placeholder="ملاحظات" value={form.notes || ''} onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-amber-500" rows={2} />
                  <ModalButtons submitting={submitting} onCancel={closeModal} label="تسجيل القطع" />
                </form>
              </>
            )}

            {/* Cash Payment (دفع فلوس) */}
            {modal === 'payment' && (
              <>
                <h2 className="text-lg font-bold mb-4">دفع فلوس</h2>
                <form onSubmit={handleSubmit} className="space-y-3">
                  {formError && <div className="bg-red-50 text-red-600 p-2 rounded text-sm">{formError}</div>}
                  <select value={form.trader_id || ''} onChange={(e) => setForm({ ...form, trader_id: Number(e.target.value) })}
                    className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-amber-500" required>
                    <option value="">اختار التاجر</option>
                    {traders.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                  <input type="number" step="any" placeholder="المبلغ (جنيه)" value={form.amount || ''} onChange={(e) => setForm({ ...form, amount: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-amber-500" required />
                  <textarea placeholder="ملاحظات" value={form.notes || ''} onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-amber-500" rows={2} />
                  <ModalButtons submitting={submitting} onCancel={closeModal} label="تسجيل الدفع" />
                </form>
              </>
            )}

            {/* Gold Transfer (تحويل دهب) */}
            {modal === 'transfer' && (
              <>
                <h2 className="text-lg font-bold mb-4">تحويل دهب</h2>
                <form onSubmit={handleSubmit} className="space-y-3">
                  {formError && <div className="bg-red-50 text-red-600 p-2 rounded text-sm">{formError}</div>}
                  <select value={form.from_trader_id || ''} onChange={(e) => setForm({ ...form, from_trader_id: Number(e.target.value) })}
                    className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-amber-500" required>
                    <option value="">من تاجر...</option>
                    {traders.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                  <select value={form.to_trader_id || ''} onChange={(e) => setForm({ ...form, to_trader_id: Number(e.target.value) })}
                    className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-amber-500" required>
                    <option value="">لـ تاجر...</option>
                    {traders.filter((t) => t.id !== form.from_trader_id).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                  <div className="grid grid-cols-2 gap-3">
                    <input type="number" step="any" placeholder="الوزن (جرام)" value={form.weight || ''} onChange={(e) => setForm({ ...form, weight: e.target.value })}
                      className="px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-amber-500" required />
                    <select value={form.original_karat || '21'} onChange={(e) => setForm({ ...form, original_karat: e.target.value })}
                      className="px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-amber-500">
                      <option value="21">عيار 21</option>
                      <option value="24">عيار 24 (سبايك)</option>
                      <option value="18">عيار 18 (كسر)</option>
                      <option value="14">عيار 14</option>
                    </select>
                  </div>
                  {form.weight && Number(form.original_karat || 21) !== 21 && (
                    <div className="bg-blue-50 p-3 rounded-lg text-sm">
                      الوزن بعيار 21: <b>{((Number(form.weight) * Number(form.original_karat || 21)) / 21).toFixed(2)} جم</b>
                    </div>
                  )}
                  <textarea placeholder="ملاحظات" value={form.notes || ''} onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-amber-500" rows={2} />
                  <ModalButtons submitting={submitting} onCancel={closeModal} label="تسجيل التحويل" />
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ModalButtons({ submitting, onCancel, label }: { submitting: boolean; onCancel: () => void; label: string }) {
  return (
    <div className="flex gap-2 pt-2">
      <button type="submit" disabled={submitting} className="flex-1 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg disabled:opacity-50">
        {submitting ? 'جاري...' : label}
      </button>
      <button type="button" onClick={onCancel} className="flex-1 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg">إلغاء</button>
    </div>
  );
}
