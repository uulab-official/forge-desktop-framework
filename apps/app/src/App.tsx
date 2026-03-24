import React, { useState, useCallback, useEffect, createContext, useContext } from 'react';
import { ForgeErrorBoundary } from '@forge/error-handler';
import { Modal, Badge, ToastContainer } from '@forge/ui-kit';
import type { ToastProps, ToastType } from '@forge/ui-kit';
import { pluginRegistry } from './plugins/registry';
import './plugins/worker-plugin';
import './plugins/settings-plugin';
import { HomePage } from './pages/HomePage';
import { SettingsPage } from './pages/SettingsPage';

// ─── Toast context ─────────────────────────────────────────

interface ToastContextValue {
  addToast: (type: ToastType, message: string) => void;
}

const ToastContext = createContext<ToastContextValue>({
  addToast: () => {},
});

export function useToast() {
  return useContext(ToastContext);
}

let toastSeq = 0;

// ─── Build nav items from plugin registry ──────────────────

const ICON_MAP: Record<string, (props: { active: boolean }) => React.JSX.Element> = {
  '/worker': CpuIcon,
  '/settings': GearIcon,
};

function buildNavItems() {
  const routes = pluginRegistry.getRoutes();
  // Dashboard is always first (built-in, not from a plugin)
  const items: { id: string; label: string; icon: (props: { active: boolean }) => React.JSX.Element }[] = [
    { id: 'home', label: 'Home', icon: HomeIcon },
  ];
  for (const route of routes) {
    items.push({
      id: route.path.replace('/', ''),
      label: route.label,
      icon: ICON_MAP[route.path] ?? HomeIcon,
    });
  }
  return items;
}

export function App() {
  const [activePage, setActivePage] = useState('home');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastProps[]>([]);

  const navItems = buildNavItems();

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(
    (type: ToastType, message: string) => {
      const id = `toast-${++toastSeq}`;
      setToasts((prev) => [...prev, { id, type, message, duration: 4000, onDismiss: dismissToast }]);
    },
    [dismissToast],
  );

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
        return <SettingsPage onOpenAbout={() => setAboutOpen(true)} />;
      case 'worker':
        return <HomePage />;
      default:
        return <DashboardPage />;
    }
  }, [activePage]);

  return (
    <ToastContext.Provider value={{ addToast }}>
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

          {/* Nav — driven by plugin registry */}
          <nav className="flex-1 px-2 py-2 space-y-0.5 no-drag">
            {navItems.map((item) => {
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

          {/* Bottom: About + collapse toggle */}
          <div className="px-2 pb-3 no-drag space-y-0.5">
            <button
              onClick={() => setAboutOpen(true)}
              className="w-full flex items-center justify-center gap-2 px-2.5 py-2 rounded-lg text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 hover:text-zinc-600 dark:hover:text-zinc-300 transition-all"
            >
              <InfoIcon />
              {!sidebarCollapsed && (
                <span className="text-xs font-medium animate-fade-in">About</span>
              )}
            </button>
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

        {/* Main content — wrapped in ForgeErrorBoundary */}
        <main className="flex-1 overflow-y-auto pt-8">
          <ForgeErrorBoundary>
            <div className="animate-fade-in">
              {renderPage()}
            </div>
          </ForgeErrorBoundary>
        </main>

        {/* About Modal (ui-kit) */}
        <Modal open={aboutOpen} onClose={() => setAboutOpen(false)} title="About Forge" size="sm">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
                <span className="text-white text-sm font-bold">F</span>
              </div>
              <div>
                <p className="text-sm font-semibold">Forge Desktop Framework</p>
                <p className="text-xs text-gray-400 dark:text-gray-500">v0.1.0</p>
              </div>
            </div>
            <p className="text-sm leading-relaxed">
              A modular Electron + Python framework for building desktop productivity apps
              with a plugin-based architecture.
            </p>
            <div className="flex flex-wrap gap-2">
              <Badge variant="info">Electron</Badge>
              <Badge variant="success">React</Badge>
              <Badge variant="warning">Python Worker</Badge>
              <Badge variant="default">TypeScript</Badge>
            </div>
            <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
              <p className="text-xs text-gray-400 dark:text-gray-500">
                Registered plugins: {pluginRegistry.getAll().length}
              </p>
              <ul className="mt-1 space-y-0.5">
                {pluginRegistry.getAll().map((p) => (
                  <li key={p.id} className="text-xs text-gray-500 dark:text-gray-400">
                    {p.name} <span className="text-gray-400 dark:text-gray-500">v{p.version}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Modal>

        {/* Toast notifications (ui-kit) */}
        <ToastContainer toasts={toasts} position="top-right" />
      </div>
    </ToastContext.Provider>
  );
}

// ─── Dashboard (Home) ──────────────────────────────────────

function DashboardPage() {
  const [workerStatus, setWorkerStatus] = useState<'idle' | 'checking' | 'online' | 'offline'>('idle');
  const [workerInfo, setWorkerInfo] = useState<Record<string, unknown> | null>(null);
  const { addToast } = useToast();

  const checkWorker = async () => {
    setWorkerStatus('checking');
    try {
      const api = (window as any).electronAPI;
      const res = await api.worker.execute({ action: 'health_check', payload: {} });
      if (res.success) {
        setWorkerStatus('online');
        setWorkerInfo(res.data);
        addToast('success', 'Worker is online and healthy');
      } else {
        setWorkerStatus('offline');
        addToast('error', 'Worker health check failed');
      }
    } catch {
      setWorkerStatus('offline');
      addToast('error', 'Could not reach the worker process');
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
                const res = await api.worker.execute({
                  action: 'echo',
                  payload: { message: 'Hello!', ts: Date.now() },
                });
                addToast('success', 'Echo action completed successfully');
              } catch {
                addToast('error', 'Echo action failed');
              }
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
  const badgeVariant = status === 'success' ? 'success' : status === 'error' ? 'error' : 'default';

  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 space-y-2">
      <div className="flex items-center gap-2">
        <Badge variant={badgeVariant} size="sm">
          {status === 'success' ? 'Online' : status === 'error' ? 'Error' : 'Idle'}
        </Badge>
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

function InfoIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}
