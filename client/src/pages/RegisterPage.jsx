import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Header from '../components/Header.jsx';
import { useAuth } from '../context/AuthContext.jsx';

function getRegisterErrorMessage(error) {
  const messages = {
    'auth/email-already-in-use': '이미 사용 중인 이메일입니다. 다른 이메일로 가입하거나 로그인해주세요.',
    'auth/invalid-email': '이메일 형식이 올바르지 않습니다.',
    'auth/weak-password': '비밀번호는 6자리 이상으로 입력해주세요.',
    'auth/network-request-failed': '네트워크 연결을 확인한 뒤 다시 시도해주세요.',
    'auth/operation-not-allowed': 'Firebase 콘솔에서 이메일/비밀번호 로그인을 활성화해주세요.',
  };

  return messages[error.code] || '회원가입에 실패했습니다. 입력 정보를 확인한 뒤 다시 시도해주세요.';
}

function RegisterPage() {
  const navigate = useNavigate();
  const { register } = useAuth();
  const [form, setForm] = useState({
    displayName: '',
    role: 'buyer',
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
      await register(form);
      navigate('/');
    } catch (authError) {
      setError(getRegisterErrorMessage(authError));
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
            <h2 className="text-2xl font-black tracking-tight text-slate-950">회원가입</h2>
          </div>

          <form className="mt-5 grid gap-4" onSubmit={handleSubmit}>
            <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
              이름
              <input
                className="h-11 rounded-lg border border-slate-300 px-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                name="displayName"
                type="text"
                value={form.displayName}
                onChange={handleChange}
                placeholder="홍길동"
                required
              />
            </label>

            <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
              역할
              <select
                className="h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                name="role"
                value={form.role}
                onChange={handleChange}
              >
                <option value="buyer">일반 사용자</option>
                <option value="dealer">딜러</option>
              </select>
            </label>

            <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
              이메일
              <input
                className="h-11 rounded-lg border border-slate-300 px-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                name="email"
                type="email"
                value={form.email}
                onChange={handleChange}
                placeholder="apple@test.com"
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
                placeholder="6자리 이상 입력"
                minLength={6}
                required
              />
              <span className="text-xs font-medium text-slate-500">비밀번호는 6자리 이상 입력해주세요.</span>
            </label>

            {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-600">{error}</p> : null}

            <button
              type="submit"
              className="mt-1 inline-flex h-11 items-center justify-center rounded-lg bg-blue-600 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isSubmitting}
            >
              {isSubmitting ? '가입 중...' : '회원가입'}
            </button>
          </form>

          <p className="mt-5 text-center text-sm text-slate-500">
            이미 계정이 있나요?{' '}
            <Link to="/login" className="font-bold text-blue-600 hover:text-blue-700">
              로그인
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}

export default RegisterPage;
