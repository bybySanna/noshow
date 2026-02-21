import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Calendar, Clock, Phone, CheckCircle, X, RefreshCw } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import axios from 'axios';
import { API } from '../../context/AuthContext';
import { toast } from 'sonner';

export default function ConfirmPage() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [action, setAction] = useState(null); // 'confirmed' | 'cancelled' | 'rescheduled'
  const [newDate, setNewDate] = useState('');
  const [newTime, setNewTime] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { fetchAppointment(); }, [token]);

  const fetchAppointment = async () => {
    try {
      const res = await axios.get(`${API}/confirm/${token}`);
      setData(res.data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Lien invalide ou expiré');
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (actionType) => {
    setSubmitting(true);
    try {
      const payload = { action: actionType };
      if (actionType === 'reschedule' && newDate) {
        payload.new_date = newDate;
        payload.new_time = newTime;
      }
      await axios.post(`${API}/confirm/${token}/action`, payload);
      setAction(actionType);
      toast.success(
        actionType === 'confirm' ? 'RDV confirmé !' :
        actionType === 'cancel' ? 'RDV annulé' : 'RDV reporté'
      );
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (error) return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="text-center max-w-sm">
        <div className="w-16 h-16 bg-destructive/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <X className="w-8 h-8 text-destructive" />
        </div>
        <h1 className="text-xl font-heading font-800 mb-2">Lien invalide</h1>
        <p className="text-muted-foreground text-sm">{error}</p>
      </div>
    </div>
  );

  const { appointment: appt, business: biz } = data;

  // Already acted
  if (action) return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="text-center max-w-sm w-full">
        <div className={`w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-5 ${
          action === 'confirm' ? 'bg-primary/10' :
          action === 'cancel' ? 'bg-destructive/10' : 'bg-yellow-100'
        }`}>
          {action === 'confirm' ? <CheckCircle className="w-10 h-10 text-primary" /> :
           action === 'cancel' ? <X className="w-10 h-10 text-destructive" /> :
           <RefreshCw className="w-10 h-10 text-yellow-600" />}
        </div>
        <h1 className="text-2xl font-heading font-800 mb-2">
          {action === 'confirm' ? 'Rendez-vous confirmé !' :
           action === 'cancel' ? 'Rendez-vous annulé' : 'Demande envoyée'}
        </h1>
        <p className="text-muted-foreground text-sm">
          {action === 'confirm' ? `Nous vous attendons le ${appt.date} à ${appt.time}. À bientôt !` :
           action === 'cancel' ? `Votre RDV a bien été annulé. Cliquez ci-dessous pour reprendre un RDV.` :
           'Votre demande de report a été transmise. Vous serez contacté.'}
        </p>
        {action === 'cancel' && (
          <div className="mt-6">
            <a href={`https://noshow.com/book/${biz?.id || ''}`} className="text-primary font-heading font-700 text-sm hover:underline">
              Reprendre un rendez-vous →
            </a>
          </div>
        )}
      </div>
    </div>
  );

  // Already confirmed/cancelled
  if (appt.status === 'confirmed') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-xl font-heading font-800 mb-2">Déjà confirmé</h1>
          <p className="text-muted-foreground text-sm">Ce rendez-vous est déjà confirmé.</p>
          <div className="mt-4 p-4 bg-muted/50 rounded-xl text-left space-y-2">
            <p className="text-sm"><span className="font-heading font-600">Date:</span> {appt.date}</p>
            <p className="text-sm"><span className="font-heading font-600">Heure:</span> {appt.time}</p>
            {biz?.name && <p className="text-sm"><span className="font-heading font-600">Lieu:</span> {biz.name}</p>}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-primary rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Calendar className="w-7 h-7 text-primary-foreground" />
          </div>
          {biz?.name && (
            <p className="text-sm text-muted-foreground font-heading font-600 mb-1">{biz.name}</p>
          )}
          <h1 className="text-2xl font-heading font-800">Confirmez votre RDV</h1>
        </div>

        {/* Appointment info */}
        <div className="bg-card rounded-2xl border border-border/50 p-5 mb-5 card-shadow" data-testid="appointment-info">
          <p className="text-base font-heading font-800 mb-3">{appt.client_name}</p>
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <span>{appt.date}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <span>{appt.time}</span>
            </div>
            {appt.service && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Service:</span>
                <span className="font-heading font-600">{appt.service}</span>
              </div>
            )}
          </div>

          {appt.deposit_amount && !appt.deposit_paid && (
            <div className="mt-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-xl border border-yellow-200 dark:border-yellow-800">
              <p className="text-xs text-yellow-800 dark:text-yellow-400 font-heading font-600">
                Un dépôt de {appt.deposit_amount}€ est requis pour confirmer ce RDV.
              </p>
              <button className="mt-2 w-full py-2 bg-yellow-500 text-white text-sm font-heading font-700 rounded-xl hover:bg-yellow-600 transition-colors">
                Payer le dépôt ({appt.deposit_amount}€)
              </button>
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="space-y-3" data-testid="confirmation-actions">
          <Button
            className="w-full h-13 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 font-heading font-700 text-base"
            onClick={() => handleAction('confirm')}
            disabled={submitting}
            data-testid="confirm-btn"
            style={{height: '52px'}}
          >
            <CheckCircle className="w-5 h-5 mr-2" />
            Oui, je confirme
          </Button>

          <Button
            variant="outline"
            className="w-full h-12 rounded-full font-heading font-700"
            onClick={() => setNewDate('show')}
            disabled={submitting}
            data-testid="reschedule-btn"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Reporter
          </Button>

          <Button
            variant="ghost"
            className="w-full h-12 rounded-full text-destructive hover:text-destructive hover:bg-destructive/10 font-heading font-700"
            onClick={() => handleAction('cancel')}
            disabled={submitting}
            data-testid="cancel-btn"
          >
            <X className="w-4 h-4 mr-2" />
            Annuler ce RDV
          </Button>
        </div>

        {/* Reschedule form */}
        {newDate === 'show' && (
          <div className="mt-4 bg-card rounded-2xl border border-border/50 p-4 space-y-3" data-testid="reschedule-form">
            <p className="font-heading font-700 text-sm">Nouvelle date souhaitée :</p>
            <Input type="date" value={newDate === 'show' ? '' : newDate} onChange={e => setNewDate(e.target.value)} className="h-11 rounded-xl" />
            <Input type="time" value={newTime} onChange={e => setNewTime(e.target.value)} className="h-11 rounded-xl" />
            <Button
              className="w-full rounded-full bg-primary text-primary-foreground hover:bg-primary/90 font-heading font-700"
              onClick={() => handleAction('reschedule')}
              disabled={submitting}
              data-testid="reschedule-submit-btn"
            >
              Confirmer le report
            </Button>
          </div>
        )}

        <p className="text-center text-xs text-muted-foreground mt-6">
          Propulsé par <span className="text-primary font-heading font-600">NoShowGone</span>
        </p>
      </div>
    </div>
  );
}
