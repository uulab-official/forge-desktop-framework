import { useState, useCallback } from 'react';
import { AppLayout, Sidebar, type SidebarItem } from '@forge/ui-kit';
import { HomePage } from './pages/HomePage';
import { SettingsPage } from './pages/SettingsPage';

const NAV_ITEMS: SidebarItem[] = [
  { id: 'home', label: 'Home' },
  { id: 'settings', label: 'Settings' },
];

export function App() {
  const [activePage, setActivePage] = useState('home');

  const renderPage = useCallback(() => {
    switch (activePage) {
      case 'settings':
        return <SettingsPage />;
      default:
        return <HomePage />;
    }
  }, [activePage]);

  return (
    <AppLayout
      sidebar={
        <Sidebar
          title="Forge Studio"
          items={NAV_ITEMS}
          activeId={activePage}
          onSelect={setActivePage}
        />
      }
    >
      {renderPage()}
    </AppLayout>
  );
}
