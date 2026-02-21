import React, { useState, useEffect } from 'react';
import { Calendar, TrendingDown, TrendingUp, Users, CheckCircle, AlertCircle, Plus, ArrowRight } from 'lucide-react';
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
  const [appointments, setAppointments] = useState([]);
  const [business, setBusiness] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [loading, setLoading] = useState(true);

  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [statsRes, apptsRes, bizRes] = await Promise.all([
        axios.get(`${API}/stats/business`),
        axios.get(`${API}/appointments?limit=10`),
        axios.get(`${API}/businesses/me`),
      ]);
      setStats(statsRes.data);
      setAppointments(apptsRes.data);
      setBusiness(bizRes.data);
    } catch (err) {
      toast.error('Error loading data');
    } finally {
      setLoading(false);
    }
  };

  const todayAppts = appointments.filter(a => a.date === today);

  const statCards = stats ? [
    {
      label: lang === 'fr' ? "Aujourd'hui" : "Today",
      value: stats.today,
      icon: Calendar,
      color: 'text-primary',
      bg: 'bg-primary/10',
    },
    {
      label: lang === 'fr' ? 'Confirmés' : 'Confirmed',
      value: stats.confirmed,
      icon: CheckCircle,
      color: 'text-green-600 dark:text-green-400',
      bg: 'bg-green-100 dark:bg-green-900/20',
    },
    {
      label: lang === 'fr' ? 'Taux d\'absence' : 'No-show Rate',
      value: `${stats.no_show_rate}%`,
      icon: TrendingDown,
      color: stats.no_show_rate > 20 ? 'text-orange-600 dark:text-orange-400' : 'text-primary',
      bg: stats.no_show_rate > 20 ? 'bg-orange-100 dark:bg-orange-900/20' : 'bg-primary/10',
    },
    {
      label: lang === 'fr' ? 'Argent récupéré' : 'Money Saved',
      value: `${stats.money_saved_estimate}€`,
      icon: TrendingUp,
      color: 'text-primary',
      bg: 'bg-primary/10',
    },
  ] : [];

  if (loading) return (
    <BusinessLayout>
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    </BusinessLayout>
  );

  return (
    <BusinessLayout>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-heading font-800">
            {lang === 'fr' ? 'Bonjour' : 'Hello'} {user?.full_name?.split(' ')[0]} 👋
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {business?.name} • {lang === 'fr' ? 'Essai gratuit' : 'Free trial'}
          </p>
        </div>
        <Button
          onClick={() => setShowAddModal(true)}
          className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 font-heading font-700 hidden md:flex items-center gap-2"
          data-testid="add-appointment-btn"
        >
          <Plus className="w-4 h-4" />
          {lang === 'fr' ? 'Nouveau RDV' : 'New Appt'}
        </Button>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6 stagger-children">
        {statCards.map((card, i) => (
          <div key={i} className="bg-card rounded-2xl p-4 border border-border/50 card-shadow animate-slide-up">
            <div className={`w-9 h-9 ${card.bg} rounded-xl flex items-center justify-center mb-3`}>
              <card.icon className={`w-4.5 h-4.5 ${card.color}`} style={{width: '18px', height: '18px'}} />
            </div>
            <div className={`text-2xl font-heading font-800 ${card.color}`}>{card.value}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{card.label}</div>
          </div>
        ))}
      </div>

      {/* No-show risk alert */}
      {stats?.high_risk_clients > 0 && (
        <div className="flex items-center gap-3 p-4 bg-accent/10 border border-accent/20 rounded-xl mb-6">
          <AlertCircle className="w-5 h-5 text-accent flex-shrink-0" />
          <p className="text-sm font-heading font-600 text-accent">
            {stats.high_risk_clients} {lang === 'fr' ? 'client(s) à risque identifié(s)' : 'high-risk client(s) identified'}
          </p>
        </div>
      )}

      {/* Today's appointments */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-heading font-700 text-base">
            {lang === 'fr' ? "Aujourd'hui" : 'Today'} ({todayAppts.length})
          </h2>
          <Link to="/appointments" className="text-xs text-primary font-heading font-600 flex items-center gap-1">
            {lang === 'fr' ? 'Voir tout' : 'See all'} <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        {todayAppts.length === 0 ? (
          <div className="bg-card rounded-xl border border-border/50 p-8 text-center">
            <Calendar className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              {lang === 'fr' ? 'Aucun RDV aujourd\'hui' : 'No appointments today'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {todayAppts.map(appt => (
              <AppointmentCard key={appt.id} appt={appt} lang={lang} onRefresh={fetchData} />
            ))}
          </div>
        )}
      </div>

      {/* Recent appointments */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-heading font-700 text-base">
            {lang === 'fr' ? 'RDV récents' : 'Recent appointments'}
          </h2>
        </div>
        <div className="space-y-2">
          {appointments.slice(0, 5).map(appt => (
            <AppointmentCard key={appt.id} appt={appt} lang={lang} onRefresh={fetchData} />
          ))}
        </div>
      </div>

      {/* Mobile FAB */}
      <button
        onClick={() => setShowAddModal(true)}
        className="md:hidden fixed bottom-20 right-4 w-14 h-14 bg-primary rounded-full flex items-center justify-center shadow-lg hover:bg-primary/90 transition-all active:scale-95 z-30"
        data-testid="fab-add-appointment"
      >
        <Plus className="w-6 h-6 text-primary-foreground" />
      </button>

      {showAddModal && (
        <AddAppointmentModal
          onClose={() => setShowAddModal(false)}
          onSuccess={() => { setShowAddModal(false); fetchData(); }}
        />
      )}
    </BusinessLayout>
  );
}

function AppointmentCard({ appt, lang, onRefresh }) {
  const statusConfig = STATUS_CONFIG[appt.status] || STATUS_CONFIG.pending;
  const [sending, setSending] = useState(false);

  const sendReminder = async (e) => {
    e.stopPropagation();
    setSending(true);
    try {
      await axios.post(`${API}/appointments/${appt.id}/send-reminder`);
      toast.success(lang === 'fr' ? 'Rappel envoyé !' : 'Reminder sent!');
    } catch {
      toast.error('Error');
    } finally {
      setSending(false);
    }
  };

  const updateStatus = async (status) => {
    try {
      await axios.put(`${API}/appointments/${appt.id}`, { status });
      toast.success(lang === 'fr' ? 'Statut mis à jour' : 'Status updated');
      onRefresh();
    } catch {
      toast.error('Error');
    }
  };

  return (
    <div className="bg-card rounded-xl border border-border/50 p-4 flex items-center gap-3 hover:border-primary/20 transition-all" data-testid="appointment-card">
      {/* Time */}
      <div className="text-center min-w-[44px]">
        <div className="font-mono font-500 text-sm text-foreground">{appt.time}</div>
        <div className="text-[10px] text-muted-foreground">{appt.date?.slice(5)}</div>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="font-heading font-700 text-sm truncate">{appt.client_name}</p>
        <p className="text-xs text-muted-foreground truncate">{appt.client_phone}</p>
      </div>

      {/* Status badge */}
      <span className={cn("text-[11px] font-heading font-700 px-2 py-0.5 rounded-full whitespace-nowrap", statusConfig.className)}>
        {lang === 'fr' ? statusConfig.label_fr : statusConfig.label_en}
      </span>

      {/* Quick actions */}
      {appt.status === 'pending' && (
        <button
          onClick={sendReminder}
          disabled={sending}
          className="text-xs text-primary font-heading font-600 hover:underline ml-1 whitespace-nowrap"
          data-testid="send-reminder-btn"
        >
          {sending ? '...' : (lang === 'fr' ? 'Rappel' : 'Remind')}
        </button>
      )}
    </div>
  );
}
