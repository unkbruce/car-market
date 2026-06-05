import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Header from '../components/Header.jsx';
import { useAuth } from '../context/AuthContext.jsx';

function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [form, setForm] = useState({
    email: '',
    password: '',
  });
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  function handleChange(event) {
    const { name, value } = event.target;

    setForm((currentForm) => ({
      ...currentForm,
      [name]: value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    try {
      setIsSubmitting(true);
      setError('');
      await login(form);
      navigate('/');
    } catch (authError) {
      setError(authError.message || '로그인에 실패했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f8fafc] text-slate-950">
      <Header />

      <section className="mx-auto flex max-w-[1200px] justify-center px-4 py-10 sm:px-5">
        <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-[0_12px_34px_rgba(15,23,42,0.07)]">
          <div>
            <h2 className="text-2xl font-black tracking-tight text-slate-950">로그인</h2>
          </div>

          <form className="mt-5 grid gap-4" onSubmit={handleSubmit}>
            <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
              이메일
              <input
                className="h-11 rounded-lg border border-slate-300 px-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                name="email"
                type="email"
                value={form.email}
                onChange={handleChange}
                required
              />
            </label>

            <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
              비밀번호
              <input
                className="h-11 rounded-lg border border-slate-300 px-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                name="password"
                type="password"
                value={form.password}
                onChange={handleChange}
                required
              />
            </label>

            {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-600">{error}</p> : null}

            <button
              type="submit"
              className="mt-1 inline-flex h-11 items-center justify-center rounded-lg bg-blue-600 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isSubmitting}
            >
              {isSubmitting ? '로그인 중...' : '로그인'}
            </button>
          </form>

          <p className="mt-5 text-center text-sm text-slate-500">
            아직 계정이 없나요?{' '}
            <Link to="/register" className="font-bold text-blue-600 hover:text-blue-700">
              회원가입
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}

export default LoginPage;
