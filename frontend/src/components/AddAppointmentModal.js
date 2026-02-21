import React, { useState, useEffect } from 'react';
import { X, Calendar, Phone, Mail, Clock, FileText } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { useLang } from '../context/LangContext';
import axios from 'axios';
import { API } from '../context/AuthContext';
import { toast } from 'sonner';

export default function AddAppointmentModal({ onClose, onSuccess, prefillDate }) {
  const { lang } = useLang();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    client_name: '',
    client_phone: '',
    client_email: '',
    date: prefillDate || new Date().toISOString().split('T')[0],
    time: '10:00',
    service: '',
    duration_minutes: 60,
    note: '',
  });

  const update = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.client_name || !form.client_phone || !form.date || !form.time) {
      toast.error(lang === 'fr' ? 'Remplissez les champs obligatoires' : 'Fill required fields');
      return;
    }
    setLoading(true);
    try {
      await axios.post(`${API}/appointments`, form);
      toast.success(lang === 'fr' ? 'RDV ajouté avec succès !' : 'Appointment added!');
      onSuccess();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end md:items-center justify-center p-4">
      <div
        className="bg-card rounded-2xl w-full max-w-md border border-border card-shadow"
        data-testid="add-appointment-modal"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border/50">
          <h2 className="font-heading font-800 text-lg">
            {lang === 'fr' ? 'Nouveau rendez-vous' : 'New Appointment'}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-muted">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Client name */}
          <div className="space-y-1.5">
            <Label className="font-heading font-600 text-sm">
              {lang === 'fr' ? 'Nom du client *' : 'Client name *'}
            </Label>
            <Input
              value={form.client_name}
              onChange={e => update('client_name', e.target.value)}
              placeholder={lang === 'fr' ? 'Marie Dupont' : 'John Smith'}
              className="h-12 rounded-xl"
              required
              data-testid="modal-client-name"
            />
          </div>

          {/* Phone */}
          <div className="space-y-1.5">
            <Label className="font-heading font-600 text-sm">
              {lang === 'fr' ? 'Téléphone *' : 'Phone *'}
            </Label>
            <Input
              value={form.client_phone}
              onChange={e => update('client_phone', e.target.value)}
              placeholder="+33 6 12 34 56 78"
              type="tel"
              className="h-12 rounded-xl"
              required
              data-testid="modal-client-phone"
            />
          </div>

          {/* Date & Time */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="font-heading font-600 text-sm">
                {lang === 'fr' ? 'Date *' : 'Date *'}
              </Label>
              <Input
                type="date"
                value={form.date}
                onChange={e => update('date', e.target.value)}
                className="h-12 rounded-xl"
                required
                data-testid="modal-date"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="font-heading font-600 text-sm">
                {lang === 'fr' ? 'Heure *' : 'Time *'}
              </Label>
              <Input
                type="time"
                value={form.time}
                onChange={e => update('time', e.target.value)}
                className="h-12 rounded-xl"
                required
                data-testid="modal-time"
              />
            </div>
          </div>

          {/* Email */}
          <div className="space-y-1.5">
            <Label className="font-heading font-600 text-sm">
              {lang === 'fr' ? 'Email (optionnel)' : 'Email (optional)'}
            </Label>
            <Input
              type="email"
              value={form.client_email}
              onChange={e => update('client_email', e.target.value)}
              placeholder="client@email.com"
              className="h-12 rounded-xl"
              data-testid="modal-client-email"
            />
          </div>

          {/* Service */}
          <div className="space-y-1.5">
            <Label className="font-heading font-600 text-sm">
              {lang === 'fr' ? 'Service' : 'Service'}
            </Label>
            <Input
              value={form.service}
              onChange={e => update('service', e.target.value)}
              placeholder={lang === 'fr' ? 'Ex: Déjeuner, Coupe, Coaching...' : 'Ex: Lunch, Haircut, Coaching...'}
              className="h-12 rounded-xl"
              data-testid="modal-service"
            />
          </div>

          {/* Note */}
          <div className="space-y-1.5">
            <Label className="font-heading font-600 text-sm">
              {lang === 'fr' ? 'Note (optionnel)' : 'Note (optional)'}
            </Label>
            <Textarea
              value={form.note}
              onChange={e => update('note', e.target.value)}
              placeholder={lang === 'fr' ? 'Table pour 2, allergie nuts...' : 'Table for 2, nut allergy...'}
              className="rounded-xl resize-none h-20"
              data-testid="modal-note"
            />
          </div>

          {/* Submit */}
          <Button
            type="submit"
            className="w-full h-12 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 font-heading font-700"
            disabled={loading}
            data-testid="modal-submit"
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
            ) : (
              lang === 'fr' ? 'Ajouter le rendez-vous' : 'Add appointment'
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
