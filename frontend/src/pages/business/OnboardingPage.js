import React, { useState, useEffect } from 'react';
import { CheckCircle, Circle, MapPin, Clock, Globe, Link2, Zap, ArrowRight, Building2, Phone, Mail, Star } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { useLang } from '../../context/LangContext';
import BusinessLayout from '../../components/BusinessLayout';
import axios from 'axios';
import { API } from '../../context/AuthContext';
import { toast } from 'sonner';

const DAYS = [
  { key: 'monday', fr: 'Lundi', en: 'Monday' },
  { key: 'tuesday', fr: 'Mardi', en: 'Tuesday' },
  { key: 'wednesday', fr: 'Mercredi', en: 'Wednesday' },
  { key: 'thursday', fr: 'Jeudi', en: 'Thursday' },
  { key: 'friday', fr: 'Vendredi', en: 'Friday' },
  { key: 'saturday', fr: 'Samedi', en: 'Saturday' },
  { key: 'sunday', fr: 'Dimanche', en: 'Sunday' },
];

const StepIndicator = ({ completed, current, label }) => (
  <div className={`flex items-center gap-2 ${current ? 'text-primary' : completed ? 'text-green-600' : 'text-muted-foreground'}`}>
    {completed ? (
      <CheckCircle className="w-5 h-5 text-green-600" />
    ) : (
      <Circle className={`w-5 h-5 ${current ? 'text-primary' : ''}`} />
    )}
    <span className={`text-sm font-heading ${current ? 'font-700' : 'font-500'}`}>{label}</span>
  </div>
);

export default function OnboardingPage() {
  const { lang } = useLang();
  const [status, setStatus] = useState(null);
  const [timezones, setTimezones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  
  // Form states
  const [profile, setProfile] = useState({
    phone: '',
    address: '',
    email: '',
    website: '',
    timezone: 'Europe/Paris',
    lang: 'fr',
    google_review_link: '',
    wheel_of_fortune_link: ''
  });
  
  const [hours, setHours] = useState({});

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [statusRes, tzRes, bizRes] = await Promise.all([
        axios.get(`${API}/onboarding/status`),
        axios.get(`${API}/utils/timezones`),
        axios.get(`${API}/businesses/me`)
      ]);
      setStatus(statusRes.data);
      setTimezones(tzRes.data);
      
      const biz = bizRes.data;
      setProfile({
        phone: biz.phone || '',
        address: biz.address || '',
        email: biz.email || '',
        website: biz.website || '',
        timezone: biz.settings?.timezone || 'Europe/Paris',
        lang: biz.settings?.lang || 'fr',
        google_review_link: biz.post_rdv_settings?.google_review_link || '',
        wheel_of_fortune_link: biz.post_rdv_settings?.wheel_of_fortune_link || ''
      });
      setHours(biz.settings?.opening_hours || {});
      
      // Déterminer l'étape courante
      const steps = statusRes.data.steps;
      if (!steps.profile_complete) setCurrentStep(0);
      else if (!steps.timezone_set) setCurrentStep(1);
      else if (!steps.business_hours_set) setCurrentStep(2);
      else if (!steps.google_review_link) setCurrentStep(3);
      else setCurrentStep(4);
      
    } catch (err) {
      toast.error('Erreur');
    } finally {
      setLoading(false);
    }
  };

  const saveProfile = async () => {
    setSaving(true);
    try {
      await axios.put(`${API}/onboarding/profile`, profile);
      toast.success(lang === 'fr' ? 'Profil sauvegardé' : 'Profile saved');
      fetchData();
    } catch (err) {
      toast.error('Erreur');
    } finally {
      setSaving(false);
    }
  };

  const saveHours = async () => {
    setSaving(true);
    try {
      await axios.put(`${API}/onboarding/business-hours`, {
        opening_hours: hours,
        timezone: profile.timezone
      });
      toast.success(lang === 'fr' ? 'Horaires sauvegardés' : 'Hours saved');
      fetchData();
    } catch (err) {
      toast.error('Erreur');
    } finally {
      setSaving(false);
    }
  };

  const updateDayHours = (day, field, value) => {
    setHours(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        [field]: value
      }
    }));
  };

  const toggleDayClosed = (day) => {
    setHours(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        closed: !prev[day]?.closed
      }
    }));
  };

  const steps = [
    { key: 'profile', icon: Building2, label_fr: 'Profil', label_en: 'Profile' },
    { key: 'timezone', icon: Globe, label_fr: 'Fuseau horaire', label_en: 'Timezone' },
    { key: 'hours', icon: Clock, label_fr: 'Horaires', label_en: 'Hours' },
    { key: 'links', icon: Link2, label_fr: 'Liens', label_en: 'Links' },
    { key: 'automation', icon: Zap, label_fr: 'Automatisation', label_en: 'Automation' },
  ];

  return (
    <BusinessLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-heading font-800 flex items-center gap-3">
          <Star className="w-6 h-6 text-yellow-500" />
          {lang === 'fr' ? 'Configuration' : 'Setup'}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {lang === 'fr' 
            ? 'Configurez votre compte pour une expérience optimale'
            : 'Configure your account for the best experience'}
        </p>
      </div>

      {/* Progress Bar */}
      {status && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-heading font-600">
              {status.completed}/{status.total} {lang === 'fr' ? 'étapes complétées' : 'steps completed'}
            </span>
            <span className="text-sm text-primary font-heading font-700">{status.progress_percent}%</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div 
              className="h-full bg-primary rounded-full transition-all duration-500"
              style={{ width: `${status.progress_percent}%` }}
            />
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid md:grid-cols-4 gap-6">
          {/* Steps navigation */}
          <div className="space-y-2">
            {steps.map((step, idx) => (
              <button
                key={step.key}
                onClick={() => setCurrentStep(idx)}
                className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all text-left ${
                  currentStep === idx 
                    ? 'bg-primary/10 border border-primary/30' 
                    : 'hover:bg-muted'
                }`}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  status?.steps[Object.keys(status.steps)[idx]] 
                    ? 'bg-green-100 dark:bg-green-900/30' 
                    : currentStep === idx 
                      ? 'bg-primary/20' 
                      : 'bg-muted'
                }`}>
                  {status?.steps[Object.keys(status.steps)[idx]] ? (
                    <CheckCircle className="w-4 h-4 text-green-600" />
                  ) : (
                    <step.icon className={`w-4 h-4 ${currentStep === idx ? 'text-primary' : 'text-muted-foreground'}`} />
                  )}
                </div>
                <span className={`text-sm font-heading ${currentStep === idx ? 'font-700' : 'font-500'}`}>
                  {lang === 'fr' ? step.label_fr : step.label_en}
                </span>
              </button>
            ))}
          </div>

          {/* Step content */}
          <div className="md:col-span-3 bg-card rounded-2xl border border-border p-6">
            {/* Profile Step */}
            {currentStep === 0 && (
              <div className="space-y-5">
                <h2 className="text-lg font-heading font-700 flex items-center gap-2">
                  <Building2 className="w-5 h-5" />
                  {lang === 'fr' ? 'Informations de l\'entreprise' : 'Business Information'}
                </h2>
                
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-heading font-600 mb-2">
                      <Phone className="w-4 h-4 inline mr-1" />
                      {lang === 'fr' ? 'Téléphone' : 'Phone'}
                    </label>
                    <input
                      value={profile.phone}
                      onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                      className="w-full px-4 py-3 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                      placeholder="+33 1 23 45 67 89"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-heading font-600 mb-2">
                      <Mail className="w-4 h-4 inline mr-1" />
                      Email
                    </label>
                    <input
                      value={profile.email}
                      onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                      className="w-full px-4 py-3 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                      placeholder="contact@entreprise.com"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-heading font-600 mb-2">
                    <MapPin className="w-4 h-4 inline mr-1" />
                    {lang === 'fr' ? 'Adresse' : 'Address'}
                  </label>
                  <input
                    value={profile.address}
                    onChange={(e) => setProfile({ ...profile, address: e.target.value })}
                    className="w-full px-4 py-3 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                    placeholder="123 Rue Exemple, 75001 Paris"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-heading font-600 mb-2">
                    <Link2 className="w-4 h-4 inline mr-1" />
                    {lang === 'fr' ? 'Site web' : 'Website'}
                  </label>
                  <input
                    value={profile.website}
                    onChange={(e) => setProfile({ ...profile, website: e.target.value })}
                    className="w-full px-4 py-3 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                    placeholder="https://www.exemple.com"
                  />
                </div>
                
                <Button onClick={saveProfile} disabled={saving} className="w-full rounded-xl">
                  {saving ? '...' : (lang === 'fr' ? 'Sauvegarder' : 'Save')}
                </Button>
              </div>
            )}

            {/* Timezone Step */}
            {currentStep === 1 && (
              <div className="space-y-5">
                <h2 className="text-lg font-heading font-700 flex items-center gap-2">
                  <Globe className="w-5 h-5" />
                  {lang === 'fr' ? 'Fuseau horaire' : 'Timezone'}
                </h2>
                
                <p className="text-sm text-muted-foreground">
                  {lang === 'fr' 
                    ? 'Sélectionnez votre fuseau horaire pour que les rappels soient envoyés aux bonnes heures.'
                    : 'Select your timezone so reminders are sent at the right times.'}
                </p>
                
                <div className="grid grid-cols-2 gap-3">
                  {timezones.map((tz) => (
                    <button
                      key={tz.value}
                      onClick={() => setProfile({ ...profile, timezone: tz.value })}
                      className={`p-4 rounded-xl border text-left transition-all ${
                        profile.timezone === tz.value 
                          ? 'border-primary bg-primary/10' 
                          : 'border-border hover:border-primary/30'
                      }`}
                    >
                      <p className="font-heading font-600 text-sm">{tz.label}</p>
                      <p className="text-xs text-muted-foreground">{tz.value}</p>
                    </button>
                  ))}
                </div>
                
                <div>
                  <label className="block text-sm font-heading font-600 mb-2">
                    {lang === 'fr' ? 'Langue de l\'interface' : 'Interface language'}
                  </label>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setProfile({ ...profile, lang: 'fr' })}
                      className={`flex-1 p-3 rounded-xl border ${
                        profile.lang === 'fr' ? 'border-primary bg-primary/10' : 'border-border'
                      }`}
                    >
                      🇫🇷 Français
                    </button>
                    <button
                      onClick={() => setProfile({ ...profile, lang: 'en' })}
                      className={`flex-1 p-3 rounded-xl border ${
                        profile.lang === 'en' ? 'border-primary bg-primary/10' : 'border-border'
                      }`}
                    >
                      🇬🇧 English
                    </button>
                  </div>
                </div>
                
                <Button onClick={saveProfile} disabled={saving} className="w-full rounded-xl">
                  {saving ? '...' : (lang === 'fr' ? 'Sauvegarder' : 'Save')}
                </Button>
              </div>
            )}

            {/* Business Hours Step */}
            {currentStep === 2 && (
              <div className="space-y-5">
                <h2 className="text-lg font-heading font-700 flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  {lang === 'fr' ? 'Horaires d\'ouverture' : 'Business Hours'}
                </h2>
                
                <div className="space-y-3">
                  {DAYS.map((day) => (
                    <div key={day.key} className="flex items-center gap-4 p-3 bg-muted/50 rounded-xl">
                      <div className="w-24">
                        <span className="font-heading font-600 text-sm">
                          {lang === 'fr' ? day.fr : day.en}
                        </span>
                      </div>
                      
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={hours[day.key]?.closed || false}
                          onChange={() => toggleDayClosed(day.key)}
                          className="w-4 h-4 rounded border-border"
                        />
                        <span className="text-sm text-muted-foreground">
                          {lang === 'fr' ? 'Fermé' : 'Closed'}
                        </span>
                      </label>
                      
                      {!hours[day.key]?.closed && (
                        <>
                          <input
                            type="time"
                            value={hours[day.key]?.open || '09:00'}
                            onChange={(e) => updateDayHours(day.key, 'open', e.target.value)}
                            className="px-3 py-2 bg-background border border-border rounded-lg text-sm"
                          />
                          <span className="text-muted-foreground">-</span>
                          <input
                            type="time"
                            value={hours[day.key]?.close || '18:00'}
                            onChange={(e) => updateDayHours(day.key, 'close', e.target.value)}
                            className="px-3 py-2 bg-background border border-border rounded-lg text-sm"
                          />
                        </>
                      )}
                    </div>
                  ))}
                </div>
                
                <Button onClick={saveHours} disabled={saving} className="w-full rounded-xl">
                  {saving ? '...' : (lang === 'fr' ? 'Sauvegarder' : 'Save')}
                </Button>
              </div>
            )}

            {/* Links Step */}
            {currentStep === 3 && (
              <div className="space-y-5">
                <h2 className="text-lg font-heading font-700 flex items-center gap-2">
                  <Link2 className="w-5 h-5" />
                  {lang === 'fr' ? 'Liens marketing' : 'Marketing Links'}
                </h2>
                
                <p className="text-sm text-muted-foreground">
                  {lang === 'fr' 
                    ? 'Ces liens seront utilisés dans les messages automatiques envoyés après chaque RDV.'
                    : 'These links will be used in automatic messages sent after each appointment.'}
                </p>
                
                <div>
                  <label className="block text-sm font-heading font-600 mb-2">
                    ⭐ {lang === 'fr' ? 'Lien Google Avis' : 'Google Review Link'}
                  </label>
                  <input
                    value={profile.google_review_link}
                    onChange={(e) => setProfile({ ...profile, google_review_link: e.target.value })}
                    className="w-full px-4 py-3 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                    placeholder="https://g.page/r/..."
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    {lang === 'fr' 
                      ? 'Trouvez-le dans votre fiche Google Business'
                      : 'Find it in your Google Business profile'}
                  </p>
                </div>
                
                <div>
                  <label className="block text-sm font-heading font-600 mb-2">
                    🎰 {lang === 'fr' ? 'Lien Roue de la Fortune' : 'Wheel of Fortune Link'}
                  </label>
                  <input
                    value={profile.wheel_of_fortune_link}
                    onChange={(e) => setProfile({ ...profile, wheel_of_fortune_link: e.target.value })}
                    className="w-full px-4 py-3 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                    placeholder="https://..."
                  />
                </div>
                
                <Button onClick={saveProfile} disabled={saving} className="w-full rounded-xl">
                  {saving ? '...' : (lang === 'fr' ? 'Sauvegarder' : 'Save')}
                </Button>
              </div>
            )}

            {/* Automation Step */}
            {currentStep === 4 && (
              <div className="space-y-5">
                <h2 className="text-lg font-heading font-700 flex items-center gap-2">
                  <Zap className="w-5 h-5 text-yellow-500" />
                  {lang === 'fr' ? 'Automatisation' : 'Automation'}
                </h2>
                
                <div className="bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border border-yellow-500/20 rounded-xl p-5">
                  <h3 className="font-heading font-700 text-yellow-700 dark:text-yellow-400 mb-2">
                    {lang === 'fr' ? '🎉 Configuration terminée !' : '🎉 Setup complete!'}
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    {lang === 'fr' 
                      ? 'Votre compte est configuré. L\'automatisation post-RDV est activée.'
                      : 'Your account is configured. Post-appointment automation is active.'}
                  </p>
                  <Button 
                    onClick={() => window.location.href = '/automation'}
                    className="rounded-xl bg-yellow-500 hover:bg-yellow-600 text-white"
                  >
                    <Zap className="w-4 h-4 mr-2" />
                    {lang === 'fr' ? 'Configurer l\'automatisation' : 'Configure Automation'}
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-muted/50 rounded-xl text-center">
                    <p className="text-3xl mb-2">📧</p>
                    <p className="text-sm font-heading font-600">
                      {lang === 'fr' ? 'Emails automatiques' : 'Auto emails'}
                    </p>
                    <p className="text-xs text-muted-foreground">Remerciements, avis</p>
                  </div>
                  <div className="p-4 bg-muted/50 rounded-xl text-center">
                    <p className="text-3xl mb-2">📱</p>
                    <p className="text-sm font-heading font-600">
                      {lang === 'fr' ? 'SMS/WhatsApp' : 'SMS/WhatsApp'}
                    </p>
                    <p className="text-xs text-muted-foreground">Multi-canaux</p>
                  </div>
                </div>
              </div>
            )}

            {/* Next button */}
            {currentStep < 4 && (
              <div className="mt-6 pt-4 border-t border-border">
                <Button 
                  variant="ghost" 
                  onClick={() => setCurrentStep(currentStep + 1)}
                  className="ml-auto flex items-center gap-2"
                >
                  {lang === 'fr' ? 'Étape suivante' : 'Next step'}
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </BusinessLayout>
  );
}
