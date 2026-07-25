import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';

type Modal = 'none' | 'add-trader' | 'deal' | 'payment' | 'transfer';
type DealType = 'buy' | 'sell' | 'spike';
type PaymentType = 'payment' | 'loan';

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
  };

  const closeModal = () => {
    setModal('none');
    setForm({});
    setFormError('');
  };

  // When spike is selected, karat is forced to 24
  const effectiveKarat = dealType === 'spike' ? 24 : Number(form.original_karat || 21);

  const dealTotal = () => {
    const karat = effectiveKarat;
    const w = Number(form.weight) || 0;
    const p = Number(form.price_per_gram) || 0;
    const w21 = karat !== 21 ? (w * karat) / 21 : w;
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
        const weight21 = karat !== 21 ? (origWeight * karat) / 21 : origWeight;
        const apiDealType = dealType === 'spike' ? 'buy' : dealType;
        await api.post('/transactions/deal', {
          trader_id: form.trader_id,
          weight: weight21,
          price_per_gram: apiDealType === 'sell' ? 0 : Number(form.price_per_gram),
          original_karat: karat,
          original_weight: origWeight,
          deal_type: apiDealType,
          notes: form.notes || '',
        });
      } else if (modal === 'payment') {
        await api.post('/transactions/payment', {
          trader_id: form.trader_id,
          amount: Number(form.amount),
          payment_type: paymentType,
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

  if (loading)
    return <div className="text-center py-10 text-gray-500">جاري التحميل...</div>;

  return (
    <div>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h1 className="text-2xl font-bold text-gray-800">التجار</h1>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => openModal('add-trader')}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-800 text-white rounded-lg text-sm font-medium transition-colors"
          >
            + تاجر جديد
          </button>
          <button
            onClick={() => openModal('deal')}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-medium transition-colors"
          >
            عملية دهب
          </button>
          <button
            onClick={() => openModal('payment')}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            عملية فلوس
          </button>
          <button
            onClick={() => openModal('transfer')}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
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
                      onClick={() => openModal('deal', { trader_id: t.id, _dealType: 'buy' })}
                      className="px-2 py-1 bg-amber-100 text-amber-700 rounded text-xs hover:bg-amber-200 font-medium transition-colors"
                      title="شراء"
                    >
                      شراء
                    </button>
                    <button
                      onClick={() => {
                        openModal('deal', { trader_id: t.id });
                        setDealType('sell');
                      }}
                      className="px-2 py-1 bg-orange-100 text-orange-700 rounded text-xs hover:bg-orange-200 font-medium transition-colors"
                      title="بيع"
                    >
                      بيع
                    </button>
                    <button
                      onClick={() => openModal('payment', { trader_id: t.id })}
                      className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs hover:bg-green-200 font-medium transition-colors"
                      title="دفع فلوس"
                    >
                      دفع
                    </button>
                    <button
                      onClick={() => {
                        openModal('payment', { trader_id: t.id });
                        setPaymentType('loan');
                      }}
                      className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs hover:bg-purple-200 font-medium transition-colors"
                      title="استلام سلفة"
                    >
                      سلفة
                    </button>
                    <button
                      onClick={() => openModal('transfer', { from_trader_id: t.id })}
                      className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs hover:bg-blue-200 font-medium transition-colors"
                      title="تحويل دهب"
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
            className="bg-white rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-auto shadow-2xl"
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

            {/* ── Gold Deal (عملية دهب) ── */}
            {modal === 'deal' && (
              <>
                <h2 className="text-lg font-bold mb-5 text-gray-800">عملية دهب</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                  {formError && (
                    <div className="bg-red-50 border border-red-200 text-red-600 p-3 rounded-lg text-sm">
                      {formError}
                    </div>
                  )}

                  {/* Deal type selector */}
                  <div>
                    <p className="text-sm font-medium text-gray-600 mb-2">نوع العملية</p>
                    <div className="flex gap-2">
                      {(
                        [
                          { value: 'buy', label: 'شراء', active: 'bg-amber-500 text-white', inactive: 'bg-gray-100 text-gray-700 hover:bg-gray-200' },
                          { value: 'sell', label: 'بيع', active: 'bg-orange-500 text-white', inactive: 'bg-gray-100 text-gray-700 hover:bg-gray-200' },
                          { value: 'spike', label: 'سبايك', active: 'bg-yellow-500 text-white', inactive: 'bg-gray-100 text-gray-700 hover:bg-gray-200' },
                        ] as { value: DealType; label: string; active: string; inactive: string }[]
                      ).map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setDealType(opt.value)}
                          className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${
                            dealType === opt.value ? opt.active : opt.inactive
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                    {dealType === 'spike' && (
                      <p className="text-xs text-yellow-700 bg-yellow-50 px-3 py-1.5 rounded-lg mt-2">
                        سبايك = شراء بعيار 24 تلقائياً
                      </p>
                    )}
                  </div>

                  {/* Trader selector */}
                  <select
                    value={form.trader_id || ''}
                    onChange={(e) => setForm({ ...form, trader_id: Number(e.target.value) })}
                    className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-amber-500"
                    required
                  >
                    <option value="">اختار التاجر</option>
                    {traders.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>

                  {/* Weight & Karat */}
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="number"
                      step="any"
                      min="0"
                      placeholder="الوزن (جرام)"
                      value={form.weight || ''}
                      onChange={(e) => setForm({ ...form, weight: e.target.value })}
                      className="px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-amber-500"
                      required
                    />
                    <select
                      value={dealType === 'spike' ? '24' : (form.original_karat || '21')}
                      onChange={(e) => setForm({ ...form, original_karat: e.target.value })}
                      disabled={dealType === 'spike'}
                      className={`px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-amber-500 ${
                        dealType === 'spike' ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''
                      }`}
                    >
                      <option value="21">عيار 21</option>
                      <option value="24">عيار 24 (سبايك)</option>
                      <option value="18">عيار 18 (كسر)</option>
                      <option value="14">عيار 14</option>
                    </select>
                  </div>

                  {/* Price per gram - only for buy/spike */}
                  {dealType !== 'sell' && (
                    <input
                      type="number"
                      step="any"
                      min="0"
                      placeholder="سعر الجرام"
                      value={form.price_per_gram || ''}
                      onChange={(e) => setForm({ ...form, price_per_gram: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-amber-500"
                      required
                    />
                  )}

                  {/* Live calculation preview */}
                  {form.weight && (
                    <div className={`${dealType === 'sell' ? 'bg-orange-50 border-orange-200' : 'bg-amber-50 border-amber-200'} border p-3 rounded-lg text-sm space-y-1`}>
                      {effectiveKarat !== 21 && (
                        <div className="text-gray-600">
                          الوزن بعيار 21:{' '}
                          <span className="font-bold text-amber-800">
                            {dealTotal().weight21.toFixed(3)} جم
                          </span>
                        </div>
                      )}
                      {dealType === 'sell' ? (
                        <div className="text-orange-700 font-medium">
                          هيتخصم {effectiveKarat !== 21 ? dealTotal().weight21.toFixed(3) : form.weight} جم من رصيد التاجر
                        </div>
                      ) : (
                        form.price_per_gram && (
                          <div className="text-gray-600">
                            الإجمالي:{' '}
                            <span className="font-bold text-amber-700 text-base">
                              {fmt(Math.round(dealTotal().total))} جنيه
                            </span>
                          </div>
                        )
                      )}
                    </div>
                  )}

                  <textarea
                    placeholder="ملاحظات"
                    value={form.notes || ''}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-amber-500"
                    rows={2}
                  />
                  <ModalButtons
                    submitting={submitting}
                    onCancel={closeModal}
                    label={
                      dealType === 'buy'
                        ? 'تسجيل شراء'
                        : dealType === 'sell'
                        ? 'تسجيل بيع'
                        : 'تسجيل سبايك'
                    }
                  />
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
                      <option value="24">عيار 24 (سبايك)</option>
                      <option value="18">عيار 18 (كسر)</option>
                      <option value="14">عيار 14</option>
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
