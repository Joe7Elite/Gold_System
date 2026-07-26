import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(username, password);
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.error || 'حصل مشكلة');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0c0a09] relative overflow-hidden">
      {/* Radial gold glow background */}
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at 60% 40%, rgba(180,120,20,0.08) 0%, transparent 70%)' }} />

      {/* Decorative glow orb */}
      <div className="absolute -top-32 -right-32 w-64 h-64 bg-amber-600/5 rounded-full blur-3xl pointer-events-none" />

      {/* Card */}
      <div className="bg-stone-900/80 backdrop-blur-xl border border-amber-900/30 rounded-3xl shadow-2xl p-8 w-full max-w-md animate-slide-up relative z-10">

        {/* Logo */}
        <img src="/logo.png" alt="المصطفى للذهب" className="h-24 mx-auto mb-6" />

        {/* Subtitle */}
        <p className="text-stone-400 text-sm text-center mb-6">تسجيل الدخول</p>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="bg-red-900/30 border border-red-800/50 text-red-400 rounded-xl px-4 py-3 text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-stone-400 mb-1.5">
              اسم المستخدم
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-3 bg-stone-800 border border-stone-700 rounded-xl text-white placeholder:text-stone-500 outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/50 transition-all"
              placeholder="admin"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-400 mb-1.5">
              كلمة السر
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 bg-stone-800 border border-stone-700 rounded-xl text-white placeholder:text-stone-500 outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/50 transition-all"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-gradient-to-l from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white font-bold rounded-xl shadow-lg shadow-amber-900/30 transition-all"
          >
            {loading ? 'جاري الدخول...' : 'دخول'}
          </button>
        </form>
      </div>
    </div>
  );
}
