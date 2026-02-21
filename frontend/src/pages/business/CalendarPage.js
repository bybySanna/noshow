import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Plus, Clock, User, Phone, CheckCircle, X, AlertTriangle } from 'lucide-react';
import { Button } from '../../components/ui/button';
import BusinessLayout from '../../components/BusinessLayout';
import AddAppointmentModal from '../../components/AddAppointmentModal';
import { useLang } from '../../context/LangContext';
import axios from 'axios';
import { API } from '../../context/AuthContext';
import { toast } from 'sonner';
import { cn } from '../../lib/utils';

const STATUS_CONFIG = {
  confirmed: { label_fr: 'Confirmé', label_en: 'Confirmed', className: 'status-confirmed', color: '#15803d' },
  pending: { label_fr: 'En attente', label_en: 'Pending', className: 'status-pending', color: '#f59e0b' },
  no_show: { label_fr: 'Absent', label_en: 'No Show', className: 'status-no_show', color: '#ea580c' },
  cancelled: { label_fr: 'Annulé', label_en: 'Cancelled', className: 'status-cancelled', color: '#ef4444' },
  completed: { label_fr: 'Terminé', label_en: 'Completed', className: 'status-completed', color: '#3b82f6' },
  rescheduled: { label_fr: 'Reporté', label_en: 'Rescheduled', className: 'status-rescheduled', color: '#8b5cf6' },
};

const DAYS_FR = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const DAYS_EN = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTHS_FR = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export default function CalendarPage() {
  const { lang } = useLang();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [appointments, setAppointments] = useState([]);
  const [byDate, setByDate] = useState({});
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedAppt, setSelectedAppt] = useState(null);

  const days = lang === 'fr' ? DAYS_FR : DAYS_EN;
  const months = lang === 'fr' ? MONTHS_FR : MONTHS_EN;

  useEffect(() => { fetchCalendarData(); }, [currentDate]);

  const getWeekDates = () => {
    const start = new Date(currentDate);
    const day = start.getDay();
    const diff = start.getDate() - day + (day === 0 ? -6 : 1);
    start.setDate(diff);
    
    const dates = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      dates.push(d);
    }
    return dates;
  };

  const weekDates = getWeekDates();

  const fetchCalendarData = async () => {
    try {
      const startDate = weekDates[0].toISOString().split('T')[0];
      const endDate = weekDates[6].toISOString().split('T')[0];
      
      const res = await axios.get(`${API}/appointments/calendar?start_date=${startDate}&end_date=${endDate}`);
      setAppointments(res.data.appointments);
      setByDate(res.data.by_date);
    } catch (err) {
      toast.error('Erreur chargement calendrier');
    } finally {
      setLoading(false);
    }
  };

  const goToPrevWeek = () => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() - 7);
    setCurrentDate(newDate);
  };

  const goToNextWeek = () => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() + 7);
    setCurrentDate(newDate);
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const isToday = (date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const formatDateKey = (date) => date.toISOString().split('T')[0];

  const updateStatus = async (id, status) => {
    try {
      await axios.put(`${API}/appointments/${id}`, { status });
      toast.success(lang === 'fr' ? 'Statut mis à jour' : 'Status updated');
      fetchCalendarData();
      setSelectedAppt(null);
    } catch { toast.error('Error'); }
  };

  const getWeekNumber = () => {
    const start = new Date(currentDate.getFullYear(), 0, 1);
    const diff = currentDate - start;
    const oneWeek = 1000 * 60 * 60 * 24 * 7;
    return Math.ceil(diff / oneWeek);
  };

  return (
    <BusinessLayout>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-heading font-800">
            {lang === 'fr' ? 'Calendrier' : 'Calendar'}
          </h1>
          <p className="text-sm text-muted-foreground">
            {months[currentDate.getMonth()]} {currentDate.getFullYear()} • {lang === 'fr' ? 'Semaine' : 'Week'} {getWeekNumber()}
          </p>
        </div>
        <Button 
          onClick={() => setShowAddModal(true)} 
          className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 font-heading font-700"
          data-testid="calendar-add-btn"
        >
          <Plus className="w-4 h-4 mr-2" />
          {lang === 'fr' ? 'Nouveau RDV' : 'New Appt'}
        </Button>
      </div>

      {/* Week navigation */}
      <div className="flex items-center justify-between mb-4 bg-card rounded-xl border border-border/50 p-3">
        <button onClick={goToPrevWeek} className="p-2 rounded-lg hover:bg-muted transition-colors" data-testid="prev-week-btn">
          <ChevronLeft className="w-5 h-5 text-muted-foreground" />
        </button>
        <div className="flex items-center gap-2">
          <span className="font-heading font-700 text-sm">
            {weekDates[0].getDate()} - {weekDates[6].getDate()} {months[weekDates[0].getMonth()]}
          </span>
          <button 
            onClick={goToToday}
            className="text-xs text-primary font-heading font-600 hover:underline ml-2"
            data-testid="today-btn"
          >
            {lang === 'fr' ? "Aujourd'hui" : 'Today'}
          </button>
        </div>
        <button onClick={goToNextWeek} className="p-2 rounded-lg hover:bg-muted transition-colors" data-testid="next-week-btn">
          <ChevronRight className="w-5 h-5 text-muted-foreground" />
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center h-64 items-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* Week grid */}
          <div className="grid grid-cols-7 gap-2 mb-4">
            {weekDates.map((date, i) => {
              const dateKey = formatDateKey(date);
              const dayAppts = byDate[dateKey] || [];
              const todayClass = isToday(date) ? 'bg-primary text-primary-foreground' : 'bg-muted';
              
              return (
                <div key={i} className="text-center">
                  <div className="text-xs text-muted-foreground font-heading font-600 mb-1">
                    {days[i]}
                  </div>
                  <div 
                    className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center mx-auto text-sm font-heading font-700 cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all",
                      todayClass
                    )}
                    onClick={() => setSelectedDate(dateKey)}
                    data-testid={`day-${i}`}
                  >
                    {date.getDate()}
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-1">
                    {dayAppts.length > 0 && (
                      <span className="text-primary font-heading font-600">{dayAppts.length} RDV</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Day detail or week overview */}
          <div className="bg-card rounded-2xl border border-border/50 p-4 min-h-[300px]">
            {selectedDate ? (
              <>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-heading font-700 text-base">
                    {new Date(selectedDate).toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-US', { weekday: 'long', day: 'numeric', month: 'long' })}
                  </h2>
                  <button 
                    onClick={() => setSelectedDate(null)}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    {lang === 'fr' ? 'Voir semaine' : 'View week'}
                  </button>
                </div>
                
                {(byDate[selectedDate] || []).length === 0 ? (
                  <div className="text-center py-12">
                    <Clock className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">
                      {lang === 'fr' ? 'Aucun RDV ce jour' : 'No appointments this day'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {(byDate[selectedDate] || []).sort((a, b) => a.time.localeCompare(b.time)).map(appt => (
                      <AppointmentCard 
                        key={appt.id} 
                        appt={appt} 
                        lang={lang} 
                        onSelect={() => setSelectedAppt(appt)}
                      />
                    ))}
                  </div>
                )}
              </>
            ) : (
              <>
                <h2 className="font-heading font-700 text-base mb-4">
                  {lang === 'fr' ? 'Aperçu de la semaine' : 'Week Overview'}
                </h2>
                
                {appointments.length === 0 ? (
                  <div className="text-center py-12">
                    <Clock className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">
                      {lang === 'fr' ? 'Aucun RDV cette semaine' : 'No appointments this week'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[400px] overflow-y-auto">
                    {appointments.sort((a, b) => {
                      if (a.date !== b.date) return a.date.localeCompare(b.date);
                      return a.time.localeCompare(b.time);
                    }).map(appt => (
                      <AppointmentCard 
                        key={appt.id} 
                        appt={appt} 
                        lang={lang} 
                        showDate 
                        onSelect={() => setSelectedAppt(appt)}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3 mt-4">
            {[
              { 
                label: lang === 'fr' ? 'Confirmés' : 'Confirmed', 
                value: appointments.filter(a => a.status === 'confirmed').length,
                color: 'text-green-600 dark:text-green-400'
              },
              { 
                label: lang === 'fr' ? 'En attente' : 'Pending', 
                value: appointments.filter(a => a.status === 'pending').length,
                color: 'text-yellow-600 dark:text-yellow-400'
              },
              { 
                label: lang === 'fr' ? 'Total' : 'Total', 
                value: appointments.length,
                color: 'text-primary'
              },
            ].map((stat, i) => (
              <div key={i} className="bg-card rounded-xl border border-border/50 p-3 text-center">
                <div className={cn("text-xl font-heading font-800", stat.color)}>{stat.value}</div>
                <div className="text-xs text-muted-foreground">{stat.label}</div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Appointment detail modal */}
      {selectedAppt && (
        <AppointmentDetailModal 
          appt={selectedAppt} 
          lang={lang} 
          onClose={() => setSelectedAppt(null)}
          onStatusChange={updateStatus}
        />
      )}

      {showAddModal && (
        <AddAppointmentModal 
          onClose={() => setShowAddModal(false)} 
          onSuccess={() => { setShowAddModal(false); fetchCalendarData(); }}
          defaultDate={selectedDate}
        />
      )}
    </BusinessLayout>
  );
}

function AppointmentCard({ appt, lang, showDate, onSelect }) {
  const statusConf = STATUS_CONFIG[appt.status] || STATUS_CONFIG.pending;
  
  return (
    <div 
      className="bg-muted/50 rounded-xl p-3 flex items-center gap-3 hover:bg-muted cursor-pointer transition-all"
      onClick={onSelect}
      data-testid="calendar-appt-card"
    >
      <div 
        className="w-1 h-10 rounded-full flex-shrink-0"
        style={{ background: statusConf.color }}
      />
      <div className="min-w-[50px] text-center">
        <div className="font-mono text-sm font-500">{appt.time}</div>
        {showDate && <div className="text-[10px] text-muted-foreground">{appt.date.slice(5)}</div>}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-heading font-700 text-sm truncate">{appt.client_name}</p>
        {appt.service && <p className="text-xs text-primary font-heading font-600 truncate">{appt.service}</p>}
      </div>
      <span className={cn("text-[10px] font-heading font-700 px-2 py-0.5 rounded-full whitespace-nowrap", statusConf.className)}>
        {lang === 'fr' ? statusConf.label_fr : statusConf.label_en}
      </span>
    </div>
  );
}

function AppointmentDetailModal({ appt, lang, onClose, onStatusChange }) {
  const statusConf = STATUS_CONFIG[appt.status] || STATUS_CONFIG.pending;
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div 
        className="bg-card rounded-2xl w-full max-w-sm p-5 shadow-xl animate-slide-up"
        onClick={e => e.stopPropagation()}
        data-testid="appt-detail-modal"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-heading font-800 text-lg">{lang === 'fr' ? 'Détails RDV' : 'Appointment Details'}</h2>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-muted">
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>
        
        <div className="space-y-3 mb-5">
          <div className="flex items-center gap-3">
            <User className="w-4 h-4 text-muted-foreground" />
            <span className="font-heading font-700">{appt.client_name}</span>
          </div>
          <div className="flex items-center gap-3">
            <Phone className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm">{appt.client_phone}</span>
          </div>
          <div className="flex items-center gap-3">
            <Clock className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm">{appt.date} à {appt.time}</span>
          </div>
          {appt.service && (
            <div className="text-sm">
              <span className="text-muted-foreground">Service:</span> <span className="font-heading font-600 text-primary">{appt.service}</span>
            </div>
          )}
          {appt.note && (
            <div className="text-sm bg-muted/50 rounded-lg p-2">
              <span className="text-muted-foreground">Note:</span> {appt.note}
            </div>
          )}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Statut:</span>
            <span className={cn("text-xs font-heading font-700 px-2 py-0.5 rounded-full", statusConf.className)}>
              {lang === 'fr' ? statusConf.label_fr : statusConf.label_en}
            </span>
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-2">
          <Button 
            onClick={() => onStatusChange(appt.id, 'confirmed')}
            className="rounded-full bg-green-600 hover:bg-green-700 text-white h-10 text-xs font-heading font-700"
            disabled={appt.status === 'confirmed'}
          >
            <CheckCircle className="w-3.5 h-3.5 mr-1" />
            {lang === 'fr' ? 'Confirmer' : 'Confirm'}
          </Button>
          <Button 
            onClick={() => onStatusChange(appt.id, 'no_show')}
            variant="outline"
            className="rounded-full border-accent text-accent hover:bg-accent/10 h-10 text-xs font-heading font-700"
          >
            <AlertTriangle className="w-3.5 h-3.5 mr-1" />
            No-show
          </Button>
          <Button 
            onClick={() => onStatusChange(appt.id, 'completed')}
            className="rounded-full bg-blue-600 hover:bg-blue-700 text-white h-10 text-xs font-heading font-700"
          >
            {lang === 'fr' ? 'Terminé' : 'Completed'}
          </Button>
          <Button 
            onClick={() => onStatusChange(appt.id, 'cancelled')}
            variant="outline"
            className="rounded-full text-red-500 border-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 h-10 text-xs font-heading font-700"
          >
            <X className="w-3.5 h-3.5 mr-1" />
            {lang === 'fr' ? 'Annuler' : 'Cancel'}
          </Button>
        </div>
      </div>
    </div>
  );
}
