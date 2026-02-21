import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Calendar, LayoutDashboard, Users, Settings, BarChart2, Bell, LogOut, Sun, Moon, Globe } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LangContext';
import { useTheme } from '../context/ThemeContext';
import { cn } from '../lib/utils';

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, key: 'dashboard' },
  { to: '/appointments', icon: Calendar, key: 'appointments' },
  { to: '/analytics', icon: BarChart2, key: 'analytics' },
  { to: '/notifications', icon: Bell, key: 'notifications' },
  { to: '/staff', icon: Users, key: 'staff' },
  { to: '/settings', icon: Settings, key: 'settings' },
];

export default function BusinessLayout({ children, title }) {
  const { user, logout } = useAuth();
  const { t, lang, toggleLang } = useLang();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();

  return (
    <div className="min-h-screen bg-background font-body">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex fixed left-0 top-0 h-full w-56 flex-col bg-card border-r border-border/50 z-40">
        {/* Logo */}
        <div className="p-4 border-b border-border/50">
          <Link to="/dashboard" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <Calendar className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-heading font-800 text-base">NoShowGone</span>
          </Link>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-0.5">
          {navItems.map(item => (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-heading font-600 transition-all",
                location.pathname === item.to
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
              data-testid={`nav-${item.key}`}
            >
              <item.icon className="w-4 h-4 flex-shrink-0" />
              {t(item.key)}
            </Link>
          ))}
        </nav>

        {/* Bottom */}
        <div className="p-3 border-t border-border/50 space-y-0.5">
          <div className="flex items-center gap-2 px-3 py-2">
            <button onClick={toggleLang} className="text-xs font-heading font-700 text-muted-foreground hover:text-foreground px-2 py-1 rounded-full hover:bg-muted transition-colors">
              {lang === 'fr' ? 'EN' : 'FR'}
            </button>
            <button onClick={toggleTheme} className="p-1.5 rounded-full hover:bg-muted transition-colors ml-auto">
              {theme === 'dark' ? <Sun className="w-4 h-4 text-muted-foreground" /> : <Moon className="w-4 h-4 text-muted-foreground" />}
            </button>
          </div>
          <button
            onClick={logout}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-heading font-600 text-muted-foreground hover:bg-muted hover:text-foreground transition-all w-full"
            data-testid="sidebar-logout"
          >
            <LogOut className="w-4 h-4" />
            {t('logout')}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="md:ml-56 pb-20 md:pb-0">
        {/* Mobile Header */}
        <header className="md:hidden sticky top-0 z-30 bg-background/80 backdrop-blur-md border-b border-border/50 px-4 h-14 flex items-center justify-between">
          <Link to="/dashboard" className="flex items-center gap-2">
            <div className="w-7 h-7 bg-primary rounded-lg flex items-center justify-center">
              <Calendar className="w-3.5 h-3.5 text-primary-foreground" />
            </div>
            <span className="font-heading font-800 text-base">NoShowGone</span>
          </Link>
          <div className="flex items-center gap-1">
            <button onClick={toggleLang} className="text-xs font-heading font-700 text-muted-foreground p-1.5 rounded-full hover:bg-muted transition-colors">
              {lang === 'fr' ? 'EN' : 'FR'}
            </button>
            <button onClick={toggleTheme} className="p-1.5 rounded-full hover:bg-muted transition-colors">
              {theme === 'dark' ? <Sun className="w-4 h-4 text-muted-foreground" /> : <Moon className="w-4 h-4 text-muted-foreground" />}
            </button>
          </div>
        </header>

        {/* Page content */}
        <div className="px-4 md:px-6 py-6">
          {children}
        </div>
      </main>

      {/* Mobile Bottom Nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 glass border-t border-border/50 pb-safe">
        <div className="grid grid-cols-5 h-16">
          {navItems.slice(0, 5).map(item => (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 transition-all",
                location.pathname === item.to
                  ? "text-primary"
                  : "text-muted-foreground"
              )}
              data-testid={`mobile-nav-${item.key}`}
            >
              <item.icon className="w-5 h-5" />
              <span className="text-[10px] font-heading font-600 capitalize">{t(item.key).split(' ')[0]}</span>
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
