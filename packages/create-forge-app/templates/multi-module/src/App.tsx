import { useState, useCallback, useMemo } from 'react';
import { AppLayout, Sidebar, type SidebarItem } from '@forge/ui-kit';
import { getModules, getModuleById } from './modules/registry';

export function App() {
  const modules = useMemo(() => getModules(), []);
  const [activeId, setActiveId] = useState(modules[0]?.id ?? '');

  const sidebarItems: SidebarItem[] = useMemo(
    () => modules.map(m => ({ id: m.id, label: m.label })),
    [modules],
  );

  const ActiveComponent = useMemo(() => {
    const mod = getModuleById(activeId);
    return mod?.component ?? null;
  }, [activeId]);

  const renderContent = useCallback(() => {
    if (!ActiveComponent) {
      return (
        <div className="text-gray-500 dark:text-gray-400">
          No modules registered.
        </div>
      );
    }
    return <ActiveComponent />;
  }, [ActiveComponent]);

  return (
    <AppLayout
      sidebar={
        <Sidebar
          title="Multi-Module"
          items={sidebarItems}
          activeId={activeId}
          onSelect={setActiveId}
          footer={
            <div className="text-xs text-gray-400">
              {modules.length} module{modules.length !== 1 ? 's' : ''} loaded
            </div>
          }
        />
      }
    >
      {renderContent()}
    </AppLayout>
  );
}
