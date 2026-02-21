import React, { useState, useEffect } from 'react';
import { Calendar, Plus, CheckCircle, X, Clock, RefreshCw, ChevronRight, Search } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useLang } from '../../context/LangContext';
import { useTheme } from '../../context/ThemeContext';
import AddAppointmentModal from '../../components/AddAppointmentModal';
import axios from 'axios';
import { API } from '../../context/AuthContext';
import { toast } from 'sonner';
import { cn } from '../../lib/utils';
import { Sun, Moon, LogOut } from 'lucide-react';

const STATUS_CONFIG = {
  confirmed: { label_fr: 'Confirmé', label_en: 'Confirmed', className: 'status-confirmed' },
  pending: { label_fr: 'En attente', label_en: 'Pending', className: 'status-pending' },
  no_show: { label_fr: 'Absent', label_en: 'No Show', className: 'status-no_show' },
  cancelled: { label_fr: 'Annulé', label_en: 'Cancelled', className: 'status-cancelled' },
  completed: { label_fr: 'Terminé', label_en: 'Completed', className: 'status-completed' },
};

export default function StaffDashboard() {
  const { user, logout } = useAuth();
  const { lang, toggleLang } = useLang();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const today = new Date().toISOString().split('T')[0];

  useEffect(() => { fetchAppointments(); }, []);

  const fetchAppointments = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const res = await axios.get(`${API}/appointments`);
      setAppointments(res.data);
    } catch {
      toast.error('Error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const updateStatus = async (id, status) => {
    try {
      await axios.put(`${API}/appointments/${id}`, { status });
      toast.success(lang === 'fr' ? 'Statut mis à jour' : 'Status updated');
      fetchAppointments(true);
    } catch { toast.error('Error'); }
  };

  const todayAppts = appointments.filter(a => a.date === today);
  const filteredAppts = appointments.filter(a => 
    a.client_name?.toLowerCase().includes(search.toLowerCase()) ||
    a.client_phone?.includes(search)
  );

  return (
    <div className="min-h-screen bg-background font-body pb-20">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-md border-b border-border/50 px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-primary rounded-lg flex items-center justify-center">
            <Calendar className="w-3.5 h-3.5 text-primary-foreground" />
          </div>
          <div>
            <span className="font-heading font-800 text-sm">NoShowGone</span>
            <span className="text-xs text-muted-foreground ml-2">Staff</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => fetchAppointments(true)} className="p-1.5 rounded-full hover:bg-muted" data-testid="staff-refresh-btn">
            <RefreshCw className={cn("w-4 h-4 text-muted-foreground", refreshing && "animate-spin")} />
          </button>
          <button onClick={toggleTheme} className="p-1.5 rounded-full hover:bg-muted">
            {theme === 'dark' ? <Sun className="w-4 h-4 text-muted-foreground" /> : <Moon className="w-4 h-4 text-muted-foreground" />}
          </button>
          <button onClick={logout} className="p-1.5 rounded-full hover:bg-muted text-muted-foreground">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      <div className="px-4 py-5">
        {/* Welcome */}
        <div className="mb-5">
          <h1 className="text-xl font-heading font-800">
            {lang === 'fr' ? 'Bonjour' : 'Hello'} {user?.full_name?.split(' ')[0]}
          </h1>
          <p className="text-sm text-muted-foreground">
            {lang === 'fr' ? 'Vue staff - accès limité' : 'Staff view - limited access'}
          </p>
        </div>

        {/* Today summary */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          <div className="bg-card rounded-xl p-4 border border-border/50">
            <div className="text-2xl font-heading font-800 text-primary">{todayAppts.length}</div>
            <div className="text-xs text-muted-foreground">{lang === 'fr' ? "Aujourd'hui" : 'Today'}</div>
          </div>
          <div className="bg-card rounded-xl p-4 border border-border/50">
            <div className="text-2xl font-heading font-800 text-primary">{appointments.length}</div>
            <div className="text-xs text-muted-foreground">{lang === 'fr' ? 'Total' : 'Total'}</div>
          </div>
        </div>

        {/* Today's appointments */}
        <h2 className="font-heading font-700 text-base mb-3">
          {lang === 'fr' ? "Aujourd'hui" : 'Today'} ({todayAppts.length})
        </h2>

        {loading ? (
          <div className="flex justify-center h-32 items-center">
            <div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : todayAppts.length === 0 ? (
          <div className="bg-card rounded-xl border border-border/50 p-8 text-center mb-5">
            <Calendar className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">{lang === 'fr' ? 'Aucun RDV aujourd\'hui' : 'No appointments today'}</p>
          </div>
        ) : (
          <div className="space-y-2 mb-5">
            {todayAppts.map(appt => {
              const statusConf = STATUS_CONFIG[appt.status] || STATUS_CONFIG.pending;
              return (
                <div key={appt.id} className="bg-card rounded-xl border border-border/50 p-3 flex items-center gap-3" data-testid="staff-appointment-card">
                  <div className="text-center min-w-[44px]">
                    <div className="font-mono text-sm font-500">{appt.time}</div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-heading font-700 text-sm">{appt.client_name}</p>
                    <p className="text-xs text-muted-foreground">{appt.client_phone}</p>
                  </div>
                  <span className={cn("text-[11px] font-heading font-700 px-2 py-0.5 rounded-full", statusConf.className)}>
                    {lang === 'fr' ? statusConf.label_fr : statusConf.label_en}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* All appointments */}
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-heading font-700 text-base">
            {lang === 'fr' ? 'Tous les RDV' : 'All Appointments'}
          </h2>
        </div>
        
        {/* Search */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder={lang === 'fr' ? 'Rechercher...' : 'Search...'}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 h-10 rounded-xl"
            data-testid="staff-search"
          />
        </div>
        
        <div className="space-y-2">
          {(search ? filteredAppts : appointments).slice(0, 15).map(appt => {
            const statusConf = STATUS_CONFIG[appt.status] || STATUS_CONFIG.pending;
            return (
              <div key={appt.id} className="bg-card rounded-xl border border-border/50 p-3 flex items-center gap-3">
                <div className="text-center min-w-[52px]">
                  <div className="font-mono text-xs font-500">{appt.time}</div>
                  <div className="text-[10px] text-muted-foreground">{appt.date?.slice(5)}</div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-heading font-700 text-sm">{appt.client_name}</p>
                  <p className="text-xs text-muted-foreground">{appt.client_phone}</p>
                </div>
                <span className={cn("text-[11px] font-heading font-700 px-2 py-0.5 rounded-full", statusConf.className)}>
                  {lang === 'fr' ? statusConf.label_fr : statusConf.label_en}
                </span>
                {appt.status === 'pending' && (
                  <button 
                    onClick={() => updateStatus(appt.id, 'confirmed')}
                    className="p-1.5 rounded-full bg-green-100 dark:bg-green-900/20 hover:bg-green-200 dark:hover:bg-green-900/40 transition-colors"
                    data-testid="staff-confirm-btn"
                  >
                    <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* FAB */}
      <button
        onClick={() => setShowAddModal(true)}
        className="fixed bottom-6 right-4 w-14 h-14 bg-primary rounded-full flex items-center justify-center shadow-lg hover:bg-primary/90 transition-all active:scale-95 z-30"
        data-testid="staff-fab-add"
      >
        <Plus className="w-6 h-6 text-primary-foreground" />
      </button>

      {showAddModal && (
        <AddAppointmentModal
          onClose={() => setShowAddModal(false)}
          onSuccess={() => { setShowAddModal(false); fetchAppointments(); }}
        />
      )}
    </div>
  );
}
