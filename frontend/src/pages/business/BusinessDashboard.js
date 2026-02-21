import React, { useState, useEffect } from 'react';
import { Calendar, TrendingDown, TrendingUp, CheckCircle, AlertCircle, Plus, ArrowRight, Clock, Users, Zap, Bell, RefreshCw } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { useAuth } from '../../context/AuthContext';
import { useLang } from '../../context/LangContext';
import BusinessLayout from '../../components/BusinessLayout';
import AddAppointmentModal from '../../components/AddAppointmentModal';
import axios from 'axios';
import { API } from '../../context/AuthContext';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { cn } from '../../lib/utils';

const STATUS_CONFIG = {
  confirmed: { label_fr: 'Confirmé', label_en: 'Confirmed', className: 'status-confirmed' },
  pending: { label_fr: 'En attente', label_en: 'Pending', className: 'status-pending' },
  no_show: { label_fr: 'Absent', label_en: 'No Show', className: 'status-no_show' },
  cancelled: { label_fr: 'Annulé', label_en: 'Cancelled', className: 'status-cancelled' },
  completed: { label_fr: 'Terminé', label_en: 'Completed', className: 'status-completed' },
  rescheduled: { label_fr: 'Reporté', label_en: 'Rescheduled', className: 'status-rescheduled' },
};

export default function BusinessDashboard() {
  const { user } = useAuth();
  const { lang } = useLang();
  const [stats, setStats] = useState(null);
  const [todayAppts, setTodayAppts] = useState([]);
  const [upcoming, setUpcoming] = useState([]);
  const [business, setBusiness] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const [statsRes, todayRes, upcomingRes, bizRes] = await Promise.all([
        axios.get(`${API}/stats/business`),
        axios.get(`${API}/appointments/today`),
        axios.get(`${API}/appointments/upcoming?days=7`),
        axios.get(`${API}/businesses/me`),
      ]);
      setStats(statsRes.data);
      setTodayAppts(todayRes.data);
      setUpcoming(upcomingRes.data);
      setBusiness(bizRes.data);
    } catch (err) {
      toast.error('Erreur chargement');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const updateStatus = async (id, status) => {
    try {
      await axios.put(`${API}/appointments/${id}`, { status });
      toast.success(lang === 'fr' ? 'Statut mis à jour' : 'Status updated');
      fetchData(true);
    } catch { toast.error('Error'); }
  };

  const sendReminder = async (id) => {
    try {
      await axios.post(`${API}/appointments/${id}/send-reminder`);
      toast.success(lang === 'fr' ? 'Rappel envoyé !' : 'Reminder sent!');
    } catch { toast.error('Error'); }
  };

  if (loading) return (
    <BusinessLayout>
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    </BusinessLayout>
  );

  const statCards = stats ? [
    { label: lang === 'fr' ? "Aujourd'hui" : "Today", value: stats.today, icon: Calendar, color: 'text-primary', bg: 'bg-primary/10' },
    { label: lang === 'fr' ? 'Confirmés' : 'Confirmed', value: stats.confirmed, icon: CheckCircle, color: 'text-green-600 dark:text-green-400', bg: 'bg-green-100 dark:bg-green-900/20' },
    { label: lang === 'fr' ? 'Taux absence' : 'No-show', value: `${stats.no_show_rate}%`, icon: TrendingDown, color: stats.no_show_rate > 20 ? 'text-accent' : 'text-primary', bg: stats.no_show_rate > 20 ? 'bg-orange-100 dark:bg-orange-900/20' : 'bg-primary/10' },
    { label: lang === 'fr' ? 'Économisé' : 'Saved', value: `${stats.money_saved_estimate}€`, icon: TrendingUp, color: 'text-primary', bg: 'bg-primary/10' },
  ] : [];

  return (
    <BusinessLayout>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-heading font-800">
            {lang === 'fr' ? 'Bonjour' : 'Hello'} {user?.full_name?.split(' ')[0]} 
          </h1>
          <p className="text-sm text-muted-foreground">
            {business?.name}
            {business?.subscription?.plan && (
              <span className="ml-2 text-xs font-heading font-700 text-primary bg-primary/10 px-2 py-0.5 rounded-full capitalize">{business.subscription.plan}</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => fetchData(true)} className="p-2 rounded-full hover:bg-muted transition-colors" data-testid="refresh-btn">
            <RefreshCw className={`w-4 h-4 text-muted-foreground ${refreshing ? 'animate-spin' : ''}`} />
          </button>
          <Button onClick={() => setShowAddModal(true)} className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 font-heading font-700 hidden md:flex items-center gap-2" data-testid="dashboard-add-btn">
            <Plus className="w-4 h-4" />
            {lang === 'fr' ? 'Nouveau RDV' : 'New Appt'}
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5 stagger-children">
        {statCards.map((card, i) => (
          <div key={i} className="bg-card rounded-2xl p-4 border border-border/50 card-shadow animate-slide-up">
            <div className={`w-9 h-9 ${card.bg} rounded-xl flex items-center justify-center mb-3`}>
              <card.icon style={{width: '18px', height: '18px'}} className={card.color} />
            </div>
            <div className={`text-2xl font-heading font-800 ${card.color}`}>{card.value}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{card.label}</div>
          </div>
        ))}
      </div>

      {/* Risk alert */}
      {stats?.high_risk_clients > 0 && (
        <Link to="/clients-risk" className="flex items-center gap-3 p-4 bg-accent/10 border border-accent/20 rounded-xl mb-5 hover:border-accent/40 transition-all">
          <AlertCircle className="w-5 h-5 text-accent flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-heading font-700 text-accent">
              {stats.high_risk_clients} {lang === 'fr' ? 'client(s) à risque de no-show' : 'high-risk client(s)'}
            </p>
            <p className="text-xs text-muted-foreground">{lang === 'fr' ? 'Voir la liste et gérer' : 'View list and manage'}</p>
          </div>
          <ArrowRight className="w-4 h-4 text-accent" />
        </Link>
      )}

      {/* Today's appointments */}
      <div className="mb-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-heading font-700 text-base flex items-center gap-2">
            <Clock className="w-4 h-4 text-muted-foreground" />
            {lang === 'fr' ? "Aujourd'hui" : 'Today'} ({todayAppts.length})
          </h2>
          <Link to="/appointments" className="text-xs text-primary font-heading font-600 flex items-center gap-1 hover:underline">
            {lang === 'fr' ? 'Tout voir' : 'See all'} <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        {todayAppts.length === 0 ? (
          <div className="bg-card rounded-xl border border-dashed border-border/70 p-8 text-center">
            <Calendar className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">{lang === 'fr' ? "Aucun RDV aujourd'hui" : 'No appointments today'}</p>
            <Button size="sm" onClick={() => setShowAddModal(true)} className="mt-3 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 h-8 px-4 text-xs font-heading font-700">
              <Plus className="w-3 h-3 mr-1" /> {lang === 'fr' ? 'Ajouter un RDV' : 'Add appointment'}
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {todayAppts.map(appt => (
              <AppointmentQuickCard key={appt.id} appt={appt} lang={lang} onStatusChange={updateStatus} onRemind={sendReminder} />
            ))}
          </div>
        )}
      </div>

      {/* Upcoming this week */}
      {upcoming.length > 0 && (
        <div className="mb-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-heading font-700 text-base flex items-center gap-2">
              <Zap className="w-4 h-4 text-muted-foreground" />
              {lang === 'fr' ? 'Cette semaine' : 'This week'} ({upcoming.length})
            </h2>
          </div>
          <div className="space-y-2">
            {upcoming.slice(0, 5).map(appt => (
              <AppointmentQuickCard key={appt.id} appt={appt} lang={lang} onStatusChange={updateStatus} onRemind={sendReminder} compact />
            ))}
          </div>
        </div>
      )}

      {/* Quick links */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { to: '/calendar', icon: Calendar, label_fr: 'Calendrier', label_en: 'Calendar', color: 'text-primary', bg: 'bg-primary/10' },
          { to: '/analytics', icon: TrendingUp, label_fr: 'Statistiques', label_en: 'Analytics', color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-100 dark:bg-blue-900/20' },
          { to: '/clients', icon: Users, label_fr: 'Mes Clients', label_en: 'My Clients', color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-100 dark:bg-purple-900/20' },
          { to: '/clients-risk', icon: AlertCircle, label_fr: 'Clients à risque', label_en: 'At-risk clients', color: 'text-accent', bg: 'bg-orange-100 dark:bg-orange-900/20' },
          { to: '/notifications', icon: Bell, label_fr: 'Notifications', label_en: 'Notifications', color: 'text-green-600 dark:text-green-400', bg: 'bg-green-100 dark:bg-green-900/20' },
          { to: '/staff', icon: Users, label_fr: 'Équipe', label_en: 'Staff', color: 'text-pink-600 dark:text-pink-400', bg: 'bg-pink-100 dark:bg-pink-900/20' },
        ].map((item, i) => (
          <Link key={i} to={item.to} className="bg-card rounded-xl border border-border/50 p-4 flex items-center gap-3 hover:border-primary/30 transition-all card-shadow" data-testid={`quick-link-${i}`}>
            <div className={`w-8 h-8 ${item.bg} rounded-xl flex items-center justify-center flex-shrink-0`}>
              <item.icon style={{width:'16px', height:'16px'}} className={item.color} />
            </div>
            <span className="text-sm font-heading font-600 leading-tight">{lang === 'fr' ? item.label_fr : item.label_en}</span>
          </Link>
        ))}
      </div>

      {/* Mobile FAB */}
      <button onClick={() => setShowAddModal(true)} className="md:hidden fixed bottom-20 right-4 w-14 h-14 bg-primary rounded-full flex items-center justify-center shadow-lg hover:bg-primary/90 transition-all active:scale-95 z-30" data-testid="fab-add">
        <Plus className="w-6 h-6 text-primary-foreground" />
      </button>

      {showAddModal && (
        <AddAppointmentModal onClose={() => setShowAddModal(false)} onSuccess={() => { setShowAddModal(false); fetchData(true); }} />
      )}
    </BusinessLayout>
  );
}

function AppointmentQuickCard({ appt, lang, onStatusChange, onRemind, compact }) {
  const statusConf = STATUS_CONFIG[appt.status] || STATUS_CONFIG.pending;
  const [loading, setLoading] = useState(false);

  const handleRemind = async (e) => {
    e.stopPropagation();
    setLoading(true);
    await onRemind(appt.id);
    setLoading(false);
  };

  return (
    <div className="bg-card rounded-xl border border-border/50 p-3.5 flex items-center gap-3 hover:border-primary/20 transition-all" data-testid="dashboard-appt-card">
      <div className="text-center min-w-[44px]">
        <div className="font-mono font-500 text-sm">{appt.time}</div>
        {!compact && <div className="text-[10px] text-muted-foreground">{appt.date?.slice(5)}</div>}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-heading font-700 text-sm truncate">{appt.client_name}</p>
        {!compact && <p className="text-xs text-muted-foreground">{appt.client_phone}</p>}
        {appt.service && <p className="text-xs text-primary font-heading font-600 truncate">{appt.service}</p>}
      </div>
      <span className={cn("text-[11px] font-heading font-700 px-2 py-0.5 rounded-full whitespace-nowrap flex-shrink-0", statusConf.className)}>
        {lang === 'fr' ? statusConf.label_fr : statusConf.label_en}
      </span>
      {appt.status === 'pending' && !compact && (
        <button onClick={handleRemind} disabled={loading} className="text-xs text-primary font-heading font-600 hover:underline ml-1 whitespace-nowrap flex-shrink-0" data-testid="quick-remind-btn">
          {loading ? '...' : (lang === 'fr' ? 'Rappel' : 'Remind')}
        </button>
      )}
    </div>
  );
}
