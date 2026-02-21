import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, Building2, Users, BarChart2, Calendar, Settings, LogOut, Sun, Moon, Globe, ChevronRight, TrendingDown, DollarSign } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useLang } from '../../context/LangContext';
import { useTheme } from '../../context/ThemeContext';
import axios from 'axios';
import { API } from '../../context/AuthContext';
import { toast } from 'sonner';
import { cn } from '../../lib/utils';

const navItems = [
  { to: '/admin', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/admin/businesses', icon: Building2, label: 'Businesses' },
];

function AdminLayout({ children }) {
  const { logout } = useAuth();
  const { lang, toggleLang } = useLang();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();

  return (
    <div className="min-h-screen bg-background font-body">
      <aside className="hidden md:flex fixed left-0 top-0 h-full w-52 flex-col bg-card border-r border-border/50 z-40">
        <div className="p-4 border-b border-border/50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <Calendar className="w-4 h-4 text-primary-foreground" />
            </div>
            <div>
              <span className="font-heading font-800 text-sm block">NoShowGone</span>
              <span className="text-[10px] text-accent font-heading font-700">Super Admin</span>
            </div>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-0.5">
          {navItems.map(item => (
            <Link key={item.to} to={item.to}
              className={cn("flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-heading font-600 transition-all",
                location.pathname === item.to ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}>
              <item.icon className="w-4 h-4" />
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="p-3 border-t border-border/50 space-y-0.5">
          <div className="flex items-center gap-2 px-3 py-2">
            <button onClick={toggleLang} className="text-xs font-heading font-700 text-muted-foreground hover:text-foreground px-2 py-1 rounded-full hover:bg-muted transition-colors">
              {lang === 'fr' ? 'EN' : 'FR'}
            </button>
            <button onClick={toggleTheme} className="p-1.5 rounded-full hover:bg-muted transition-colors ml-auto">
              {theme === 'dark' ? <Sun className="w-4 h-4 text-muted-foreground" /> : <Moon className="w-4 h-4 text-muted-foreground" />}
            </button>
          </div>
          <button onClick={logout} className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-heading font-600 text-muted-foreground hover:bg-muted hover:text-foreground transition-all w-full">
            <LogOut className="w-4 h-4" />
            {lang === 'fr' ? 'Déconnexion' : 'Logout'}
          </button>
        </div>
      </aside>

      <main className="md:ml-52">
        <header className="md:hidden sticky top-0 z-30 bg-background/80 backdrop-blur-md border-b border-border/50 px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-primary rounded-lg flex items-center justify-center">
              <Calendar className="w-3.5 h-3.5 text-primary-foreground" />
            </div>
            <span className="font-heading font-800 text-sm">Admin</span>
          </div>
          <div className="flex gap-1">
            <button onClick={toggleLang} className="text-xs font-heading font-700 text-muted-foreground p-1.5 rounded-full hover:bg-muted">{lang === 'fr' ? 'EN' : 'FR'}</button>
            <button onClick={toggleTheme} className="p-1.5 rounded-full hover:bg-muted">
              {theme === 'dark' ? <Sun className="w-4 h-4 text-muted-foreground" /> : <Moon className="w-4 h-4 text-muted-foreground" />}
            </button>
          </div>
        </header>
        <div className="px-4 md:px-6 py-6">{children}</div>
      </main>
    </div>
  );
}

export default function AdminDashboard() {
  const { lang } = useLang();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchStats(); }, []);

  const fetchStats = async () => {
    try {
      const res = await axios.get(`${API}/admin/dashboard`);
      setStats(res.data);
    } catch {
      toast.error('Error loading admin stats');
    } finally {
      setLoading(false);
    }
  };

  const kpis = stats ? [
    { label: lang === 'fr' ? 'Entreprises' : 'Businesses', value: stats.total_businesses, icon: Building2, color: 'text-primary', bg: 'bg-primary/10' },
    { label: lang === 'fr' ? 'RDV totaux' : 'Total Appts', value: stats.total_appointments, icon: Calendar, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-100 dark:bg-blue-900/20' },
    { label: lang === 'fr' ? 'Taux absence' : 'No-show Rate', value: `${stats.no_show_rate}%`, icon: TrendingDown, color: 'text-accent', bg: 'bg-orange-100 dark:bg-orange-900/20' },
    { label: 'MRR', value: `${stats.mrr}€`, icon: DollarSign, color: 'text-primary', bg: 'bg-primary/10' },
  ] : [];

  const planColors = {
    free_trial: '#f59e0b',
    solo: '#3b82f6',
    pro: '#15803d',
    business: '#8b5cf6',
  };

  return (
    <AdminLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-heading font-800">
          {lang === 'fr' ? 'Super Admin' : 'Super Admin'}
        </h1>
        <p className="text-sm text-muted-foreground">
          {lang === 'fr' ? 'Vue globale de la plateforme' : 'Platform overview'}
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center h-64 items-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            {kpis.map((kpi, i) => (
              <div key={i} className="bg-card rounded-2xl p-4 border border-border/50 card-shadow" data-testid={`admin-kpi-${i}`}>
                <div className={`w-9 h-9 ${kpi.bg} rounded-xl flex items-center justify-center mb-3`}>
                  <kpi.icon style={{width: '18px', height: '18px'}} className={kpi.color} />
                </div>
                <div className={`text-2xl font-heading font-800 ${kpi.color}`}>{kpi.value}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{kpi.label}</div>
              </div>
            ))}
          </div>

          {/* Subscription breakdown */}
          <div className="bg-card rounded-2xl border border-border/50 p-5 mb-5 card-shadow">
            <h2 className="font-heading font-700 text-base mb-4">
              {lang === 'fr' ? 'Répartition abonnements' : 'Subscription Breakdown'}
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {stats?.subscription_breakdown && Object.entries(stats.subscription_breakdown).map(([plan, count]) => (
                <div key={plan} className="text-center p-3 bg-muted/50 rounded-xl">
                  <div className="text-xl font-heading font-800" style={{color: planColors[plan]}}>{count}</div>
                  <div className="text-xs text-muted-foreground capitalize mt-0.5">
                    {plan === 'free_trial' ? (lang === 'fr' ? 'Essai' : 'Trial') : plan}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick links */}
          <div className="bg-card rounded-2xl border border-border/50 p-5 card-shadow">
            <h2 className="font-heading font-700 text-base mb-3">
              {lang === 'fr' ? 'Actions rapides' : 'Quick Actions'}
            </h2>
            <div className="space-y-2">
              <Link to="/admin/businesses" className="flex items-center justify-between p-3 hover:bg-muted rounded-xl transition-colors" data-testid="admin-link-businesses">
                <div className="flex items-center gap-3">
                  <Building2 className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-heading font-600">{lang === 'fr' ? 'Gérer les entreprises' : 'Manage businesses'}</span>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </Link>
            </div>
          </div>
        </>
      )}
    </AdminLayout>
  );
}
