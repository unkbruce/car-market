import { Car, CirclePlus, LogOut } from 'lucide-react';
import { Link, NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

function Header() {
  const { currentUser, profile, isAuthenticated, isAuthLoading, logout } = useAuth();
  const isDealer = profile?.role === 'dealer';

  async function handleLogout() {
    await logout();
  }

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white shadow-[0_1px_6px_rgba(15,23,42,0.06)]">
      <div className="mx-auto flex h-14 max-w-[1200px] items-center justify-between px-4 sm:px-5 lg:px-6">
        <Link to="/" className="flex items-center gap-2.5">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-blue-600 text-white shadow-sm">
            <Car size={19} strokeWidth={2.4} />
          </div>
          <h1 className="text-base font-extrabold tracking-tight text-slate-900 sm:text-lg">실시간 Car Market</h1>
        </Link>

        <nav className="flex items-center gap-1.5 text-sm font-medium text-slate-600 sm:gap-3">
          <NavLink
            to="/"
            className={({ isActive }) =>
              `rounded-lg px-3 py-2 text-sm font-bold transition ${
                isActive ? 'bg-blue-600 text-white shadow-sm hover:bg-blue-700' : 'hover:bg-slate-100 hover:text-slate-950'
              }`
            }
          >
            차량 목록
          </NavLink>
          {isDealer ? (
            <NavLink
              to="/cars/new"
              className={({ isActive }) =>
                `hidden items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-bold transition sm:inline-flex ${
                  isActive ? 'bg-blue-50 text-blue-700' : 'text-blue-700 hover:bg-blue-50'
                }`
              }
            >
              <CirclePlus size={16} />
              차량 등록
            </NavLink>
          ) : null}
          {isAuthenticated ? (
            <NavLink
              to="/chats"
              className={({ isActive }) =>
                `hidden rounded-lg px-2.5 py-1.5 text-sm font-bold transition sm:inline-flex ${
                  isActive ? 'bg-blue-50 text-blue-700' : 'text-slate-700 hover:bg-slate-100 hover:text-slate-950'
                }`
              }
            >
              상담 목록
            </NavLink>
          ) : null}

          {isAuthLoading ? (
            <span className="hidden h-8 w-20 rounded-lg bg-slate-100 sm:inline-block" aria-label="인증 상태 확인 중" />
          ) : isAuthenticated ? (
            <>
              <span className="hidden max-w-[140px] truncate text-xs font-semibold text-slate-500 md:inline">
                {profile?.displayName || currentUser.displayName || currentUser.email}
              </span>
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-bold text-slate-700 transition hover:bg-slate-50"
                onClick={handleLogout}
              >
                <LogOut size={14} />
                로그아웃
              </button>
            </>
          ) : (
            <>
              <NavLink to="/login" className="rounded-lg px-2.5 py-1.5 text-sm font-semibold transition hover:bg-slate-100 hover:text-slate-950">
                로그인
              </NavLink>
              <NavLink to="/register" className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm font-bold text-slate-800 transition hover:bg-slate-50">
                회원가입
              </NavLink>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}

export default Header;
