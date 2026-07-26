import { Router, Request, Response, NextFunction } from 'express';
import db from './db';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'gold-system-secret-2024';

interface AuthRequest extends Request {
  user?: { id: number; username: string; role: string; full_name: string };
}

function auth(req: AuthRequest, res: Response, next: NextFunction): void {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) { res.status(401).json({ error: 'غير مصرح' }); return; }
  try {
    req.user = jwt.verify(token, JWT_SECRET) as any;
    next();
  } catch {
    res.status(401).json({ error: 'جلسة منتهية' });
  }
}

function adminOnly(req: AuthRequest, res: Response, next: NextFunction): void {
  if (req.user?.role !== 'admin') { res.status(403).json({ error: 'غير مسموح' }); return; }
  next();
}

function logAudit(userId: number, action: string, tableName: string, recordId: number, description: string, oldValues?: any, newValues?: any) {
  db.prepare(
    'INSERT INTO audit_log (user_id, action, table_name, record_id, description, old_values, new_values) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(userId, action, tableName, recordId, description, oldValues ? JSON.stringify(oldValues) : null, newValues ? JSON.stringify(newValues) : null);
}

// ==================== AUTH ====================
router.post('/auth/login', (req: Request, res: Response): void => {
  const { username, password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE username = ? AND is_active = 1').get(username) as any;
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    res.status(401).json({ error: 'اسم المستخدم أو كلمة السر غلط' }); return;
  }
  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role, full_name: user.full_name, is_protected: user.is_protected || 0 },
    JWT_SECRET, { expiresIn: '24h' }
  );
  res.json({ token, user: { id: user.id, username: user.username, full_name: user.full_name, role: user.role, is_protected: user.is_protected || 0 } });
});

router.get('/auth/me', auth, (req: AuthRequest, res: Response): void => {
  res.json({ user: req.user });
});

// ==================== TRADERS ====================
router.get('/traders', auth, (_req: AuthRequest, res: Response): void => {
  const traders = db.prepare(`
    SELECT t.*,
      COALESCE((SELECT SUM(CASE WHEN gd.deal_type IN ('sell','give','give_local_bar') THEN -gd.total_amount ELSE gd.total_amount END) FROM gold_deals gd WHERE gd.trader_id = t.id), 0) as deals_net,
      COALESCE((SELECT SUM(CASE WHEN cp.payment_type='loan' THEN -cp.amount ELSE cp.amount END) FROM cash_payments cp WHERE cp.trader_id = t.id), 0) as payments_net,
      COALESCE((SELECT SUM(CASE WHEN gd.deal_type IN ('sell','work') THEN -gd.weight ELSE gd.weight END) FROM gold_deals gd WHERE gd.trader_id = t.id), 0) as gold_deals_net,
      COALESCE((SELECT SUM(gt.weight) FROM gold_transfers gt WHERE gt.from_trader_id = t.id), 0) as gold_out,
      COALESCE((SELECT SUM(gt.weight) FROM gold_transfers gt WHERE gt.to_trader_id = t.id), 0) as gold_in
    FROM traders t WHERE t.is_active = 1 ORDER BY t.name
  `).all() as any[];

  const result = traders.map(t => ({
    ...t,
    money_balance: t.deals_net - t.payments_net,
    gold_balance: t.gold_deals_net - t.gold_out + t.gold_in,
  }));
  res.json(result);
});

router.get('/traders/:id', auth, (req: AuthRequest, res: Response): void => {
  const trader = db.prepare('SELECT * FROM traders WHERE id = ? AND is_active = 1').get(req.params.id);
  if (!trader) { res.status(404).json({ error: 'التاجر مش موجود' }); return; }
  res.json(trader);
});

router.post('/traders', auth, (req: AuthRequest, res: Response): void => {
  const { name, phone, address, notes } = req.body;
  if (!name) { res.status(400).json({ error: 'اسم التاجر مطلوب' }); return; }
  const result = db.prepare(
    'INSERT INTO traders (name, phone, address, notes, created_by) VALUES (?, ?, ?, ?, ?)'
  ).run(name, phone || '', address || '', notes || '', req.user!.id);
  logAudit(req.user!.id, 'create', 'traders', result.lastInsertRowid as number, `إضافة تاجر: ${name}`);
  res.json({ id: result.lastInsertRowid, message: 'تم إضافة التاجر' });
});

router.put('/traders/:id', auth, (req: AuthRequest, res: Response): void => {
  const old = db.prepare('SELECT * FROM traders WHERE id = ?').get(req.params.id) as any;
  if (!old) { res.status(404).json({ error: 'التاجر مش موجود' }); return; }
  const { name, phone, address, notes } = req.body;
  db.prepare('UPDATE traders SET name=?, phone=?, address=?, notes=? WHERE id=?')
    .run(name || old.name, phone ?? old.phone, address ?? old.address, notes ?? old.notes, req.params.id);
  logAudit(req.user!.id, 'update', 'traders', +req.params.id, `تعديل تاجر: ${old.name}`, old, req.body);
  res.json({ message: 'تم التعديل' });
});

router.delete('/traders/:id', auth, (req: AuthRequest, res: Response): void => {
  const caller = db.prepare('SELECT is_protected FROM users WHERE id=?').get(req.user!.id) as any;
  if (!caller?.is_protected) { res.status(403).json({ error: 'مسموح بس للحساب الأساسي يحذف تجار' }); return; }
  const old = db.prepare('SELECT * FROM traders WHERE id = ?').get(req.params.id) as any;
  if (!old) { res.status(404).json({ error: 'التاجر مش موجود' }); return; }
  db.prepare('UPDATE traders SET is_active = 0 WHERE id = ?').run(req.params.id);
  logAudit(req.user!.id, 'delete', 'traders', +req.params.id, `حذف تاجر: ${old.name}`, old);
  res.json({ message: 'تم الحذف' });
});

// ==== كشف حساب ====
router.get('/traders/:id/statement', auth, (req: AuthRequest, res: Response): void => {
  const trader = db.prepare('SELECT * FROM traders WHERE id = ?').get(req.params.id) as any;
  if (!trader) { res.status(404).json({ error: 'التاجر مش موجود' }); return; }

  const deals = db.prepare(
    'SELECT gd.*, u.full_name as created_by_name FROM gold_deals gd LEFT JOIN users u ON gd.created_by=u.id WHERE gd.trader_id=? ORDER BY gd.created_at DESC'
  ).all(req.params.id) as any[];
  const payments = db.prepare(
    'SELECT cp.*, u.full_name as created_by_name FROM cash_payments cp LEFT JOIN users u ON cp.created_by=u.id WHERE cp.trader_id=? ORDER BY cp.created_at DESC'
  ).all(req.params.id) as any[];
  const transfersOut = db.prepare(
    'SELECT gt.*, t.name as to_trader_name, u.full_name as created_by_name FROM gold_transfers gt LEFT JOIN traders t ON gt.to_trader_id=t.id LEFT JOIN users u ON gt.created_by=u.id WHERE gt.from_trader_id=? ORDER BY gt.created_at DESC'
  ).all(req.params.id) as any[];
  const transfersIn = db.prepare(
    'SELECT gt.*, t.name as from_trader_name, u.full_name as created_by_name FROM gold_transfers gt LEFT JOIN traders t ON gt.from_trader_id=t.id LEFT JOIN users u ON gt.created_by=u.id WHERE gt.to_trader_id=? ORDER BY gt.created_at DESC'
  ).all(req.params.id) as any[];

  const dealsNet = deals.reduce((s, d) => s + (['sell','give','give_local_bar'].includes(d.deal_type) ? -d.total_amount : d.total_amount), 0);
  const paymentsNet = payments.reduce((s, p) => s + (p.payment_type === 'loan' ? -p.amount : p.amount), 0);
  const goldDealsNet = deals.reduce((s, d) => s + (['sell','work'].includes(d.deal_type) ? -d.weight : d.weight), 0);
  const totalGoldOut = transfersOut.reduce((s, t) => s + t.weight, 0);
  const totalGoldIn = transfersIn.reduce((s, t) => s + t.weight, 0);

  res.json({
    trader, deals, payments, transfers_out: transfersOut, transfers_in: transfersIn,
    summary: {
      money_balance: dealsNet - paymentsNet,
      gold_balance: goldDealsNet - totalGoldOut + totalGoldIn,
      deals_net: dealsNet, payments_net: paymentsNet,
      total_gold_bought: deals.filter(d => d.deal_type !== 'sell').reduce((s, d) => s + d.weight, 0),
      total_gold_sold: deals.filter(d => d.deal_type === 'sell').reduce((s, d) => s + d.weight, 0),
      total_gold_out: totalGoldOut, total_gold_in: totalGoldIn,
    },
  });
});

// ==================== TRANSACTIONS ====================

// قطع (شراء/بيع بسعر) + استلام شغل (جرامات + مصنعية)
router.post('/transactions/deal', auth, (req: AuthRequest, res: Response): void => {
  const { trader_id, weight, price_per_gram, original_karat, original_weight, deal_type, total_amount: bodyTotal, notes } = req.body;
  const type = deal_type || 'buy';
  if (!trader_id || !weight) { res.status(400).json({ error: 'بيانات ناقصة' }); return; }

  let price = 0;
  let total = 0;

  if (type === 'buy' || type === 'sell') {
    if (price_per_gram == null || price_per_gram === '') { res.status(400).json({ error: 'سعر الجرام مطلوب' }); return; }
    price = price_per_gram;
    total = weight * price;
  } else if (type === 'work') {
    price = 0;
    total = bodyTotal || 0; // المصنعية
  } else if (type === 'give') {
    price = 0;
    total = 0; // لوجوهات - جرامات بس
  } else if (type === 'give_local_bar') {
    price = 8;
    total = (original_weight || weight) * 8; // سبيكة بلدي - 8ج/جرام
  }

  const result = db.prepare(
    'INSERT INTO gold_deals (trader_id, weight, price_per_gram, total_amount, original_karat, original_weight, deal_type, notes, created_by) VALUES (?,?,?,?,?,?,?,?,?)'
  ).run(trader_id, weight, price, total, original_karat || 21, original_weight || weight, type, notes || '', req.user!.id);

  const trader = db.prepare('SELECT name FROM traders WHERE id=?').get(trader_id) as any;
  const labels: Record<string, string> = { buy: 'شراء دهب من', sell: 'بيع دهب لـ', work: 'استلام شغل من', give: 'إدي لوجوهات لـ', give_local_bar: 'إدي سبيكة بلدي لـ' };
  logAudit(req.user!.id, 'create', 'gold_deals', result.lastInsertRowid as number,
    `${labels[type] || type} ${trader?.name}: ${weight}جم${total ? ' - ' + total + ' ج' : ''}`);

  res.json({ id: result.lastInsertRowid, total_amount: total, message: 'تم التسجيل' });
});

// تعديل عملية دهب
router.put('/transactions/deal/:id', auth, (req: AuthRequest, res: Response): void => {
  const old = db.prepare('SELECT * FROM gold_deals WHERE id=?').get(req.params.id) as any;
  if (!old) { res.status(404).json({ error: 'العملية مش موجودة' }); return; }

  const { trader_id, weight, price_per_gram, original_karat, original_weight, deal_type, notes } = req.body;
  const total_amount = (weight || old.weight) * (price_per_gram || old.price_per_gram);

  db.prepare('UPDATE gold_deals SET trader_id=?, weight=?, price_per_gram=?, total_amount=?, original_karat=?, original_weight=?, deal_type=?, notes=? WHERE id=?')
    .run(trader_id || old.trader_id, weight || old.weight, price_per_gram || old.price_per_gram, total_amount,
      original_karat || old.original_karat, original_weight || old.original_weight, deal_type || old.deal_type, notes ?? old.notes, req.params.id);

  logAudit(req.user!.id, 'update', 'gold_deals', +req.params.id, 'تعديل عملية دهب', old, req.body);
  res.json({ message: 'تم التعديل' });
});

// دفع فلوس / سلفة
router.post('/transactions/payment', auth, (req: AuthRequest, res: Response): void => {
  const { trader_id, amount, payment_type, notes } = req.body;
  if (!trader_id || !amount) { res.status(400).json({ error: 'بيانات ناقصة' }); return; }

  const type = payment_type || 'payment';
  const result = db.prepare(
    'INSERT INTO cash_payments (trader_id, amount, payment_type, notes, created_by) VALUES (?,?,?,?,?)'
  ).run(trader_id, amount, type, notes || '', req.user!.id);

  const trader = db.prepare('SELECT name FROM traders WHERE id=?').get(trader_id) as any;
  const label = type === 'loan' ? 'استلام سلفة من' : 'دفع فلوس لـ';
  logAudit(req.user!.id, 'create', 'cash_payments', result.lastInsertRowid as number,
    `${label} ${trader?.name}: ${amount} جنيه`);

  res.json({ id: result.lastInsertRowid, message: 'تم التسجيل' });
});

// تعديل عملية فلوس
router.put('/transactions/payment/:id', auth, (req: AuthRequest, res: Response): void => {
  const old = db.prepare('SELECT * FROM cash_payments WHERE id=?').get(req.params.id) as any;
  if (!old) { res.status(404).json({ error: 'العملية مش موجودة' }); return; }

  const { trader_id, amount, payment_type, notes } = req.body;
  db.prepare('UPDATE cash_payments SET trader_id=?, amount=?, payment_type=?, notes=? WHERE id=?')
    .run(trader_id || old.trader_id, amount || old.amount, payment_type || old.payment_type, notes ?? old.notes, req.params.id);

  logAudit(req.user!.id, 'update', 'cash_payments', +req.params.id, 'تعديل عملية فلوس', old, req.body);
  res.json({ message: 'تم التعديل' });
});

// تحويل دهب
router.post('/transactions/transfer', auth, (req: AuthRequest, res: Response): void => {
  const { from_trader_id, to_trader_id, weight, original_karat, original_weight, notes } = req.body;
  if (!from_trader_id || !to_trader_id || !weight) { res.status(400).json({ error: 'بيانات ناقصة' }); return; }
  if (from_trader_id === to_trader_id) { res.status(400).json({ error: 'مينفعش تحول من تاجر لنفسه' }); return; }

  const result = db.prepare(
    'INSERT INTO gold_transfers (from_trader_id, to_trader_id, weight, original_karat, original_weight, notes, created_by) VALUES (?,?,?,?,?,?,?)'
  ).run(from_trader_id, to_trader_id, weight, original_karat || 21, original_weight || weight, notes || '', req.user!.id);

  const from = db.prepare('SELECT name FROM traders WHERE id=?').get(from_trader_id) as any;
  const to = db.prepare('SELECT name FROM traders WHERE id=?').get(to_trader_id) as any;
  logAudit(req.user!.id, 'create', 'gold_transfers', result.lastInsertRowid as number,
    `تحويل ${weight}جم من ${from?.name} لـ ${to?.name}`);

  res.json({ id: result.lastInsertRowid, message: 'تم التحويل' });
});

// تعديل تحويل
router.put('/transactions/transfer/:id', auth, (req: AuthRequest, res: Response): void => {
  const old = db.prepare('SELECT * FROM gold_transfers WHERE id=?').get(req.params.id) as any;
  if (!old) { res.status(404).json({ error: 'العملية مش موجودة' }); return; }

  const { from_trader_id, to_trader_id, weight, original_karat, original_weight, notes } = req.body;
  db.prepare('UPDATE gold_transfers SET from_trader_id=?, to_trader_id=?, weight=?, original_karat=?, original_weight=?, notes=? WHERE id=?')
    .run(from_trader_id || old.from_trader_id, to_trader_id || old.to_trader_id, weight || old.weight,
      original_karat || old.original_karat, original_weight || old.original_weight, notes ?? old.notes, req.params.id);

  logAudit(req.user!.id, 'update', 'gold_transfers', +req.params.id, 'تعديل تحويل', old, req.body);
  res.json({ message: 'تم التعديل' });
});

// حذف عملية
router.delete('/transactions/:type/:id', auth, (req: AuthRequest, res: Response): void => {
  const { type, id } = req.params;
  const tableMap: Record<string, string> = { deal: 'gold_deals', payment: 'cash_payments', transfer: 'gold_transfers' };
  const table = tableMap[type];
  if (!table) { res.status(400).json({ error: 'نوع غلط' }); return; }

  const old = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(id);
  if (!old) { res.status(404).json({ error: 'العملية مش موجودة' }); return; }

  db.prepare(`DELETE FROM ${table} WHERE id = ?`).run(id);
  logAudit(req.user!.id, 'delete', table, +id, `حذف عملية من ${table}`, old);
  res.json({ message: 'تم الحذف' });
});

// ==================== USERS ====================
router.get('/users', auth, adminOnly, (_req: AuthRequest, res: Response): void => {
  const users = db.prepare('SELECT id, username, full_name, role, is_active, is_protected, created_at FROM users ORDER BY is_protected DESC, created_at DESC').all();
  res.json(users);
});

router.post('/users', auth, adminOnly, (req: AuthRequest, res: Response): void => {
  const { username, password, full_name, role } = req.body;
  if (!username || !password || !full_name) { res.status(400).json({ error: 'بيانات ناقصة' }); return; }
  const exists = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (exists) { res.status(400).json({ error: 'اسم المستخدم موجود' }); return; }
  const hash = bcrypt.hashSync(password, 10);
  const result = db.prepare('INSERT INTO users (username, password_hash, full_name, role) VALUES (?,?,?,?)').run(username, hash, full_name, role || 'user');
  logAudit(req.user!.id, 'create', 'users', result.lastInsertRowid as number, `إضافة مستخدم: ${username}`);
  res.json({ id: result.lastInsertRowid, message: 'تم إضافة المستخدم' });
});

router.put('/users/:id', auth, adminOnly, (req: AuthRequest, res: Response): void => {
  const old = db.prepare('SELECT id, username, full_name, role, is_active, is_protected FROM users WHERE id=?').get(req.params.id) as any;
  if (!old) { res.status(404).json({ error: 'المستخدم مش موجود' }); return; }
  // لو اليوزر محمي، بس هو نفسه يقدر يعدل بياناته
  if (old.is_protected && req.user!.id !== old.id) {
    res.status(403).json({ error: 'مينفعش تعدل على الحساب ده' }); return;
  }
  const { full_name, role, is_active, password } = req.body;
  // لو محمي، منفعش يتوقف أو يتغير دوره
  if (old.is_protected && (is_active === 0 || (role && role !== 'admin'))) {
    res.status(403).json({ error: 'مينفعش توقف أو تغير صلاحية الحساب ده' }); return;
  }
  if (password) {
    const hash = bcrypt.hashSync(password, 10);
    db.prepare('UPDATE users SET password_hash=? WHERE id=?').run(hash, req.params.id);
  }
  db.prepare('UPDATE users SET full_name=?, role=?, is_active=? WHERE id=?')
    .run(full_name ?? old.full_name, role ?? old.role, is_active ?? old.is_active, req.params.id);
  logAudit(req.user!.id, 'update', 'users', +req.params.id, `تعديل مستخدم: ${old.username}`, old, req.body);
  res.json({ message: 'تم التعديل' });
});

// حذف مستخدم (المحمي بس يقدر يحذف)
router.delete('/users/:id', auth, (req: AuthRequest, res: Response): void => {
  const caller = db.prepare('SELECT is_protected FROM users WHERE id=?').get(req.user!.id) as any;
  if (!caller?.is_protected) { res.status(403).json({ error: 'مسموح بس للحساب الأساسي يحذف مستخدمين' }); return; }
  const target = db.prepare('SELECT * FROM users WHERE id=?').get(req.params.id) as any;
  if (!target) { res.status(404).json({ error: 'المستخدم مش موجود' }); return; }
  if (target.is_protected) { res.status(403).json({ error: 'مينفعش تحذف الحساب الأساسي' }); return; }
  db.prepare('DELETE FROM users WHERE id=?').run(req.params.id);
  logAudit(req.user!.id, 'delete', 'users', +req.params.id, `حذف مستخدم: ${target.username}`, target);
  res.json({ message: 'تم حذف المستخدم' });
});

// تغيير باسورد المستخدم الحالي
router.put('/auth/password', auth, (req: AuthRequest, res: Response): void => {
  const { current_password, new_password } = req.body;
  if (!current_password || !new_password) { res.status(400).json({ error: 'بيانات ناقصة' }); return; }
  const user = db.prepare('SELECT * FROM users WHERE id=?').get(req.user!.id) as any;
  if (!bcrypt.compareSync(current_password, user.password_hash)) {
    res.status(400).json({ error: 'كلمة السر الحالية غلط' }); return;
  }
  const hash = bcrypt.hashSync(new_password, 10);
  db.prepare('UPDATE users SET password_hash=? WHERE id=?').run(hash, req.user!.id);
  res.json({ message: 'تم تغيير كلمة السر' });
});

// ==================== AUDIT LOG ====================
router.get('/audit', auth, adminOnly, (_req: AuthRequest, res: Response): void => {
  const logs = db.prepare(
    'SELECT al.*, u.full_name as user_name FROM audit_log al LEFT JOIN users u ON al.user_id=u.id ORDER BY al.created_at DESC LIMIT 500'
  ).all();
  res.json(logs);
});

// ==================== DASHBOARD ====================
router.get('/dashboard', auth, (_req: AuthRequest, res: Response): void => {
  const totalTraders = (db.prepare('SELECT COUNT(*) as c FROM traders WHERE is_active=1').get() as any).c;
  const dealsNet = (db.prepare("SELECT COALESCE(SUM(CASE WHEN deal_type IN ('sell','give','give_local_bar') THEN -total_amount ELSE total_amount END),0) as t FROM gold_deals").get() as any).t;
  const paymentsNet = (db.prepare("SELECT COALESCE(SUM(CASE WHEN payment_type='loan' THEN -amount ELSE amount END),0) as t FROM cash_payments").get() as any).t;
  const totalGold = (db.prepare("SELECT COALESCE(SUM(CASE WHEN deal_type IN ('sell','work') THEN -weight ELSE weight END),0) as t FROM gold_deals").get() as any).t;
  const totalTransfers = (db.prepare('SELECT COALESCE(SUM(weight),0) as t FROM gold_transfers').get() as any).t;

  const recentDeals = db.prepare(
    'SELECT gd.*, t.name as trader_name, u.full_name as created_by_name FROM gold_deals gd LEFT JOIN traders t ON gd.trader_id=t.id LEFT JOIN users u ON gd.created_by=u.id ORDER BY gd.created_at DESC LIMIT 5'
  ).all();
  const recentPayments = db.prepare(
    'SELECT cp.*, t.name as trader_name, u.full_name as created_by_name FROM cash_payments cp LEFT JOIN traders t ON cp.trader_id=t.id LEFT JOIN users u ON cp.created_by=u.id ORDER BY cp.created_at DESC LIMIT 5'
  ).all();
  const recentTransfers = db.prepare(
    'SELECT gt.*, tf.name as from_name, tt.name as to_name, u.full_name as created_by_name FROM gold_transfers gt LEFT JOIN traders tf ON gt.from_trader_id=tf.id LEFT JOIN traders tt ON gt.to_trader_id=tt.id LEFT JOIN users u ON gt.created_by=u.id ORDER BY gt.created_at DESC LIMIT 5'
  ).all();

  res.json({
    stats: { total_traders: totalTraders, money_balance: dealsNet - paymentsNet, total_gold: totalGold, total_transfers: totalTransfers },
    recent: { deals: recentDeals, payments: recentPayments, transfers: recentTransfers },
  });
});

export { router };
