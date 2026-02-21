import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Calendar, LayoutDashboard, Building2, Users, BarChart2, Bell, CreditCard, Activity, LogOut, Sun, Moon, ChevronRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LangContext';
import { useTheme } from '../context/ThemeContext';
import { cn } from '../lib/utils';

const navItems = [
  { to: '/admin', icon: LayoutDashboard, label_fr: 'Dashboard', label_en: 'Dashboard', exact: true },
  { to: '/admin/businesses', icon: Building2, label_fr: 'Entreprises', label_en: 'Businesses' },
  { to: '/admin/plans', icon: CreditCard, label_fr: 'Plans & Prix', label_en: 'Plans & Pricing' },
  { to: '/admin/users', icon: Users, label_fr: 'Utilisateurs', label_en: 'Users' },
  { to: '/admin/activity', icon: Activity, label_fr: 'Activité', label_en: 'Activity' },
  { to: '/admin/stats', icon: BarChart2, label_fr: 'Statistiques', label_en: 'Analytics' },
];

export default function AdminLayout({ children }) {
  const { logout } = useAuth();
  const { lang, toggleLang } = useLang();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();

  const isActive = (item) => item.exact ? location.pathname === item.to : location.pathname.startsWith(item.to);

  return (
    <div className="min-h-screen bg-background font-body flex">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex fixed left-0 top-0 h-full w-56 flex-col bg-card border-r border-border/50 z-40">
        <div className="p-4 border-b border-border/50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <Calendar className="w-4 h-4 text-primary-foreground" />
            </div>
            <div>
              <span className="font-heading font-800 text-sm block">NoShowGone</span>
              <span className="text-[10px] text-accent font-heading font-700 uppercase tracking-wide">Super Admin</span>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {navItems.map(item => (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-heading font-600 transition-all",
                isActive(item)
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
              data-testid={`admin-nav-${item.to.replace('/admin/', '').replace('/admin', 'home')}`}
            >
              <item.icon className="w-4 h-4 flex-shrink-0" />
              {lang === 'fr' ? item.label_fr : item.label_en}
            </Link>
          ))}
        </nav>

        <div className="p-3 border-t border-border/50 space-y-1">
          <div className="flex items-center gap-2 px-3 py-1.5">
            <button
              onClick={toggleLang}
              className="text-xs font-heading font-700 text-muted-foreground hover:text-foreground px-2 py-1 rounded-full hover:bg-muted transition-colors"
              data-testid="admin-lang-toggle"
            >
              {lang === 'fr' ? 'EN' : 'FR'}
            </button>
            <button
              onClick={toggleTheme}
              className="p-1.5 rounded-full hover:bg-muted transition-colors ml-auto"
              data-testid="admin-theme-toggle"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4 text-muted-foreground" /> : <Moon className="w-4 h-4 text-muted-foreground" />}
            </button>
          </div>
          <button
            onClick={logout}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-heading font-600 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all w-full"
            data-testid="admin-logout-btn"
          >
            <LogOut className="w-4 h-4" />
            {lang === 'fr' ? 'Déconnexion' : 'Logout'}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 md:ml-56 min-h-screen pb-24 md:pb-0">
        {/* Mobile top bar */}
        <header className="md:hidden sticky top-0 z-30 bg-card border-b border-border/50 px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-primary rounded-lg flex items-center justify-center">
              <Calendar className="w-3.5 h-3.5 text-primary-foreground" />
            </div>
            <span className="font-heading font-800 text-sm">Admin</span>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={toggleLang} className="text-xs font-heading font-700 text-muted-foreground px-2 py-1 rounded-full hover:bg-muted">
              {lang === 'fr' ? 'EN' : 'FR'}
            </button>
            <button onClick={toggleTheme} className="p-1.5 rounded-full hover:bg-muted">
              {theme === 'dark' ? <Sun className="w-4 h-4 text-muted-foreground" /> : <Moon className="w-4 h-4 text-muted-foreground" />}
            </button>
            <button onClick={logout} className="p-1.5 rounded-full hover:bg-destructive/10 text-muted-foreground hover:text-destructive" data-testid="mobile-admin-logout">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </header>

        <div className="px-4 md:px-6 py-6">
          {children}
        </div>
      </main>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-card border-t border-border/50 pb-safe">
        <div className="grid grid-cols-5 h-16">
          {navItems.slice(0, 4).map(item => (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 transition-all",
                isActive(item) ? "text-primary" : "text-muted-foreground"
              )}
            >
              <item.icon className="w-5 h-5" />
              <span className="text-[9px] font-heading font-600">{(lang === 'fr' ? item.label_fr : item.label_en).split(' ')[0]}</span>
            </Link>
          ))}
          <button
            onClick={logout}
            className="flex flex-col items-center justify-center gap-0.5 text-muted-foreground hover:text-destructive transition-colors"
            data-testid="mobile-bottom-logout"
          >
            <LogOut className="w-5 h-5" />
            <span className="text-[9px] font-heading font-600">{lang === 'fr' ? 'Quitter' : 'Logout'}</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
