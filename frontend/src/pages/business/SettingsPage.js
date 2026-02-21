import React, { useState, useEffect } from 'react';
import { Building2, Bell, CreditCard, Clock, Save } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Switch } from '../../components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import BusinessLayout from '../../components/BusinessLayout';
import { useLang } from '../../context/LangContext';
import axios from 'axios';
import { API } from '../../context/AuthContext';
import { toast } from 'sonner';

const TIMEZONES = ['Europe/Paris', 'Europe/London', 'Europe/Berlin', 'America/New_York', 'America/Los_Angeles', 'Asia/Tokyo'];

export default function SettingsPage() {
  const { lang } = useLang();
  const [business, setBusiness] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [bizForm, setBizForm] = useState({ name: '', phone: '', address: '', timezone: 'Europe/Paris' });
  const [reminderForm, setReminderForm] = useState({
    reminder_24h: true, reminder_3h: true, reminder_30min: false,
    channels: ['email']
  });
  const [depositForm, setDepositForm] = useState({ deposit_enabled: false, deposit_amount: 20 });

  useEffect(() => { fetchBusiness(); }, []);

  const fetchBusiness = async () => {
    try {
      const res = await axios.get(`${API}/businesses/me`);
      const b = res.data;
      setBusiness(b);
      setBizForm({ name: b.name || '', phone: b.phone || '', address: b.address || '', timezone: b.timezone || 'Europe/Paris' });
      if (b.reminder_settings) {
        setReminderForm({
          reminder_24h: b.reminder_settings.reminder_24h ?? true,
          reminder_3h: b.reminder_settings.reminder_3h ?? true,
          reminder_30min: b.reminder_settings.reminder_30min ?? false,
          channels: b.reminder_settings.channels || ['email']
        });
      }
      setDepositForm({ deposit_enabled: b.deposit_enabled || false, deposit_amount: b.deposit_amount || 20 });
    } catch {
      toast.error('Error loading settings');
    } finally {
      setLoading(false);
    }
  };

  const saveBusiness = async () => {
    setSaving(true);
    try {
      await axios.put(`${API}/businesses/me`, bizForm);
      toast.success(lang === 'fr' ? 'Paramètres sauvegardés' : 'Settings saved');
    } catch {
      toast.error('Error');
    } finally {
      setSaving(false);
    }
  };

  const saveReminders = async () => {
    setSaving(true);
    try {
      await axios.put(`${API}/businesses/me/reminders`, reminderForm);
      toast.success(lang === 'fr' ? 'Rappels mis à jour' : 'Reminders updated');
    } catch {
      toast.error('Error');
    } finally {
      setSaving(false);
    }
  };

  const saveDeposit = async () => {
    setSaving(true);
    try {
      await axios.put(`${API}/businesses/me/deposit`, depositForm);
      toast.success(lang === 'fr' ? 'Paramètres dépôt sauvegardés' : 'Deposit settings saved');
    } catch {
      toast.error('Error');
    } finally {
      setSaving(false);
    }
  };

  const toggleChannel = (channel) => {
    setReminderForm(p => ({
      ...p,
      channels: p.channels.includes(channel)
        ? p.channels.filter(c => c !== channel)
        : [...p.channels, channel]
    }));
  };

  if (loading) return (
    <BusinessLayout>
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    </BusinessLayout>
  );

  return (
    <BusinessLayout>
      <h1 className="text-2xl font-heading font-800 mb-6">
        {lang === 'fr' ? 'Paramètres' : 'Settings'}
      </h1>

      <Tabs defaultValue="business">
        <TabsList className="rounded-xl mb-6 h-10">
          <TabsTrigger value="business" className="rounded-lg text-sm font-heading font-600">
            <Building2 className="w-3.5 h-3.5 mr-1.5" />
            {lang === 'fr' ? 'Établissement' : 'Business'}
          </TabsTrigger>
          <TabsTrigger value="reminders" className="rounded-lg text-sm font-heading font-600">
            <Bell className="w-3.5 h-3.5 mr-1.5" />
            {lang === 'fr' ? 'Rappels' : 'Reminders'}
          </TabsTrigger>
          <TabsTrigger value="deposit" className="rounded-lg text-sm font-heading font-600">
            <CreditCard className="w-3.5 h-3.5 mr-1.5" />
            {lang === 'fr' ? 'Dépôt' : 'Deposit'}
          </TabsTrigger>
        </TabsList>

        {/* Business Info */}
        <TabsContent value="business">
          <div className="bg-card rounded-2xl border border-border/50 p-5 card-shadow space-y-4">
            <h2 className="font-heading font-700 text-base">
              {lang === 'fr' ? 'Informations de l\'établissement' : 'Business Information'}
            </h2>
            <div className="space-y-1.5">
              <Label className="font-heading font-600 text-sm">{lang === 'fr' ? 'Nom' : 'Name'}</Label>
              <Input value={bizForm.name} onChange={e => setBizForm(p => ({ ...p, name: e.target.value }))} className="h-11 rounded-xl" data-testid="settings-biz-name" />
            </div>
            <div className="space-y-1.5">
              <Label className="font-heading font-600 text-sm">{lang === 'fr' ? 'Téléphone' : 'Phone'}</Label>
              <Input value={bizForm.phone} onChange={e => setBizForm(p => ({ ...p, phone: e.target.value }))} className="h-11 rounded-xl" data-testid="settings-biz-phone" />
            </div>
            <div className="space-y-1.5">
              <Label className="font-heading font-600 text-sm">{lang === 'fr' ? 'Adresse' : 'Address'}</Label>
              <Input value={bizForm.address} onChange={e => setBizForm(p => ({ ...p, address: e.target.value }))} className="h-11 rounded-xl" data-testid="settings-biz-address" />
            </div>
            <div className="space-y-1.5">
              <Label className="font-heading font-600 text-sm">{lang === 'fr' ? 'Fuseau horaire' : 'Timezone'}</Label>
              <Select value={bizForm.timezone} onValueChange={v => setBizForm(p => ({ ...p, timezone: v }))}>
                <SelectTrigger className="h-11 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIMEZONES.map(tz => <SelectItem key={tz} value={tz}>{tz}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={saveBusiness} className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90 font-heading font-700 w-full h-11" disabled={saving} data-testid="save-business-btn">
              <Save className="w-4 h-4 mr-2" />
              {saving ? '...' : (lang === 'fr' ? 'Sauvegarder' : 'Save')}
            </Button>
          </div>
        </TabsContent>

        {/* Reminders */}
        <TabsContent value="reminders">
          <div className="bg-card rounded-2xl border border-border/50 p-5 card-shadow space-y-5">
            <h2 className="font-heading font-700 text-base">
              {lang === 'fr' ? 'Rappels automatiques' : 'Automatic Reminders'}
            </h2>

            {/* Timing */}
            <div className="space-y-3">
              {[
                { key: 'reminder_24h', label_fr: '24h avant le RDV', label_en: '24h before' },
                { key: 'reminder_3h', label_fr: '3h avant le RDV', label_en: '3h before' },
                { key: 'reminder_30min', label_fr: '30min avant le RDV', label_en: '30min before' },
              ].map(r => (
                <div key={r.key} className="flex items-center justify-between p-3 bg-muted/50 rounded-xl">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-heading font-600">{lang === 'fr' ? r.label_fr : r.label_en}</span>
                  </div>
                  <Switch
                    checked={reminderForm[r.key]}
                    onCheckedChange={v => setReminderForm(p => ({ ...p, [r.key]: v }))}
                    data-testid={`toggle-${r.key}`}
                  />
                </div>
              ))}
            </div>

            {/* Channels */}
            <div>
              <p className="text-sm font-heading font-700 mb-3">{lang === 'fr' ? 'Canaux' : 'Channels'}</p>
              <div className="space-y-2">
                {['email', 'whatsapp', 'sms'].map(ch => (
                  <div key={ch} className="flex items-center justify-between p-3 bg-muted/50 rounded-xl">
                    <span className="text-sm font-heading font-600 capitalize">{ch}</span>
                    <Switch
                      checked={reminderForm.channels.includes(ch)}
                      onCheckedChange={() => toggleChannel(ch)}
                      data-testid={`toggle-channel-${ch}`}
                    />
                  </div>
                ))}
              </div>
            </div>

            <Button onClick={saveReminders} className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90 font-heading font-700 w-full h-11" disabled={saving} data-testid="save-reminders-btn">
              <Save className="w-4 h-4 mr-2" />
              {saving ? '...' : (lang === 'fr' ? 'Sauvegarder' : 'Save')}
            </Button>
          </div>
        </TabsContent>

        {/* Deposit */}
        <TabsContent value="deposit">
          <div className="bg-card rounded-2xl border border-border/50 p-5 card-shadow space-y-4">
            <h2 className="font-heading font-700 text-base">
              {lang === 'fr' ? 'Dépôt anti-absence' : 'Anti No-Show Deposit'}
            </h2>
            <p className="text-sm text-muted-foreground">
              {lang === 'fr'
                ? 'Activez un dépôt pour responsabiliser vos clients. Les paiements seront gérés via Stripe.'
                : 'Enable a deposit to hold clients accountable. Payments handled via Stripe.'}
            </p>

            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-xl">
              <div>
                <p className="text-sm font-heading font-700">{lang === 'fr' ? 'Activer le dépôt' : 'Enable deposit'}</p>
                <p className="text-xs text-muted-foreground">{lang === 'fr' ? 'Demander un acompte à la réservation' : 'Request deposit at booking'}</p>
              </div>
              <Switch
                checked={depositForm.deposit_enabled}
                onCheckedChange={v => setDepositForm(p => ({ ...p, deposit_enabled: v }))}
                data-testid="toggle-deposit"
              />
            </div>

            {depositForm.deposit_enabled && (
              <div className="space-y-1.5">
                <Label className="font-heading font-600 text-sm">{lang === 'fr' ? 'Montant du dépôt (€)' : 'Deposit amount (€)'}</Label>
                <Input
                  type="number"
                  min="1"
                  value={depositForm.deposit_amount}
                  onChange={e => setDepositForm(p => ({ ...p, deposit_amount: parseFloat(e.target.value) }))}
                  className="h-11 rounded-xl"
                  data-testid="deposit-amount-input"
                />
              </div>
            )}

            <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl">
              <p className="text-xs text-yellow-800 dark:text-yellow-400 font-heading font-600">
                {lang === 'fr' ? 'Mode simulation activé. Aucun paiement réel ne sera effectué.' : 'Simulation mode. No real payment will be processed.'}
              </p>
            </div>

            <Button onClick={saveDeposit} className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90 font-heading font-700 w-full h-11" disabled={saving} data-testid="save-deposit-btn">
              <Save className="w-4 h-4 mr-2" />
              {saving ? '...' : (lang === 'fr' ? 'Sauvegarder' : 'Save')}
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </BusinessLayout>
  );
}
