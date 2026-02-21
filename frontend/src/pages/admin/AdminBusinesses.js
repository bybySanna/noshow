import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Building2, Calendar, LayoutDashboard, LogOut, Sun, Moon, ChevronRight, ToggleLeft, ToggleRight, CheckCircle, X } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { useAuth } from '../../context/AuthContext';
import { useLang } from '../../context/LangContext';
import { useTheme } from '../../context/ThemeContext';
import axios from 'axios';
import { API } from '../../context/AuthContext';
import { toast } from 'sonner';
import { cn } from '../../lib/utils';
import { useLocation } from 'react-router-dom';

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
        <div className="p-3 border-t border-border/50">
          <div className="flex items-center gap-2 px-3 py-2">
            <button onClick={toggleLang} className="text-xs font-heading font-700 text-muted-foreground hover:text-foreground px-2 py-1 rounded-full hover:bg-muted">{lang === 'fr' ? 'EN' : 'FR'}</button>
            <button onClick={toggleTheme} className="p-1.5 rounded-full hover:bg-muted ml-auto">
              {theme === 'dark' ? <Sun className="w-4 h-4 text-muted-foreground" /> : <Moon className="w-4 h-4 text-muted-foreground" />}
            </button>
          </div>
          <button onClick={logout} className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-heading font-600 text-muted-foreground hover:bg-muted w-full">
            <LogOut className="w-4 h-4" />
            {lang === 'fr' ? 'Déconnexion' : 'Logout'}
          </button>
        </div>
      </aside>
      <main className="md:ml-52">
        <header className="md:hidden sticky top-0 z-30 bg-background/80 backdrop-blur-md border-b border-border/50 px-4 h-14 flex items-center justify-between">
          <span className="font-heading font-800 text-sm">Admin</span>
          <div className="flex gap-1">
            <button onClick={toggleLang} className="text-xs font-heading font-700 text-muted-foreground p-1.5">{lang === 'fr' ? 'EN' : 'FR'}</button>
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

const PLAN_LABELS = { free_trial: 'Trial', solo: 'Solo', pro: 'Pro', business: 'Business' };
const PLAN_COLORS = {
  free_trial: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  solo: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  pro: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  business: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
};

export default function AdminBusinesses() {
  const { lang } = useLang();
  const [businesses, setBusinesses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedBiz, setSelectedBiz] = useState(null);

  useEffect(() => { fetchBusinesses(); }, []);

  const fetchBusinesses = async () => {
    try {
      const res = await axios.get(`${API}/admin/businesses`);
      setBusinesses(res.data);
    } catch {
      toast.error('Error');
    } finally {
      setLoading(false);
    }
  };

  const toggleBiz = async (id) => {
    try {
      const res = await axios.put(`${API}/admin/businesses/${id}/toggle`);
      toast.success(res.data.is_active
        ? (lang === 'fr' ? 'Entreprise activée' : 'Business activated')
        : (lang === 'fr' ? 'Entreprise suspendue' : 'Business suspended')
      );
      fetchBusinesses();
      setSelectedBiz(null);
    } catch {
      toast.error('Error');
    }
  };

  const updatePlan = async (id, plan) => {
    try {
      await axios.put(`${API}/admin/businesses/${id}/subscription`, { plan, status: 'active' });
      toast.success(lang === 'fr' ? 'Plan mis à jour' : 'Plan updated');
      fetchBusinesses();
    } catch {
      toast.error('Error');
    }
  };

  return (
    <AdminLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-heading font-800">
          {lang === 'fr' ? 'Entreprises' : 'Businesses'}
        </h1>
        <p className="text-sm text-muted-foreground">{businesses.length} {lang === 'fr' ? 'entreprises' : 'businesses'}</p>
      </div>

      {loading ? (
        <div className="flex justify-center h-64 items-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-2">
          {businesses.map(biz => (
            <div
              key={biz.id}
              className="bg-card rounded-xl border border-border/50 p-4 cursor-pointer hover:border-primary/20 transition-all"
              onClick={() => setSelectedBiz(biz)}
              data-testid="admin-business-row"
            >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${biz.is_active ? 'bg-primary/10' : 'bg-muted'}`}>
                  <Building2 className={`w-5 h-5 ${biz.is_active ? 'text-primary' : 'text-muted-foreground'}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-heading font-700 text-sm">{biz.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{biz.owner?.email}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={cn("text-[11px] font-heading font-700 px-2 py-0.5 rounded-full", PLAN_COLORS[biz.subscription?.plan] || PLAN_COLORS.free_trial)}>
                    {PLAN_LABELS[biz.subscription?.plan] || 'Trial'}
                  </span>
                  {!biz.is_active && (
                    <span className="text-[11px] font-heading font-700 px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                      {lang === 'fr' ? 'Suspendu' : 'Suspended'}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground pl-[52px]">
                <span>{biz.appointment_count || 0} {lang === 'fr' ? 'RDV' : 'appts'}</span>
                <span>{biz.business_type}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Business detail modal */}
      {selectedBiz && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end md:items-center justify-center p-4" onClick={() => setSelectedBiz(null)}>
          <div className="bg-card rounded-2xl w-full max-w-md p-6 border border-border" onClick={e => e.stopPropagation()} data-testid="admin-biz-detail">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-heading font-800 text-lg">{selectedBiz.name}</h3>
              <button onClick={() => setSelectedBiz(null)} className="p-1 rounded-full hover:bg-muted">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 mb-5 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Type</span><span className="font-heading font-600">{selectedBiz.business_type}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Owner</span><span className="font-heading font-600">{selectedBiz.owner?.full_name}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Email</span><span className="font-heading font-600">{selectedBiz.owner?.email}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Plan</span>
                <span className={cn("text-[11px] font-heading font-700 px-2 py-0.5 rounded-full", PLAN_COLORS[selectedBiz.subscription?.plan])}>{PLAN_LABELS[selectedBiz.subscription?.plan]}</span>
              </div>
              <div className="flex justify-between"><span className="text-muted-foreground">RDV</span><span className="font-heading font-600">{selectedBiz.appointment_count}</span></div>
            </div>

            {/* Plan update */}
            <div className="mb-4">
              <p className="text-xs font-heading font-700 text-muted-foreground mb-2">{lang === 'fr' ? 'Changer de plan :' : 'Change plan:'}</p>
              <div className="flex gap-2 flex-wrap">
                {['free_trial', 'solo', 'pro', 'business'].map(plan => (
                  <button key={plan} onClick={() => updatePlan(selectedBiz.id, plan)}
                    className={cn("text-xs font-heading font-700 px-3 py-1.5 rounded-full border transition-all",
                      selectedBiz.subscription?.plan === plan ? "bg-primary text-primary-foreground border-primary" : "border-border hover:border-primary hover:text-primary"
                    )}
                    data-testid={`plan-btn-${plan}`}
                  >
                    {PLAN_LABELS[plan]}
                  </button>
                ))}
              </div>
            </div>

            {/* Toggle active */}
            <Button
              variant="outline"
              className={cn("w-full rounded-full font-heading font-700", selectedBiz.is_active ? "border-destructive text-destructive hover:bg-destructive/10" : "border-primary text-primary hover:bg-primary/10")}
              onClick={() => toggleBiz(selectedBiz.id)}
              data-testid="toggle-business-btn"
            >
              {selectedBiz.is_active
                ? (lang === 'fr' ? 'Suspendre l\'entreprise' : 'Suspend business')
                : (lang === 'fr' ? 'Réactiver l\'entreprise' : 'Reactivate business')}
            </Button>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
