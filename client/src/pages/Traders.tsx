import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/ui/Modal';
import { PageLoader } from '../components/ui/Spinner';
import EmptyState from '../components/ui/EmptyState';

type Modal = 'none' | 'add-trader' | 'deal' | 'payment' | 'transfer' | 'work' | 'give';
type DealType = 'buy' | 'sell';
type PaymentType = 'payment' | 'loan';
type GiveType = 'give' | 'give_local_bar';

export default function Traders() {
  const { user } = useAuth();
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

  const deleteTrader = async (t: any) => {
    if (!window.confirm(`متأكد إنك عايز تحذف ${t.name}؟`)) return;
    try {
      await api.delete(`/traders/${t.id}`);
      load();
    } catch (err: any) {
      alert(err.response?.data?.error || 'مقدرش أحذف التاجر');
    }
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
        const res = await api.post('/traders', { name: form.name, phone: form.phone, address: form.address, notes: form.notes });
        const newId = res.data.id;
        // لو فيه رصيد افتتاحي (وزن أو فلوس) سجله
        if (form.init_weight && Number(form.init_weight) > 0) {
          await api.post('/transactions/deal', {
            trader_id: newId, weight: Number(form.init_weight), price_per_gram: 0,
            total_amount: 0, original_karat: 21, original_weight: Number(form.init_weight),
            deal_type: 'buy', notes: 'رصيد افتتاحي - دهب',
          });
        }
        if (form.init_money && Number(form.init_money) > 0) {
          await api.post('/transactions/payment', {
            trader_id: newId, amount: Number(form.init_money),
            payment_type: form.init_money_type || 'loan', notes: 'رصيد افتتاحي - فلوس',
          });
        }
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

  if (loading) return <PageLoader />;

  return (
    <div>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <h1 className="text-xl md:text-2xl font-bold text-stone-800">التجار</h1>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => openModal('add-trader')}
            className="btn-primary"
          >
            + تاجر جديد
          </button>
          <button
            onClick={() => openModal('deal')}
            className="btn-secondary"
          >
            قطع
          </button>
          <button
            onClick={() => openModal('work')}
            className="btn-secondary"
          >
            استلام شغل
          </button>
          <button
            onClick={() => openModal('give')}
            className="btn-secondary"
          >
            إدي للتاجر
          </button>
          <button
            onClick={() => openModal('payment')}
            className="btn-secondary"
          >
            عملية فلوس
          </button>
          <button
            onClick={() => openModal('transfer')}
            className="btn-secondary"
          >
            تحويل دهب
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="card px-4 py-3 mb-4">
        <div className="flex items-center gap-3">
          <svg className="w-4 h-4 text-stone-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
          </svg>
          <input
            placeholder="بحث بالاسم أو التليفون..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-transparent outline-none text-stone-700 placeholder:text-stone-400 text-sm"
          />
        </div>
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-stone-50/80">
              <th className="px-4 py-3 text-right uppercase text-xs tracking-wide text-stone-500 font-semibold">الاسم</th>
              <th className="px-4 py-3 text-right uppercase text-xs tracking-wide text-stone-500 font-semibold">التليفون</th>
              <th className="px-4 py-3 text-right uppercase text-xs tracking-wide text-stone-500 font-semibold">رصيد الفلوس</th>
              <th className="px-4 py-3 text-right uppercase text-xs tracking-wide text-stone-500 font-semibold">رصيد الدهب (جم)</th>
              <th className="px-4 py-3 text-right uppercase text-xs tracking-wide text-stone-500 font-semibold">إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((t) => (
              <tr key={t.id} className="border-t border-stone-100 hover:bg-gold-50/50 transition-colors">
                <td className="px-4 py-3">
                  <Link
                    to={`/traders/${t.id}`}
                    className="text-gold-700 hover:text-gold-600 font-semibold"
                  >
                    {t.name}
                  </Link>
                </td>
                <td className="px-4 py-3 text-stone-500">{t.phone || '-'}</td>
                <td className="px-4 py-3">
                  <span
                    className={`font-bold ${
                      t.money_balance > 0
                        ? 'text-red-600'
                        : t.money_balance < 0
                        ? 'text-green-600'
                        : 'text-stone-400'
                    }`}
                  >
                    {fmt(t.money_balance)} ج
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`font-bold ${t.gold_balance > 0 ? 'text-emerald-600' : t.gold_balance < 0 ? 'text-red-600' : 'text-stone-400'}`}>
                    {fmtW(t.gold_balance)} جم
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    <button
                      onClick={() => openModal('deal', { trader_id: t.id })}
                      className="btn-ghost text-xs px-2 py-1"
                    >
                      قطع
                    </button>
                    <button
                      onClick={() => openModal('work', { trader_id: t.id })}
                      className="btn-ghost text-xs px-2 py-1"
                    >
                      شغل
                    </button>
                    <button
                      onClick={() => openModal('payment', { trader_id: t.id })}
                      className="btn-ghost text-xs px-2 py-1"
                    >
                      دفع
                    </button>
                    <button
                      onClick={() => {
                        openModal('payment', { trader_id: t.id });
                        setPaymentType('loan');
                      }}
                      className="btn-ghost text-xs px-2 py-1"
                    >
                      سلفة
                    </button>
                    <button
                      onClick={() => openModal('transfer', { from_trader_id: t.id })}
                      className="btn-ghost text-xs px-2 py-1"
                    >
                      تحويل
                    </button>
                    {(user as any)?.is_protected ? (
                      <button
                        onClick={() => deleteTrader(t)}
                        className="btn-ghost text-xs px-2 py-1 text-red-500 hover:bg-red-50"
                      >
                        حذف
                      </button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <EmptyState icon="👥" title="لا يوجد تجار" sub="أضف أول تاجر بالضغط على الزر أعلاه" />
        )}
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden">
        {filtered.length === 0 ? (
          <EmptyState icon="👥" title="لا يوجد تجار" sub="أضف أول تاجر بالضغط على الزر أعلاه" />
        ) : (
          filtered.map((t) => (
            <div key={t.id} className="card p-4 mb-3">
              {/* Top: name + phone */}
              <div className="flex items-center justify-between mb-3">
                <Link
                  to={`/traders/${t.id}`}
                  className="text-gold-700 hover:text-gold-600 font-semibold text-base"
                >
                  {t.name}
                </Link>
                <span className="text-stone-400 text-sm">{t.phone || '-'}</span>
              </div>

              {/* Middle: two mini stat boxes */}
              <div className="grid grid-cols-2 gap-2 mb-3">
                <div className="bg-stone-50 rounded-xl px-3 py-2 text-center">
                  <p className="text-xs text-stone-400 mb-0.5">رصيد الفلوس</p>
                  <p className={`font-bold text-sm ${
                    t.money_balance > 0
                      ? 'text-red-600'
                      : t.money_balance < 0
                      ? 'text-green-600'
                      : 'text-stone-400'
                  }`}>
                    {fmt(t.money_balance)} ج
                  </p>
                </div>
                <div className="bg-stone-50 rounded-xl px-3 py-2 text-center">
                  <p className="text-xs text-stone-400 mb-0.5">رصيد الدهب</p>
                  <p className={`font-bold text-sm ${t.gold_balance > 0 ? 'text-emerald-600' : t.gold_balance < 0 ? 'text-red-600' : 'text-stone-400'}`}>{fmtW(t.gold_balance)} جم</p>
                </div>
              </div>

              {/* Bottom: action buttons */}
              <div className="flex flex-wrap gap-1">
                <button
                  onClick={() => openModal('deal', { trader_id: t.id })}
                  className="btn-ghost text-xs px-2 py-1"
                >
                  قطع
                </button>
                <button
                  onClick={() => openModal('work', { trader_id: t.id })}
                  className="btn-ghost text-xs px-2 py-1"
                >
                  شغل
                </button>
                <button
                  onClick={() => openModal('payment', { trader_id: t.id })}
                  className="btn-ghost text-xs px-2 py-1"
                >
                  دفع
                </button>
                <button
                  onClick={() => {
                    openModal('payment', { trader_id: t.id });
                    setPaymentType('loan');
                  }}
                  className="btn-ghost text-xs px-2 py-1"
                >
                  سلفة
                </button>
                <button
                  onClick={() => openModal('transfer', { from_trader_id: t.id })}
                  className="btn-ghost text-xs px-2 py-1"
                >
                  تحويل
                </button>
                {(user as any)?.is_protected ? (
                  <button
                    onClick={() => deleteTrader(t)}
                    className="btn-ghost text-xs px-2 py-1 text-red-500 hover:bg-red-50"
                  >
                    حذف
                  </button>
                ) : null}
              </div>
            </div>
          ))
        )}
      </div>

      {/* ===== MODALS ===== */}

      {/* ── Add Trader ── */}
      {modal === 'add-trader' && (
        <Modal title="إضافة تاجر جديد" onClose={closeModal}>
          <form onSubmit={handleSubmit} className="space-y-3">
            {formError && (
              <div className="bg-red-50 border border-red-200 text-red-600 rounded-xl px-4 py-3 text-sm">
                {formError}
              </div>
            )}
            <input
              placeholder="اسم التاجر *"
              value={form.name || ''}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="input-field"
              required
            />
            <input
              placeholder="التليفون"
              value={form.phone || ''}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="input-field"
            />
            <input
              placeholder="العنوان"
              value={form.address || ''}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              className="input-field"
            />
            <textarea
              placeholder="ملاحظات"
              value={form.notes || ''}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="input-field"
              rows={2}
            />

            {/* رصيد افتتاحي (اختياري) */}
            <div className="border-t border-stone-100 pt-3 mt-2">
              <p className="text-sm font-semibold text-stone-500 mb-3">رصيد افتتاحي (اختياري)</p>
              <div className="space-y-3">
                <input
                  type="number" step="any" min="0"
                  placeholder="رصيد الدهب (جرام عيار 21)"
                  value={form.init_weight || ''}
                  onChange={(e) => setForm({ ...form, init_weight: e.target.value })}
                  className="input-field"
                />
                <input
                  type="number" step="any" min="0"
                  placeholder="رصيد الفلوس (جنيه)"
                  value={form.init_money || ''}
                  onChange={(e) => setForm({ ...form, init_money: e.target.value })}
                  className="input-field"
                />
                {form.init_money && Number(form.init_money) > 0 && (
                  <div>
                    <p className="text-xs text-stone-400 mb-1.5">الفلوس دي عليك ولا ليك؟</p>
                    <div className="flex gap-2 bg-stone-100 rounded-xl p-1">
                      <button type="button"
                        onClick={() => setForm({ ...form, init_money_type: 'loan' })}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${(form.init_money_type || 'loan') === 'loan' ? 'bg-red-500 text-white shadow-sm' : 'text-stone-500'}`}>
                        عليك (مديون)
                      </button>
                      <button type="button"
                        onClick={() => setForm({ ...form, init_money_type: 'payment' })}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${form.init_money_type === 'payment' ? 'bg-emerald-500 text-white shadow-sm' : 'text-stone-500'}`}>
                        ليك (دائن)
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <ModalButtons submitting={submitting} onCancel={closeModal} label="إضافة" />
          </form>
        </Modal>
      )}

      {/* ── قطع (شراء / بيع بسعر) ── */}
      {modal === 'deal' && (
        <Modal title="قطع" onClose={closeModal}>
          <form onSubmit={handleSubmit} className="space-y-4">
            {formError && (
              <div className="bg-red-50 border border-red-200 text-red-600 rounded-xl px-4 py-3 text-sm">
                {formError}
              </div>
            )}

            <div>
              <p className="text-sm font-medium text-stone-600 mb-2">نوع القطع</p>
              <div className="bg-stone-100 rounded-xl p-1 flex gap-1">
                {([
                  { value: 'buy' as DealType, label: 'شراء (عليك)' },
                  { value: 'sell' as DealType, label: 'بيع (ليك)' },
                ]).map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setDealType(opt.value)}
                    className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${
                      dealType === opt.value
                        ? 'bg-white text-stone-800 shadow-sm'
                        : 'text-stone-500 hover:text-stone-700'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <select
              value={form.trader_id || ''}
              onChange={(e) => setForm({ ...form, trader_id: Number(e.target.value) })}
              className="input-field"
              required
            >
              <option value="">اختار التاجر</option>
              {traders.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>

            <div className="grid grid-cols-2 gap-3">
              <input
                type="number"
                step="any"
                min="0"
                placeholder="الوزن (جرام)"
                value={form.weight || ''}
                onChange={(e) => setForm({ ...form, weight: e.target.value })}
                className="input-field"
                required
              />
              <select
                value={form.original_karat || '21'}
                onChange={(e) => setForm({ ...form, original_karat: e.target.value })}
                className="input-field"
              >
                <option value="21">عيار 21</option>
                <option value="18">عيار 18</option>
                <option value="24">عيار 24 (سبايك)</option>
              </select>
            </div>

            <input
              type="number"
              step="any"
              min="0"
              placeholder="سعر الجرام"
              value={form.price_per_gram || ''}
              onChange={(e) => setForm({ ...form, price_per_gram: e.target.value })}
              className="input-field"
              required
            />

            {form.weight && form.price_per_gram && (
              <div className="card p-3 text-sm space-y-1">
                {effectiveKarat !== 21 && (
                  <div className="text-stone-600">الوزن بعيار 21: <span className="font-bold text-amber-800">{dealTotal().weight21.toFixed(3)} جم</span></div>
                )}
                <div className="text-stone-600">الإجمالي: <span className="font-bold text-amber-700 text-base">{fmt(Math.round(dealTotal().total))} جنيه</span></div>
                <div className={`font-medium ${dealType === 'buy' ? 'text-red-600' : 'text-green-600'}`}>
                  {dealType === 'buy' ? '(عليك للتاجر)' : '(ليك من التاجر)'}
                </div>
              </div>
            )}

            <textarea
              placeholder="ملاحظات"
              value={form.notes || ''}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="input-field"
              rows={2}
            />
            <ModalButtons submitting={submitting} onCancel={closeModal} label={dealType === 'buy' ? 'تسجيل شراء' : 'تسجيل بيع'} />
          </form>
        </Modal>
      )}

      {/* ── استلام شغل (جرامات + مصنعية) ── */}
      {modal === 'work' && (
        <Modal title="استلام شغل" onClose={closeModal}>
          <form onSubmit={handleSubmit} className="space-y-4">
            {formError && (
              <div className="bg-red-50 border border-red-200 text-red-600 rounded-xl px-4 py-3 text-sm">
                {formError}
              </div>
            )}

            <select
              value={form.trader_id || ''}
              onChange={(e) => setForm({ ...form, trader_id: Number(e.target.value) })}
              className="input-field"
              required
            >
              <option value="">اختار التاجر</option>
              {traders.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>

            <div className="grid grid-cols-2 gap-3">
              <input
                type="number"
                step="any"
                min="0"
                placeholder="الوزن (جرام)"
                value={form.weight || ''}
                onChange={(e) => setForm({ ...form, weight: e.target.value })}
                className="input-field"
                required
              />
              <select
                value={form.original_karat || '21'}
                onChange={(e) => setForm({ ...form, original_karat: e.target.value })}
                className="input-field"
              >
                <option value="21">عيار 21</option>
                <option value="18">عيار 18</option>
                <option value="24">عيار 24 (سبايك)</option>
              </select>
            </div>

            <input
              type="number"
              step="any"
              min="0"
              placeholder="المصنعية (جنيه)"
              value={form.craftsmanship || ''}
              onChange={(e) => setForm({ ...form, craftsmanship: e.target.value })}
              className="input-field"
            />

            {form.weight && (
              <div className="card p-3 text-sm space-y-1">
                {effectiveKarat !== 21 && (
                  <div className="text-stone-600">الوزن بعيار 21: <span className="font-bold text-amber-800">{dealTotal().weight21.toFixed(3)} جم</span></div>
                )}
                <div className="text-amber-700 font-medium">
                  هيتحسب {effectiveKarat !== 21 ? dealTotal().weight21.toFixed(3) : form.weight} جم عليك
                </div>
                {form.craftsmanship && (
                  <div className="text-red-600 font-medium">+ مصنعية عليك: {fmt(Number(form.craftsmanship))} جنيه</div>
                )}
              </div>
            )}

            <textarea
              placeholder="ملاحظات (نوع الشغل...)"
              value={form.notes || ''}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="input-field"
              rows={2}
            />
            <ModalButtons submitting={submitting} onCancel={closeModal} label="تسجيل استلام" color="amber" />
          </form>
        </Modal>
      )}

      {/* ── إدي للتاجر (لوجوهات / سبيكة بلدي) ── */}
      {modal === 'give' && (
        <Modal title="إدي للتاجر" onClose={closeModal}>
          <form onSubmit={handleSubmit} className="space-y-4">
            {formError && (
              <div className="bg-red-50 border border-red-200 text-red-600 rounded-xl px-4 py-3 text-sm">
                {formError}
              </div>
            )}

            <div>
              <p className="text-sm font-medium text-stone-600 mb-2">النوع</p>
              <div className="bg-stone-100 rounded-xl p-1 flex gap-1">
                {([
                  { value: 'give' as GiveType, label: 'لوجوهات' },
                  { value: 'give_local_bar' as GiveType, label: 'سبيكة بلدي' },
                ]).map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setGiveType(opt.value)}
                    className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${
                      giveType === opt.value
                        ? 'bg-white text-stone-800 shadow-sm'
                        : 'text-stone-500 hover:text-stone-700'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <select
              value={form.trader_id || ''}
              onChange={(e) => setForm({ ...form, trader_id: Number(e.target.value) })}
              className="input-field"
              required
            >
              <option value="">اختار التاجر</option>
              {traders.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>

            <div className="grid grid-cols-2 gap-3">
              <input
                type="number"
                step="any"
                min="0"
                placeholder="الوزن (جرام)"
                value={form.weight || ''}
                onChange={(e) => setForm({ ...form, weight: e.target.value })}
                className="input-field"
                required
              />
              {giveType === 'give_local_bar' ? (
                <input
                  type="number"
                  step="any"
                  min="0"
                  placeholder="عيار السبيكة (مثل 750, 817)"
                  value={form.fineness || ''}
                  onChange={(e) => setForm({ ...form, fineness: e.target.value })}
                  className="input-field"
                  required
                />
              ) : (
                <select value="21" disabled className="input-field bg-stone-50 text-stone-400">
                  <option value="21">عيار 21</option>
                </select>
              )}
            </div>

            {form.weight && (
              <div className="card p-3 text-sm space-y-1">
                {giveType === 'give_local_bar' && form.fineness && (
                  <div className="text-stone-600">الوزن بعيار 21: <span className="font-bold text-amber-800">{((Number(form.weight) * Number(form.fineness)) / 875).toFixed(3)} جم</span></div>
                )}
                <div className="text-emerald-700 font-medium">
                  {giveType === 'give_local_bar' && form.fineness
                    ? ((Number(form.weight) * Number(form.fineness)) / 875).toFixed(3)
                    : form.weight} جم <span className="font-bold">ليك</span>
                </div>
                {giveType === 'give_local_bar' && (
                  <div className="text-emerald-700 font-medium">
                    + {fmt(Number(form.weight) * 8)} جنيه <span className="font-bold">ليك</span> (8ج × {form.weight} جرام)
                  </div>
                )}
              </div>
            )}

            <textarea
              placeholder="ملاحظات"
              value={form.notes || ''}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="input-field"
              rows={2}
            />
            <ModalButtons submitting={submitting} onCancel={closeModal} label="تسجيل" color="purple" />
          </form>
        </Modal>
      )}

      {/* ── Cash Payment (عملية فلوس) ── */}
      {modal === 'payment' && (
        <Modal title="عملية فلوس" onClose={closeModal}>
          <form onSubmit={handleSubmit} className="space-y-4">
            {formError && (
              <div className="bg-red-50 border border-red-200 text-red-600 rounded-xl px-4 py-3 text-sm">
                {formError}
              </div>
            )}

            {/* Payment type selector */}
            <div>
              <p className="text-sm font-medium text-stone-600 mb-2">نوع العملية</p>
              <div className="bg-stone-100 rounded-xl p-1 flex gap-1">
                {(
                  [
                    { value: 'payment', label: 'دفع فلوس' },
                    { value: 'loan', label: 'استلام سلفة' },
                  ] as { value: PaymentType; label: string }[]
                ).map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setPaymentType(opt.value)}
                    className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${
                      paymentType === opt.value
                        ? 'bg-white text-stone-800 shadow-sm'
                        : 'text-stone-500 hover:text-stone-700'
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
              className="input-field"
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
              className="input-field"
              required
            />

            <textarea
              placeholder="ملاحظات"
              value={form.notes || ''}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="input-field"
              rows={2}
            />
            <ModalButtons
              submitting={submitting}
              onCancel={closeModal}
              label={paymentType === 'payment' ? 'تسجيل الدفع' : 'تسجيل السلفة'}
              color={paymentType === 'payment' ? 'green' : 'purple'}
            />
          </form>
        </Modal>
      )}

      {/* ── Gold Transfer (تحويل دهب) ── */}
      {modal === 'transfer' && (
        <Modal title="تحويل دهب" onClose={closeModal}>
          <form onSubmit={handleSubmit} className="space-y-3">
            {formError && (
              <div className="bg-red-50 border border-red-200 text-red-600 rounded-xl px-4 py-3 text-sm">
                {formError}
              </div>
            )}
            <select
              value={form.from_trader_id || ''}
              onChange={(e) =>
                setForm({ ...form, from_trader_id: Number(e.target.value) })
              }
              className="input-field"
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
              className="input-field"
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
                className="input-field"
                required
              />
              <select
                value={form.original_karat || '21'}
                onChange={(e) => setForm({ ...form, original_karat: e.target.value })}
                className="input-field"
              >
                <option value="21">عيار 21</option>
                <option value="18">عيار 18</option>
                <option value="24">عيار 24 (سبايك)</option>
              </select>
            </div>
            {form.weight && Number(form.original_karat || 21) !== 21 && (
              <div className="card p-3 text-sm text-stone-600">
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
              className="input-field"
              rows={2}
            />
            <ModalButtons
              submitting={submitting}
              onCancel={closeModal}
              label="تسجيل التحويل"
              color="blue"
            />
          </form>
        </Modal>
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
  return (
    <div className="flex gap-2 pt-2">
      <button
        type="submit"
        disabled={submitting}
        className="btn-primary flex-1 py-2.5 disabled:opacity-50"
      >
        {submitting ? 'جاري...' : label}
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="btn-secondary flex-1 py-2.5"
      >
        إلغاء
      </button>
    </div>
  );
}
