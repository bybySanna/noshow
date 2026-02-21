import React, { useState, useEffect } from 'react';
import { Plus, Search, Filter, Calendar, Phone, CheckCircle, X, Clock, RefreshCw, Trash2, ExternalLink, Smartphone, Globe } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import BusinessLayout from '../../components/BusinessLayout';
import AddAppointmentModal from '../../components/AddAppointmentModal';
import { useLang } from '../../context/LangContext';
import axios from 'axios';
import { API } from '../../context/AuthContext';
import { toast } from 'sonner';
import { cn } from '../../lib/utils';

const STATUS_CONFIG = {
  confirmed: { label_fr: 'Confirmé', label_en: 'Confirmed', className: 'status-confirmed' },
  pending: { label_fr: 'En attente', label_en: 'Pending', className: 'status-pending' },
  no_show: { label_fr: 'Absent', label_en: 'No Show', className: 'status-no_show' },
  cancelled: { label_fr: 'Annulé', label_en: 'Cancelled', className: 'status-cancelled' },
  completed: { label_fr: 'Terminé', label_en: 'Completed', className: 'status-completed' },
  rescheduled: { label_fr: 'Reporté', label_en: 'Rescheduled', className: 'status-rescheduled' },
};

const SOURCE_CONFIG = {
  manual: { label_fr: 'Manuel', label_en: 'Manual', icon: Smartphone, color: 'text-blue-500' },
  google_calendar: { label_fr: 'Google Cal', label_en: 'Google Cal', icon: Calendar, color: 'text-green-500' },
  outlook: { label_fr: 'Outlook', label_en: 'Outlook', icon: Calendar, color: 'text-blue-600' },
  ical: { label_fr: 'iCal', label_en: 'iCal', icon: Calendar, color: 'text-gray-500' },
  api_thefork: { label_fr: 'TheFork', label_en: 'TheFork', icon: ExternalLink, color: 'text-green-600' },
  api_opentable: { label_fr: 'OpenTable', label_en: 'OpenTable', icon: ExternalLink, color: 'text-red-500' },
  api_external: { label_fr: 'API', label_en: 'API', icon: Globe, color: 'text-purple-500' },
};

export default function AppointmentsPage() {
  const { lang } = useLang();
  const [appointments, setAppointments] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [selectedAppt, setSelectedAppt] = useState(null);

  useEffect(() => { fetchAppointments(); }, []);

  useEffect(() => {
    let result = appointments;
    if (statusFilter !== 'all') result = result.filter(a => a.status === statusFilter);
    if (sourceFilter !== 'all') result = result.filter(a => (a.source || 'manual') === sourceFilter);
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(a =>
        a.client_name?.toLowerCase().includes(q) ||
        a.client_phone?.includes(q) ||
        a.service?.toLowerCase().includes(q)
      );
    }
    setFiltered(result);
  }, [appointments, statusFilter, sourceFilter, search]);

  const fetchAppointments = async () => {
    try {
      const res = await axios.get(`${API}/appointments`);
      setAppointments(res.data);
    } catch {
      toast.error('Error loading appointments');
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (id, status) => {
    try {
      await axios.put(`${API}/appointments/${id}`, { status });
      toast.success(lang === 'fr' ? 'Statut mis à jour' : 'Status updated');
      fetchAppointments();
      setSelectedAppt(null);
    } catch {
      toast.error('Error');
    }
  };

  const deleteAppt = async (id) => {
    if (!window.confirm(lang === 'fr' ? 'Supprimer ce RDV ?' : 'Delete this appointment?')) return;
    try {
      await axios.delete(`${API}/appointments/${id}`);
      toast.success(lang === 'fr' ? 'RDV supprimé' : 'Appointment deleted');
      fetchAppointments();
      setSelectedAppt(null);
    } catch {
      toast.error('Error');
    }
  };

  const sendReminder = async (id) => {
    try {
      await axios.post(`${API}/appointments/${id}/send-reminder`);
      toast.success(lang === 'fr' ? 'Rappel envoyé !' : 'Reminder sent!');
    } catch {
      toast.error('Error');
    }
  };

  const statusOptions = [
    { value: 'all', label_fr: 'Tous', label_en: 'All' },
    { value: 'pending', label_fr: 'En attente', label_en: 'Pending' },
    { value: 'confirmed', label_fr: 'Confirmés', label_en: 'Confirmed' },
    { value: 'no_show', label_fr: 'Absents', label_en: 'No Shows' },
    { value: 'cancelled', label_fr: 'Annulés', label_en: 'Cancelled' },
    { value: 'completed', label_fr: 'Terminés', label_en: 'Completed' },
  ];

  const sourceOptions = [
    { value: 'all', label_fr: 'Toutes sources', label_en: 'All sources' },
    { value: 'manual', label_fr: 'Manuel', label_en: 'Manual' },
    { value: 'google_calendar', label_fr: 'Google Cal', label_en: 'Google Cal' },
    { value: 'api_thefork', label_fr: 'TheFork', label_en: 'TheFork' },
    { value: 'api_opentable', label_fr: 'OpenTable', label_en: 'OpenTable' },
  ];

  return (
    <BusinessLayout>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-2xl font-heading font-800">
          {lang === 'fr' ? 'Rendez-vous' : 'Appointments'}
        </h1>
        <Button
          onClick={() => setShowAddModal(true)}
          className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 font-heading font-700"
          data-testid="appointments-add-btn"
        >
          <Plus className="w-4 h-4 mr-2" />
          {lang === 'fr' ? 'Nouveau' : 'New'}
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={lang === 'fr' ? 'Rechercher...' : 'Search...'}
            className="pl-9 h-10 rounded-xl"
            data-testid="appointments-search"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-10 w-36 rounded-xl" data-testid="appointments-filter">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {statusOptions.map(o => (
              <SelectItem key={o.value} value={o.value}>
                {lang === 'fr' ? o.label_fr : o.label_en}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sourceFilter} onValueChange={setSourceFilter}>
          <SelectTrigger className="h-10 w-36 rounded-xl" data-testid="source-filter">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {sourceOptions.map(o => (
              <SelectItem key={o.value} value={o.value}>
                {lang === 'fr' ? o.label_fr : o.label_en}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Count */}
      <p className="text-xs text-muted-foreground mb-3 font-heading">
        {filtered.length} {lang === 'fr' ? 'rendez-vous' : 'appointments'}
      </p>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-card rounded-xl border border-border/50 p-12 text-center">
          <Calendar className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="font-heading font-700 text-sm">{lang === 'fr' ? 'Aucun rendez-vous' : 'No appointments'}</p>
          <p className="text-xs text-muted-foreground mt-1">{lang === 'fr' ? 'Ajoutez votre premier RDV' : 'Add your first appointment'}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(appt => {
            const statusConf = STATUS_CONFIG[appt.status] || STATUS_CONFIG.pending;
            const sourceConf = SOURCE_CONFIG[appt.source || 'manual'] || SOURCE_CONFIG.manual;
            const SourceIcon = sourceConf.icon;
            return (
              <div
                key={appt.id}
                className="bg-card rounded-xl border border-border/50 p-4 cursor-pointer hover:border-primary/20 transition-all"
                onClick={() => setSelectedAppt(appt)}
                data-testid="appointment-row"
              >
                <div className="flex items-center gap-3">
                  <div className="text-center min-w-[48px]">
                    <div className="font-mono font-500 text-sm">{appt.time}</div>
                    <div className="text-[10px] text-muted-foreground">{appt.date}</div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-heading font-700 text-sm truncate">{appt.client_name}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Phone className="w-3 h-3" />
                      <span>{appt.client_phone}</span>
                      {appt.service && <span className="text-primary">• {appt.service}</span>}
                    </div>
                  </div>
                  {/* Source badge */}
                  {appt.source && appt.source !== 'manual' && (
                    <div className={cn("flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-muted/50", sourceConf.color)} title={lang === 'fr' ? sourceConf.label_fr : sourceConf.label_en}>
                      <SourceIcon className="w-3 h-3" />
                    </div>
                  )}
                  <span className={cn("text-[11px] font-heading font-700 px-2 py-0.5 rounded-full", statusConf.className)}>
                    {lang === 'fr' ? statusConf.label_fr : statusConf.label_en}
                  </span>
                </div>
                {appt.note && (
                  <p className="text-xs text-muted-foreground mt-2 pl-[60px] truncate">{appt.note}</p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Appointment Detail Sheet */}
      {selectedAppt && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end md:items-center justify-center p-4" onClick={() => setSelectedAppt(null)}>
          <div
            className="bg-card rounded-2xl w-full max-w-md p-6 border border-border"
            onClick={e => e.stopPropagation()}
            data-testid="appointment-detail"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-heading font-800 text-lg">{selectedAppt.client_name}</h3>
              <button onClick={() => setSelectedAppt(null)} className="p-1 rounded-full hover:bg-muted">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 mb-5">
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <span>{selectedAppt.date} à {selectedAppt.time}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Phone className="w-4 h-4 text-muted-foreground" />
                <span>{selectedAppt.client_phone}</span>
              </div>
              {selectedAppt.service && (
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <span>{selectedAppt.service}</span>
                </div>
              )}
              {selectedAppt.note && (
                <div className="p-3 bg-muted/50 rounded-lg text-sm text-muted-foreground">
                  {selectedAppt.note}
                </div>
              )}
            </div>

            {/* Confirmation link */}
            <div className="p-3 bg-muted/50 rounded-lg mb-4">
              <p className="text-xs text-muted-foreground mb-1 font-heading font-600">
                {lang === 'fr' ? 'Lien de confirmation client :' : 'Client confirmation link:'}
              </p>
              <p className="text-xs font-mono text-primary break-all">
                {window.location.origin}/confirm/{selectedAppt.confirmation_token}
              </p>
            </div>

            {/* Actions */}
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl"
                onClick={() => sendReminder(selectedAppt.id)}
                data-testid="detail-send-reminder"
              >
                <RefreshCw className="w-3 h-3 mr-1" />
                {lang === 'fr' ? 'Rappel' : 'Remind'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl text-green-600 border-green-200 hover:bg-green-50 dark:text-green-400 dark:border-green-800 dark:hover:bg-green-900/20"
                onClick={() => updateStatus(selectedAppt.id, 'confirmed')}
                data-testid="detail-confirm"
              >
                <CheckCircle className="w-3 h-3 mr-1" />
                {lang === 'fr' ? 'Confirmer' : 'Confirm'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl text-accent border-accent/20 hover:bg-accent/10"
                onClick={() => updateStatus(selectedAppt.id, 'no_show')}
                data-testid="detail-noshow"
              >
                {lang === 'fr' ? 'Absent' : 'No show'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl text-destructive border-destructive/20 hover:bg-destructive/10"
                onClick={() => deleteAppt(selectedAppt.id)}
                data-testid="detail-delete"
              >
                <Trash2 className="w-3 h-3 mr-1" />
                {lang === 'fr' ? 'Supprimer' : 'Delete'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile FAB */}
      <button
        onClick={() => setShowAddModal(true)}
        className="md:hidden fixed bottom-20 right-4 w-14 h-14 bg-primary rounded-full flex items-center justify-center shadow-lg hover:bg-primary/90 transition-all active:scale-95 z-30"
        data-testid="fab-appointments-add"
      >
        <Plus className="w-6 h-6 text-primary-foreground" />
      </button>

      {showAddModal && (
        <AddAppointmentModal
          onClose={() => setShowAddModal(false)}
          onSuccess={() => { setShowAddModal(false); fetchAppointments(); }}
        />
      )}
    </BusinessLayout>
  );
}
