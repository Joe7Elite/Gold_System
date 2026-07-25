import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';

type Modal = 'none' | 'add-trader' | 'deal' | 'payment' | 'transfer' | 'work' | 'give';
type DealType = 'buy' | 'sell';
type PaymentType = 'payment' | 'loan';
type GiveType = 'give' | 'give_local_bar';

export default function Traders() {
  const [traders, setTraders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState<Modal>('none');
  const [form, setForm] = useState<any>({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [dealType, setDealType] = useState<DealType>('buy');
  const [paymentType, setPaymentType] = useState<PaymentType>('payment');
  const [giveType, setGiveType] = useState<GiveType>('give');

  const load = () =>
    api.get('/traders').then((r) => setTraders(r.data)).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const fmt = (n: number) => n?.toLocaleString('ar-EG') || '0';
  const fmtW = (n: number) =>
    n?.toLocaleString('ar-EG', { maximumFractionDigits: 2 }) || '0';

  const filtered = traders.filter(
    (t) => t.name.includes(search) || t.phone?.includes(search)
  );

  const openModal = (type: Modal, prefill?: any) => {
    setModal(type);
    setForm(prefill || {});
    setFormError('');
    setDealType('buy');
    setPaymentType('payment');
    setGiveType('give');
  };

  const closeModal = () => {
    setModal('none');
    setForm({});
    setFormError('');
  };

  // When spike is selected, karat is forced to 24
  const effectiveKarat = Number(form.original_karat || 21);

  // تحويل الوزن لعيار 21
  const toWeight21 = (w: number, karat: number, isFineness: boolean) => {
    if (isFineness) return (w * karat) / 875; // سبيكة بلدي: عيار مثل 750, 817
    return karat !== 21 ? (w * karat) / 21 : w; // عيار عادي: 18, 21, 24
  };

  const dealTotal = () => {
    const karat = effectiveKarat;
    const w = Number(form.weight) || 0;
    const p = Number(form.price_per_gram) || 0;
    const w21 = toWeight21(w, karat, false);
    return { weight21: w21, total: w21 * p };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setSubmitting(true);
    try {
      if (modal === 'add-trader') {
        await api.post('/traders', form);
      } else if (modal === 'deal') {
        const karat = effectiveKarat;
        const origWeight = Number(form.weight);
        const weight21 = toWeight21(origWeight, karat, false);
        await api.post('/transactions/deal', {
          trader_id: form.trader_id,
          weight: weight21,
          price_per_gram: Number(form.price_per_gram),
          original_karat: karat,
          original_weight: origWeight,
          deal_type: dealType,
          notes: form.notes || '',
        });
      } else if (modal === 'work') {
        const karat = effectiveKarat;
        const origWeight = Number(form.weight);
        const weight21 = toWeight21(origWeight, karat, false);
        await api.post('/transactions/deal', {
          trader_id: form.trader_id,
          weight: weight21,
          price_per_gram: 0,
          total_amount: Number(form.craftsmanship) || 0,
          original_karat: karat,
          original_weight: origWeight,
          deal_type: 'work',
          notes: form.notes || '',
        });
      } else if (modal === 'payment') {
        await api.post('/transactions/payment', {
          trader_id: form.trader_id,
          amount: Number(form.amount),
          payment_type: paymentType,
          notes: form.notes || '',
        });
      } else if (modal === 'give') {
        const isLocalBar = giveType === 'give_local_bar';
        const karat = isLocalBar ? Number(form.fineness) : effectiveKarat;
        const origWeight = Number(form.weight);
        const weight21 = toWeight21(origWeight, karat, isLocalBar);
        await api.post('/transactions/deal', {
          trader_id: form.trader_id,
          weight: weight21,
          price_per_gram: 0,
          original_karat: karat,
          original_weight: origWeight,
          deal_type: giveType,
          notes: form.notes || '',
        });
      } else if (modal === 'transfer') {
        const karat = effectiveKarat;
        const origWeight = Number(form.weight);
        const weight21 = toWeight21(origWeight, karat, false);
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

  if (loading)
    return <div className="text-center py-10 text-gray-500">جاري التحميل...</div>;

  return (
    <div>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h1 className="text-xl md:text-2xl font-bold text-gray-800">التجار</h1>
        <div className="flex flex-wrap gap-1.5 md:gap-2">
          <button
            onClick={() => openModal('add-trader')}
            className="px-3 py-1.5 md:px-4 md:py-2 bg-gray-700 hover:bg-gray-800 text-white rounded-lg text-xs md:text-sm font-medium transition-colors"
          >
            + تاجر جديد
          </button>
          <button
            onClick={() => openModal('deal')}
            className="px-3 py-1.5 md:px-4 md:py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs md:text-sm font-medium transition-colors"
          >
            قطع
          </button>
          <button
            onClick={() => openModal('work')}
            className="px-3 py-1.5 md:px-4 md:py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-xs md:text-sm font-medium transition-colors"
          >
            استلام شغل
          </button>
          <button
            onClick={() => openModal('give')}
            className="px-3 py-1.5 md:px-4 md:py-2 bg-pink-500 hover:bg-pink-600 text-white rounded-lg text-xs md:text-sm font-medium transition-colors"
          >
            إدي للتاجر
          </button>
          <button
            onClick={() => openModal('payment')}
            className="px-3 py-1.5 md:px-4 md:py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs md:text-sm font-medium transition-colors"
          >
            عملية فلوس
          </button>
          <button
            onClick={() => openModal('transfer')}
            className="px-3 py-1.5 md:px-4 md:py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs md:text-sm font-medium transition-colors"
          >
            تحويل دهب
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="mb-4">
        <input
          placeholder="بحث بالاسم أو التليفون..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-md px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-amber-500"
        />
      </div>

      {/* Traders Table */}
      <div className="bg-white rounded-xl shadow overflow-x-auto">
        <table className="w-full text-sm min-w-[600px]">
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
                  <Link
                    to={`/traders/${t.id}`}
                    className="text-amber-700 hover:underline font-medium"
                  >
                    {t.name}
                  </Link>
                </td>
                <td className="px-4 py-3 text-gray-500">{t.phone || '-'}</td>
                <td className="px-4 py-3">
                  <span
                    className={`font-bold ${
                      t.money_balance > 0
                        ? 'text-red-600'
                        : t.money_balance < 0
                        ? 'text-green-600'
                        : 'text-gray-400'
                    }`}
                  >
                    {fmt(t.money_balance)} ج
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="font-bold text-amber-600">
                    {fmtW(t.gold_balance)} جم
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    <button
                      onClick={() => openModal('deal', { trader_id: t.id })}
                      className="px-2 py-1 bg-amber-100 text-amber-700 rounded text-xs hover:bg-amber-200 font-medium transition-colors"
                    >
                      قطع
                    </button>
                    <button
                      onClick={() => openModal('work', { trader_id: t.id })}
                      className="px-2 py-1 bg-orange-100 text-orange-700 rounded text-xs hover:bg-orange-200 font-medium transition-colors"
                    >
                      شغل
                    </button>
                    <button
                      onClick={() => openModal('payment', { trader_id: t.id })}
                      className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs hover:bg-green-200 font-medium transition-colors"
                    >
                      دفع
                    </button>
                    <button
                      onClick={() => {
                        openModal('payment', { trader_id: t.id });
                        setPaymentType('loan');
                      }}
                      className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs hover:bg-purple-200 font-medium transition-colors"
                    >
                      سلفة
                    </button>
                    <button
                      onClick={() => openModal('transfer', { from_trader_id: t.id })}
                      className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs hover:bg-blue-200 font-medium transition-colors"
                    >
                      تحويل
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center py-8 text-gray-400">
                  لا يوجد تجار
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ===== MODALS ===== */}
      {modal !== 'none' && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={closeModal}
        >
          <div
            className="bg-white rounded-xl p-4 md:p-6 w-full max-w-lg max-h-[95vh] md:max-h-[90vh] overflow-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >

            {/* ── Add Trader ── */}
            {modal === 'add-trader' && (
              <>
                <h2 className="text-lg font-bold mb-5 text-gray-800">إضافة تاجر جديد</h2>
                <form onSubmit={handleSubmit} className="space-y-3">
                  {formError && (
                    <div className="bg-red-50 border border-red-200 text-red-600 p-3 rounded-lg text-sm">
                      {formError}
                    </div>
                  )}
                  <input
                    placeholder="اسم التاجر *"
                    value={form.name || ''}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-amber-500"
                    required
                  />
                  <input
                    placeholder="التليفون"
                    value={form.phone || ''}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  <input
                    placeholder="العنوان"
                    value={form.address || ''}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  <textarea
                    placeholder="ملاحظات"
                    value={form.notes || ''}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-amber-500"
                    rows={2}
                  />
                  <ModalButtons submitting={submitting} onCancel={closeModal} label="إضافة" />
                </form>
              </>
            )}

            {/* ── قطع (شراء / بيع بسعر) ── */}
            {modal === 'deal' && (
              <>
                <h2 className="text-lg font-bold mb-5 text-gray-800">قطع</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                  {formError && <div className="bg-red-50 border border-red-200 text-red-600 p-3 rounded-lg text-sm">{formError}</div>}

                  <div>
                    <p className="text-sm font-medium text-gray-600 mb-2">نوع القطع</p>
                    <div className="flex gap-2">
                      {([
                        { value: 'buy' as DealType, label: 'شراء (عليك)', active: 'bg-amber-500 text-white', inactive: 'bg-gray-100 text-gray-700 hover:bg-gray-200' },
                        { value: 'sell' as DealType, label: 'بيع (ليك)', active: 'bg-green-500 text-white', inactive: 'bg-gray-100 text-gray-700 hover:bg-gray-200' },
                      ]).map((opt) => (
                        <button key={opt.value} type="button" onClick={() => setDealType(opt.value)}
                          className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${dealType === opt.value ? opt.active : opt.inactive}`}>
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <select value={form.trader_id || ''} onChange={(e) => setForm({ ...form, trader_id: Number(e.target.value) })}
                    className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-amber-500" required>
                    <option value="">اختار التاجر</option>
                    {traders.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>

                  <div className="grid grid-cols-2 gap-3">
                    <input type="number" step="any" min="0" placeholder="الوزن (جرام)" value={form.weight || ''}
                      onChange={(e) => setForm({ ...form, weight: e.target.value })}
                      className="px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-amber-500" required />
                    <select value={form.original_karat || '21'} onChange={(e) => setForm({ ...form, original_karat: e.target.value })}
                      className="px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-amber-500">
                      <option value="21">عيار 21</option>
                      <option value="18">عيار 18</option>
                      <option value="24">عيار 24 (سبايك)</option>
                    </select>
                  </div>

                  <input type="number" step="any" min="0" placeholder="سعر الجرام" value={form.price_per_gram || ''}
                    onChange={(e) => setForm({ ...form, price_per_gram: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-amber-500" required />

                  {form.weight && form.price_per_gram && (
                    <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg text-sm space-y-1">
                      {effectiveKarat !== 21 && (
                        <div className="text-gray-600">الوزن بعيار 21: <span className="font-bold text-amber-800">{dealTotal().weight21.toFixed(3)} جم</span></div>
                      )}
                      <div className="text-gray-600">الإجمالي: <span className="font-bold text-amber-700 text-base">{fmt(Math.round(dealTotal().total))} جنيه</span></div>
                      <div className={`font-medium ${dealType === 'buy' ? 'text-red-600' : 'text-green-600'}`}>
                        {dealType === 'buy' ? '(عليك للتاجر)' : '(ليك من التاجر)'}
                      </div>
                    </div>
                  )}

                  <textarea placeholder="ملاحظات" value={form.notes || ''} onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-amber-500" rows={2} />
                  <ModalButtons submitting={submitting} onCancel={closeModal} label={dealType === 'buy' ? 'تسجيل شراء' : 'تسجيل بيع'} />
                </form>
              </>
            )}

            {/* ── استلام شغل (جرامات + مصنعية) ── */}
            {modal === 'work' && (
              <>
                <h2 className="text-lg font-bold mb-5 text-gray-800">استلام شغل</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                  {formError && <div className="bg-red-50 border border-red-200 text-red-600 p-3 rounded-lg text-sm">{formError}</div>}

                  <select value={form.trader_id || ''} onChange={(e) => setForm({ ...form, trader_id: Number(e.target.value) })}
                    className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-orange-500" required>
                    <option value="">اختار التاجر</option>
                    {traders.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>

                  <div className="grid grid-cols-2 gap-3">
                    <input type="number" step="any" min="0" placeholder="الوزن (جرام)" value={form.weight || ''}
                      onChange={(e) => setForm({ ...form, weight: e.target.value })}
                      className="px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-orange-500" required />
                    <select value={form.original_karat || '21'} onChange={(e) => setForm({ ...form, original_karat: e.target.value })}
                      className="px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-orange-500">
                      <option value="21">عيار 21</option>
                      <option value="18">عيار 18</option>
                      <option value="24">عيار 24 (سبايك)</option>
                    </select>
                  </div>

                  <input type="number" step="any" min="0" placeholder="المصنعية (جنيه)" value={form.craftsmanship || ''}
                    onChange={(e) => setForm({ ...form, craftsmanship: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-orange-500" />

                  {form.weight && (
                    <div className="bg-orange-50 border border-orange-200 p-3 rounded-lg text-sm space-y-1">
                      {effectiveKarat !== 21 && (
                        <div className="text-gray-600">الوزن بعيار 21: <span className="font-bold text-orange-800">{dealTotal().weight21.toFixed(3)} جم</span></div>
                      )}
                      <div className="text-orange-700 font-medium">
                        هيتحسب {effectiveKarat !== 21 ? dealTotal().weight21.toFixed(3) : form.weight} جم عليك
                      </div>
                      {form.craftsmanship && (
                        <div className="text-red-600 font-medium">+ مصنعية عليك: {fmt(Number(form.craftsmanship))} جنيه</div>
                      )}
                    </div>
                  )}

                  <textarea placeholder="ملاحظات (نوع الشغل...)" value={form.notes || ''} onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-orange-500" rows={2} />
                  <ModalButtons submitting={submitting} onCancel={closeModal} label="تسجيل استلام" color="amber" />
                </form>
              </>
            )}

            {/* ── إدي للتاجر (لوجوهات / سبيكة بلدي) ── */}
            {modal === 'give' && (
              <>
                <h2 className="text-lg font-bold mb-5 text-gray-800">إدي للتاجر</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                  {formError && <div className="bg-red-50 border border-red-200 text-red-600 p-3 rounded-lg text-sm">{formError}</div>}

                  <div>
                    <p className="text-sm font-medium text-gray-600 mb-2">النوع</p>
                    <div className="flex gap-2">
                      {([
                        { value: 'give' as GiveType, label: 'لوجوهات', active: 'bg-pink-500 text-white', inactive: 'bg-gray-100 text-gray-700 hover:bg-gray-200' },
                        { value: 'give_local_bar' as GiveType, label: 'سبيكة بلدي', active: 'bg-yellow-500 text-white', inactive: 'bg-gray-100 text-gray-700 hover:bg-gray-200' },
                      ]).map((opt) => (
                        <button key={opt.value} type="button" onClick={() => setGiveType(opt.value)}
                          className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${giveType === opt.value ? opt.active : opt.inactive}`}>
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <select value={form.trader_id || ''} onChange={(e) => setForm({ ...form, trader_id: Number(e.target.value) })}
                    className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-pink-500" required>
                    <option value="">اختار التاجر</option>
                    {traders.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>

                  <div className="grid grid-cols-2 gap-3">
                    <input type="number" step="any" min="0" placeholder="الوزن (جرام)" value={form.weight || ''}
                      onChange={(e) => setForm({ ...form, weight: e.target.value })}
                      className="px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-pink-500" required />
                    {giveType === 'give_local_bar' ? (
                      <input type="number" step="any" min="0" placeholder="عيار السبيكة (مثل 750, 817)"
                        value={form.fineness || ''}
                        onChange={(e) => setForm({ ...form, fineness: e.target.value })}
                        className="px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-yellow-500" required />
                    ) : (
                      <select value="21" disabled
                        className="px-3 py-2 border rounded-lg bg-gray-100 text-gray-500">
                        <option value="21">عيار 21</option>
                      </select>
                    )}
                  </div>

                  {form.weight && (
                    <div className={`${giveType === 'give_local_bar' ? 'bg-yellow-50 border-yellow-200' : 'bg-pink-50 border-pink-200'} border p-3 rounded-lg text-sm space-y-1`}>
                      {giveType === 'give_local_bar' && form.fineness && (
                        <div className="text-gray-600">الوزن بعيار 21: <span className="font-bold text-yellow-800">{((Number(form.weight) * Number(form.fineness)) / 875).toFixed(3)} جم</span></div>
                      )}
                      <div className="text-pink-700 font-medium">
                        هيتخصم {giveType === 'give_local_bar' && form.fineness
                          ? ((Number(form.weight) * Number(form.fineness)) / 875).toFixed(3)
                          : form.weight} جم من رصيد جراماتك
                      </div>
                      {giveType === 'give_local_bar' && (
                        <div className="text-green-700 font-medium">
                          + هيتخصم {fmt(Number(form.weight) * 8)} جنيه من الفلوس اللي عليك (8ج × {form.weight} جرام)
                        </div>
                      )}
                    </div>
                  )}

                  <textarea placeholder="ملاحظات" value={form.notes || ''} onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-pink-500" rows={2} />
                  <ModalButtons submitting={submitting} onCancel={closeModal} label="تسجيل" color="purple" />
                </form>
              </>
            )}

            {/* ── Cash Payment (عملية فلوس) ── */}
            {modal === 'payment' && (
              <>
                <h2 className="text-lg font-bold mb-5 text-gray-800">عملية فلوس</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                  {formError && (
                    <div className="bg-red-50 border border-red-200 text-red-600 p-3 rounded-lg text-sm">
                      {formError}
                    </div>
                  )}

                  {/* Payment type selector */}
                  <div>
                    <p className="text-sm font-medium text-gray-600 mb-2">نوع العملية</p>
                    <div className="flex gap-2">
                      {(
                        [
                          { value: 'payment', label: 'دفع فلوس', active: 'bg-green-600 text-white', inactive: 'bg-gray-100 text-gray-700 hover:bg-gray-200' },
                          { value: 'loan', label: 'استلام سلفة', active: 'bg-purple-600 text-white', inactive: 'bg-gray-100 text-gray-700 hover:bg-gray-200' },
                        ] as { value: PaymentType; label: string; active: string; inactive: string }[]
                      ).map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setPaymentType(opt.value)}
                          className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${
                            paymentType === opt.value ? opt.active : opt.inactive
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Trader selector */}
                  <select
                    value={form.trader_id || ''}
                    onChange={(e) => setForm({ ...form, trader_id: Number(e.target.value) })}
                    className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-green-500"
                    required
                  >
                    <option value="">اختار التاجر</option>
                    {traders.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>

                  <input
                    type="number"
                    step="any"
                    min="0"
                    placeholder="المبلغ (جنيه)"
                    value={form.amount || ''}
                    onChange={(e) => setForm({ ...form, amount: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-green-500"
                    required
                  />

                  <textarea
                    placeholder="ملاحظات"
                    value={form.notes || ''}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-green-500"
                    rows={2}
                  />
                  <ModalButtons
                    submitting={submitting}
                    onCancel={closeModal}
                    label={paymentType === 'payment' ? 'تسجيل الدفع' : 'تسجيل السلفة'}
                    color={paymentType === 'payment' ? 'green' : 'purple'}
                  />
                </form>
              </>
            )}

            {/* ── Gold Transfer (تحويل دهب) ── */}
            {modal === 'transfer' && (
              <>
                <h2 className="text-lg font-bold mb-5 text-gray-800">تحويل دهب</h2>
                <form onSubmit={handleSubmit} className="space-y-3">
                  {formError && (
                    <div className="bg-red-50 border border-red-200 text-red-600 p-3 rounded-lg text-sm">
                      {formError}
                    </div>
                  )}
                  <select
                    value={form.from_trader_id || ''}
                    onChange={(e) =>
                      setForm({ ...form, from_trader_id: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="">من تاجر...</option>
                    {traders.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                  <select
                    value={form.to_trader_id || ''}
                    onChange={(e) =>
                      setForm({ ...form, to_trader_id: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="">لـ تاجر...</option>
                    {traders
                      .filter((t) => t.id !== form.from_trader_id)
                      .map((t) => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                  </select>
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="number"
                      step="any"
                      min="0"
                      placeholder="الوزن (جرام)"
                      value={form.weight || ''}
                      onChange={(e) => setForm({ ...form, weight: e.target.value })}
                      className="px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                    <select
                      value={form.original_karat || '21'}
                      onChange={(e) => setForm({ ...form, original_karat: e.target.value })}
                      className="px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="21">عيار 21</option>
                      <option value="18">عيار 18</option>
                      <option value="24">عيار 24 (سبايك)</option>
                    </select>
                  </div>
                  {form.weight && Number(form.original_karat || 21) !== 21 && (
                    <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg text-sm text-gray-600">
                      الوزن بعيار 21:{' '}
                      <span className="font-bold text-blue-700">
                        {(
                          (Number(form.weight) * Number(form.original_karat || 21)) /
                          21
                        ).toFixed(3)}{' '}
                        جم
                      </span>
                    </div>
                  )}
                  <textarea
                    placeholder="ملاحظات"
                    value={form.notes || ''}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                    rows={2}
                  />
                  <ModalButtons
                    submitting={submitting}
                    onCancel={closeModal}
                    label="تسجيل التحويل"
                    color="blue"
                  />
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ModalButtons({
  submitting,
  onCancel,
  label,
  color = 'amber',
}: {
  submitting: boolean;
  onCancel: () => void;
  label: string;
  color?: 'amber' | 'green' | 'blue' | 'purple';
}) {
  const colorMap: Record<string, string> = {
    amber: 'bg-amber-600 hover:bg-amber-700',
    green: 'bg-green-600 hover:bg-green-700',
    blue: 'bg-blue-600 hover:bg-blue-700',
    purple: 'bg-purple-600 hover:bg-purple-700',
  };
  return (
    <div className="flex gap-2 pt-2">
      <button
        type="submit"
        disabled={submitting}
        className={`flex-1 py-2.5 ${colorMap[color]} text-white rounded-lg font-medium disabled:opacity-50 transition-colors`}
      >
        {submitting ? 'جاري...' : label}
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors"
      >
        إلغاء
      </button>
    </div>
  );
}
