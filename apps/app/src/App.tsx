import { useState, useCallback, useEffect } from 'react';
import { HomePage } from './pages/HomePage';
import { SettingsPage } from './pages/SettingsPage';

const NAV_ITEMS = [
  { id: 'home', label: 'Home', icon: HomeIcon },
  { id: 'worker', label: 'Worker', icon: CpuIcon },
  { id: 'settings', label: 'Settings', icon: GearIcon },
] as const;

export function App() {
  const [activePage, setActivePage] = useState('home');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    // Detect system dark mode
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    document.documentElement.classList.toggle('dark', mq.matches);
    const handler = (e: MediaQueryListEvent) => {
      document.documentElement.classList.toggle('dark', e.matches);
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const renderPage = useCallback(() => {
    switch (activePage) {
      case 'settings':
        return <SettingsPage />;
      case 'worker':
        return <HomePage />;
      default:
        return <DashboardPage />;
    }
  }, [activePage]);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
      {/* Custom titlebar */}
      <div className="drag-region fixed top-0 left-0 right-0 h-8 z-50" />

      {/* Sidebar */}
      <aside
        className={`flex flex-col flex-shrink-0 border-r border-zinc-200 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-900/80 backdrop-blur-xl pt-8 transition-all duration-200 ${
          sidebarCollapsed ? 'w-16' : 'w-56'
        }`}
      >
        {/* Logo */}
        <div className="px-4 py-3 flex items-center gap-2.5 no-drag">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
            <span className="text-white text-xs font-bold">F</span>
          </div>
          {!sidebarCollapsed && (
            <span className="text-sm font-semibold tracking-tight animate-fade-in">
              Forge
            </span>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 py-2 space-y-0.5 no-drag">
          {NAV_ITEMS.map((item) => {
            const active = activePage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActivePage(item.id)}
                className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] font-medium transition-all ${
                  active
                    ? 'bg-zinc-200/80 dark:bg-zinc-800 text-zinc-900 dark:text-white'
                    : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 hover:text-zinc-700 dark:hover:text-zinc-300'
                }`}
              >
                <item.icon active={active} />
                {!sidebarCollapsed && (
                  <span className="animate-fade-in">{item.label}</span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Bottom: collapse toggle */}
        <div className="px-2 pb-3 no-drag">
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="w-full flex items-center justify-center px-2.5 py-2 rounded-lg text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 hover:text-zinc-600 dark:hover:text-zinc-300 transition-all"
          >
            <svg
              className={`w-4 h-4 transition-transform duration-200 ${sidebarCollapsed ? 'rotate-180' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 19l-7-7 7-7M18 19l-7-7 7-7" />
            </svg>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto pt-8">
        <div className="animate-fade-in">
          {renderPage()}
        </div>
      </main>
    </div>
  );
}

// ─── Dashboard (Home) ──────────────────────────────────────

function DashboardPage() {
  const [workerStatus, setWorkerStatus] = useState<'idle' | 'checking' | 'online' | 'offline'>('idle');
  const [workerInfo, setWorkerInfo] = useState<Record<string, unknown> | null>(null);

  const checkWorker = async () => {
    setWorkerStatus('checking');
    try {
      const api = (window as any).electronAPI;
      const res = await api.worker.execute({ action: 'health_check', payload: {} });
      if (res.success) {
        setWorkerStatus('online');
        setWorkerInfo(res.data);
      } else {
        setWorkerStatus('offline');
      }
    } catch {
      setWorkerStatus('offline');
    }
  };

  useEffect(() => { checkWorker(); }, []);

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
          Forge Desktop Framework
        </p>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-3 gap-4">
        <StatusCard
          label="Worker"
          value={workerStatus === 'online' ? 'Online' : workerStatus === 'checking' ? 'Checking...' : workerStatus === 'offline' ? 'Offline' : 'Not checked'}
          status={workerStatus === 'online' ? 'success' : workerStatus === 'offline' ? 'error' : 'neutral'}
          detail={workerInfo ? `Python ${(workerInfo.python_version as string)?.split(' ')[0]}` : undefined}
        />
        <StatusCard
          label="Platform"
          value={workerInfo?.platform as string ?? navigator.platform}
          status="neutral"
          detail={workerInfo?.arch as string}
        />
        <StatusCard
          label="Engine"
          value="stdin/stdout"
          status="neutral"
          detail="JSON IPC Protocol"
        />
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-3">
          Quick Actions
        </h2>
        <div className="grid grid-cols-2 gap-3">
          <ActionCard
            title="Health Check"
            description="Verify Python worker connection"
            onClick={checkWorker}
            color="violet"
          />
          <ActionCard
            title="Run Example"
            description="Execute echo action with test payload"
            onClick={async () => {
              try {
                const api = (window as any).electronAPI;
                await api.worker.execute({
                  action: 'echo',
                  payload: { message: 'Hello!', ts: Date.now() },
                });
              } catch { /* handled by worker page */ }
            }}
            color="emerald"
          />
        </div>
      </div>

      {/* Architecture */}
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 p-5">
        <h2 className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-4">
          Architecture
        </h2>
        <div className="flex items-center justify-center gap-3 py-4">
          {['React UI', 'Electron IPC', 'Python Worker'].map((label, i) => (
            <div key={label} className="flex items-center gap-3">
              <div className="px-4 py-2.5 rounded-lg bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 shadow-sm">
                <span className="text-xs font-medium">{label}</span>
              </div>
              {i < 2 && (
                <svg className="w-4 h-4 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5-5 5M6 12h12" />
                </svg>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Components ────────────────────────────────────────────

function StatusCard({ label, value, status, detail }: {
  label: string;
  value: string;
  status: 'success' | 'error' | 'neutral';
  detail?: string;
}) {
  const dotColor = status === 'success'
    ? 'bg-emerald-500'
    : status === 'error'
    ? 'bg-red-500'
    : 'bg-zinc-400 dark:bg-zinc-600';

  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 space-y-2">
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${dotColor} ${status === 'success' ? 'animate-pulse-dot' : ''}`} />
        <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
          {label}
        </span>
      </div>
      <p className="text-lg font-semibold">{value}</p>
      {detail && (
        <p className="text-xs text-zinc-400 dark:text-zinc-500">{detail}</p>
      )}
    </div>
  );
}

function ActionCard({ title, description, onClick, color }: {
  title: string;
  description: string;
  onClick: () => void;
  color: 'violet' | 'emerald' | 'blue' | 'amber';
}) {
  const colors = {
    violet: 'hover:border-violet-300 dark:hover:border-violet-700 hover:shadow-violet-100 dark:hover:shadow-violet-900/20',
    emerald: 'hover:border-emerald-300 dark:hover:border-emerald-700 hover:shadow-emerald-100 dark:hover:shadow-emerald-900/20',
    blue: 'hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-blue-100 dark:hover:shadow-blue-900/20',
    amber: 'hover:border-amber-300 dark:hover:border-amber-700 hover:shadow-amber-100 dark:hover:shadow-amber-900/20',
  };

  return (
    <button
      onClick={onClick}
      className={`text-left rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 hover:shadow-lg transition-all duration-200 group ${colors[color]}`}
    >
      <h3 className="text-sm font-semibold group-hover:text-zinc-900 dark:group-hover:text-white">
        {title}
      </h3>
      <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">{description}</p>
    </button>
  );
}

// ─── Icons (inline SVG, no deps) ───────────────────────────

function HomeIcon({ active }: { active: boolean }) {
  return (
    <svg className={`w-4 h-4 ${active ? 'text-zinc-900 dark:text-white' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  );
}

function CpuIcon({ active }: { active: boolean }) {
  return (
    <svg className={`w-4 h-4 ${active ? 'text-zinc-900 dark:text-white' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 3v2m6-2v2M9 19v2m6-2v2M3 9h2m-2 6h2m14-6h2m-2 6h2M7 7h10v10H7z" />
    </svg>
  );
}

function GearIcon({ active }: { active: boolean }) {
  return (
    <svg className={`w-4 h-4 ${active ? 'text-zinc-900 dark:text-white' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}
