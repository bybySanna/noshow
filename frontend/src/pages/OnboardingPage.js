import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, ArrowRight, ArrowLeft, Check } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LangContext';
import { toast } from 'sonner';
import axios from 'axios';
import { API } from '../context/AuthContext';

const STEPS = [
  { id: 1, title_fr: 'Votre établissement', title_en: 'Your Business' },
  { id: 2, title_fr: 'Coordonnées', title_en: 'Contact Info' },
  { id: 3, title_fr: 'Rappels', title_en: 'Reminders' },
];

const BUSINESS_TYPES = [
  { value: 'restaurant', label_fr: 'Restaurant', label_en: 'Restaurant' },
  { value: 'salon', label_fr: 'Salon de beauté', label_en: 'Beauty Salon' },
  { value: 'coach', label_fr: 'Coach / Thérapeute', label_en: 'Coach / Therapist' },
  { value: 'medical', label_fr: 'Cabinet médical', label_en: 'Medical Practice' },
  { value: 'fitness', label_fr: 'Salle de sport / Yoga', label_en: 'Gym / Yoga' },
  { value: 'other', label_fr: 'Autre', label_en: 'Other' },
];

const TIMEZONES = [
  'Europe/Paris', 'Europe/London', 'Europe/Berlin', 'America/New_York',
  'America/Los_Angeles', 'Asia/Tokyo', 'Asia/Dubai', 'Africa/Casablanca'
];

export default function OnboardingPage() {
  const { user, setUser } = useAuth();
  const { lang } = useLang();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: '',
    business_type: '',
    timezone: 'Europe/Paris',
    phone: '',
    address: '',
  });

  if (user?.business_id) {
    navigate('/dashboard');
    return null;
  }

  const updateForm = (key, val) => setForm(p => ({ ...p, [key]: val }));

  const handleFinish = async () => {
    if (!form.name || !form.business_type || !form.phone) {
      toast.error(lang === 'fr' ? 'Veuillez remplir tous les champs obligatoires' : 'Please fill all required fields');
      return;
    }
    setLoading(true);
    try {
      const res = await axios.post(`${API}/businesses`, form);
      const biz = res.data;
      setUser(u => ({ ...u, business_id: biz.id }));
      toast.success(lang === 'fr' ? 'Établissement créé ! Bienvenue sur NoShowGone.' : 'Business created! Welcome to NoShowGone.');
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-primary rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Calendar className="w-6 h-6 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-heading font-800">
            {lang === 'fr' ? 'Configurez votre espace' : 'Set up your space'}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {lang === 'fr' ? '3 étapes rapides pour démarrer' : '3 quick steps to get started'}
          </p>
        </div>

        {/* Step indicators */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {STEPS.map((s, i) => (
            <React.Fragment key={s.id}>
              <div className={`flex items-center justify-center w-8 h-8 rounded-full text-xs font-heading font-700 transition-all ${
                step > s.id ? 'bg-primary text-primary-foreground' :
                step === s.id ? 'bg-primary text-primary-foreground' :
                'bg-muted text-muted-foreground'
              }`}>
                {step > s.id ? <Check className="w-4 h-4" /> : s.id}
              </div>
              {i < STEPS.length - 1 && (
                <div className={`flex-1 h-0.5 max-w-12 ${step > s.id ? 'bg-primary' : 'bg-border'}`} />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Step content */}
        <div className="bg-card rounded-2xl p-6 border border-border/50 card-shadow">
          <h2 className="font-heading font-700 text-lg mb-5">
            {lang === 'fr' ? STEPS[step-1].title_fr : STEPS[step-1].title_en}
          </h2>

          {step === 1 && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className="font-heading font-600 text-sm">
                  {lang === 'fr' ? 'Nom de l\'établissement *' : 'Business name *'}
                </Label>
                <Input
                  value={form.name}
                  onChange={e => updateForm('name', e.target.value)}
                  placeholder={lang === 'fr' ? 'Ex: Restaurant Le Soleil' : 'Ex: Sunshine Restaurant'}
                  className="h-12 rounded-xl"
                  data-testid="onboarding-name"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="font-heading font-600 text-sm">
                  {lang === 'fr' ? 'Type d\'activité *' : 'Business type *'}
                </Label>
                <Select value={form.business_type} onValueChange={v => updateForm('business_type', v)}>
                  <SelectTrigger className="h-12 rounded-xl" data-testid="onboarding-type">
                    <SelectValue placeholder={lang === 'fr' ? 'Sélectionnez...' : 'Select...'} />
                  </SelectTrigger>
                  <SelectContent>
                    {BUSINESS_TYPES.map(bt => (
                      <SelectItem key={bt.value} value={bt.value}>
                        {lang === 'fr' ? bt.label_fr : bt.label_en}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="font-heading font-600 text-sm">
                  {lang === 'fr' ? 'Fuseau horaire' : 'Timezone'}
                </Label>
                <Select value={form.timezone} onValueChange={v => updateForm('timezone', v)}>
                  <SelectTrigger className="h-12 rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIMEZONES.map(tz => (
                      <SelectItem key={tz} value={tz}>{tz}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className="font-heading font-600 text-sm">
                  {lang === 'fr' ? 'Téléphone *' : 'Phone *'}
                </Label>
                <Input
                  value={form.phone}
                  onChange={e => updateForm('phone', e.target.value)}
                  placeholder="+33 6 12 34 56 78"
                  className="h-12 rounded-xl"
                  type="tel"
                  data-testid="onboarding-phone"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="font-heading font-600 text-sm">
                  {lang === 'fr' ? 'Adresse (optionnel)' : 'Address (optional)'}
                </Label>
                <Input
                  value={form.address}
                  onChange={e => updateForm('address', e.target.value)}
                  placeholder={lang === 'fr' ? '12 Rue de la Paix, Paris' : '12 Main St, City'}
                  className="h-12 rounded-xl"
                  data-testid="onboarding-address"
                />
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {lang === 'fr'
                  ? 'Vos rappels automatiques seront activés par défaut. Vous pouvez les personnaliser plus tard.'
                  : 'Your automatic reminders will be enabled by default. You can customize them later.'}
              </p>
              <div className="space-y-3">
                {[
                  { label_fr: 'Rappel 24h avant', label_en: '24h reminder', default: true },
                  { label_fr: 'Rappel 3h avant', label_en: '3h reminder', default: true },
                  { label_fr: 'Rappel 30min avant', label_en: '30min reminder', default: false },
                ].map((r, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 bg-muted/50 rounded-xl">
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center ${r.default ? 'bg-primary' : 'bg-muted border border-border'}`}>
                      {r.default && <Check className="w-3 h-3 text-primary-foreground" />}
                    </div>
                    <span className="text-sm font-heading font-600">
                      {lang === 'fr' ? r.label_fr : r.label_en}
                    </span>
                  </div>
                ))}
              </div>
              <div className="p-3 bg-primary/5 border border-primary/20 rounded-xl">
                <p className="text-xs text-primary font-heading font-600">
                  {lang === 'fr' ? 'Canaux activés : Email, WhatsApp, SMS' : 'Active channels: Email, WhatsApp, SMS'}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Navigation buttons */}
        <div className="flex gap-3 mt-5">
          {step > 1 && (
            <Button
              variant="outline"
              className="flex-1 h-12 rounded-full"
              onClick={() => setStep(s => s - 1)}
              data-testid="onboarding-back"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              {lang === 'fr' ? 'Retour' : 'Back'}
            </Button>
          )}
          {step < STEPS.length ? (
            <Button
              className="flex-1 h-12 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 font-heading font-700"
              onClick={() => {
                if (step === 1 && (!form.name || !form.business_type)) {
                  toast.error(lang === 'fr' ? 'Remplissez les champs obligatoires' : 'Fill required fields');
                  return;
                }
                if (step === 2 && !form.phone) {
                  toast.error(lang === 'fr' ? 'Le téléphone est requis' : 'Phone is required');
                  return;
                }
                setStep(s => s + 1);
              }}
              data-testid="onboarding-next"
            >
              {lang === 'fr' ? 'Suivant' : 'Next'}
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          ) : (
            <Button
              className="flex-1 h-12 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 font-heading font-700"
              onClick={handleFinish}
              disabled={loading}
              data-testid="onboarding-finish"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
              ) : (
                <>{lang === 'fr' ? 'Lancer mon espace' : 'Launch my space'} <ArrowRight className="w-4 h-4 ml-2" /></>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
