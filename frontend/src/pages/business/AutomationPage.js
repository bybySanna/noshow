import React, { useState, useEffect } from 'react';
import { Zap, Send, Settings, BarChart2, Clock, Check, X, AlertCircle, RefreshCw, Link2, Star, Gift, Mail, MessageSquare, ChevronRight, Plus, Edit2, Trash2 } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { useLang } from '../../context/LangContext';
import BusinessLayout from '../../components/BusinessLayout';
import axios from 'axios';
import { API } from '../../context/AuthContext';
import { toast } from 'sonner';

const StatusBadge = ({ status }) => {
  const config = {
    pending: { color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400', label: 'En attente' },
    sending: { color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400', label: 'Envoi...' },
    sent: { color: 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400', label: 'Envoyé' },
    delivered: { color: 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400', label: 'Livré' },
    failed: { color: 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400', label: 'Échec' },
    retrying: { color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400', label: 'Retry' },
    fallback: { color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400', label: 'Fallback' },
  };
  const c = config[status] || { color: 'bg-muted', label: status };
  return <span className={`px-2 py-1 rounded-full text-xs font-heading font-600 ${c.color}`}>{c.label}</span>;
};

const ChannelIcon = ({ channel }) => {
  if (channel === 'sms') return <MessageSquare className="w-4 h-4" />;
  if (channel === 'whatsapp') return <MessageSquare className="w-4 h-4 text-green-500" />;
  if (channel === 'email') return <Mail className="w-4 h-4" />;
  return null;
};

export default function AutomationPage() {
  const { lang } = useLang();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [queue, setQueue] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [settings, setSettings] = useState(null);
  const [templates, setTemplates] = useState({ custom: [], defaults: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [queueRes, analyticsRes, settingsRes, templatesRes] = await Promise.all([
        axios.get(`${API}/automation/queue?limit=50`),
        axios.get(`${API}/automation/analytics`),
        axios.get(`${API}/automation/settings`),
        axios.get(`${API}/automation/templates`)
      ]);
      setQueue(queueRes.data);
      setAnalytics(analyticsRes.data);
      setSettings(settingsRes.data);
      setTemplates(templatesRes.data);
    } catch (err) {
      toast.error('Erreur');
    } finally {
      setLoading(false);
    }
  };

  const updateSettings = async (newSettings) => {
    try {
      await axios.put(`${API}/automation/settings`, newSettings);
      setSettings(newSettings);
      toast.success(lang === 'fr' ? 'Paramètres sauvegardés' : 'Settings saved');
    } catch (err) {
      toast.error('Erreur');
    }
  };

  const retryMessage = async (queueId) => {
    try {
      await axios.post(`${API}/automation/retry/${queueId}`);
      toast.success(lang === 'fr' ? 'Message remis en queue' : 'Message requeued');
      fetchData();
    } catch (err) {
      toast.error('Erreur');
    }
  };

  const toggleTemplate = (templateKey) => {
    const enabled = settings?.enabled_templates || [];
    const newEnabled = enabled.includes(templateKey)
      ? enabled.filter(k => k !== templateKey)
      : [...enabled, templateKey];
    updateSettings({ ...settings, enabled_templates: newEnabled });
  };

  return (
    <BusinessLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-heading font-800 flex items-center gap-3">
          <Zap className="w-6 h-6 text-yellow-500" />
          {lang === 'fr' ? 'Automatisation Post-RDV' : 'Post-Appointment Automation'}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {lang === 'fr' 
            ? 'Envoi automatique de messages après chaque RDV terminé'
            : 'Automatic messages sent after each completed appointment'}
        </p>
      </div>

      {/* Info Banner */}
      <div className="bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border border-yellow-500/20 rounded-xl p-4 mb-6 flex items-start gap-3">
        <Zap className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-heading font-600 text-yellow-700 dark:text-yellow-400">
            {lang === 'fr' ? '100% Automatique' : '100% Automatic'}
          </p>
          <p className="text-xs text-muted-foreground">
            {lang === 'fr' 
              ? 'Dès qu\'un RDV passe à "Terminé", les messages sont envoyés automatiquement. Aucune action manuelle requise.'
              : 'When an appointment is marked "Completed", messages are sent automatically. No manual action required.'}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {[
          { key: 'dashboard', icon: BarChart2, label_fr: 'Dashboard', label_en: 'Dashboard' },
          { key: 'queue', icon: Send, label_fr: 'File d\'envoi', label_en: 'Send Queue' },
          { key: 'templates', icon: MessageSquare, label_fr: 'Templates', label_en: 'Templates' },
          { key: 'settings', icon: Settings, label_fr: 'Paramètres', label_en: 'Settings' },
        ].map((tab) => (
          <Button
            key={tab.key}
            variant={activeTab === tab.key ? 'default' : 'outline'}
            onClick={() => setActiveTab(tab.key)}
            className="rounded-full whitespace-nowrap"
            data-testid={`tab-${tab.key}`}
          >
            <tab.icon className="w-4 h-4 mr-2" />
            {lang === 'fr' ? tab.label_fr : tab.label_en}
          </Button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {activeTab === 'dashboard' && analytics && (
            <div className="space-y-6">
              {/* KPIs */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-card rounded-xl p-4 border border-border">
                  <div className="flex items-center gap-2 text-muted-foreground text-xs mb-2">
                    <Send className="w-4 h-4" />
                    {lang === 'fr' ? 'Messages envoyés' : 'Sent'}
                  </div>
                  <p className="text-2xl font-heading font-800 text-green-600">{analytics.sent}</p>
                </div>
                <div className="bg-card rounded-xl p-4 border border-border">
                  <div className="flex items-center gap-2 text-muted-foreground text-xs mb-2">
                    <Clock className="w-4 h-4" />
                    {lang === 'fr' ? 'En attente' : 'Pending'}
                  </div>
                  <p className="text-2xl font-heading font-800 text-yellow-600">{analytics.pending}</p>
                </div>
                <div className="bg-card rounded-xl p-4 border border-border">
                  <div className="flex items-center gap-2 text-muted-foreground text-xs mb-2">
                    <X className="w-4 h-4" />
                    {lang === 'fr' ? 'Échecs' : 'Failed'}
                  </div>
                  <p className="text-2xl font-heading font-800 text-red-600">{analytics.failed}</p>
                </div>
                <div className="bg-card rounded-xl p-4 border border-border">
                  <div className="flex items-center gap-2 text-muted-foreground text-xs mb-2">
                    <Star className="w-4 h-4" />
                    {lang === 'fr' ? 'Taux engagement' : 'Engagement'}
                  </div>
                  <p className="text-2xl font-heading font-800 text-primary">{analytics.engagement?.rate || 0}%</p>
                </div>
              </div>

              {/* Par type de message */}
              <div className="bg-card rounded-xl p-5 border border-border">
                <h3 className="font-heading font-700 mb-4">
                  {lang === 'fr' ? 'Par type de message' : 'By message type'}
                </h3>
                <div className="space-y-3">
                  {analytics.by_type?.map((item) => (
                    <div key={item._id} className="flex items-center justify-between">
                      <span className="text-sm capitalize">{item._id?.replace('_', ' ') || 'unknown'}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground">{item.total} total</span>
                        <span className="text-xs text-green-600">{item.sent} envoyés</span>
                        {item.failed > 0 && (
                          <span className="text-xs text-red-600">{item.failed} échecs</span>
                        )}
                      </div>
                    </div>
                  ))}
                  {(!analytics.by_type || analytics.by_type.length === 0) && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      {lang === 'fr' ? 'Aucune donnée' : 'No data yet'}
                    </p>
                  )}
                </div>
              </div>

              {/* Clics */}
              <div className="bg-card rounded-xl p-5 border border-border">
                <h3 className="font-heading font-700 mb-4 flex items-center gap-2">
                  <Link2 className="w-4 h-4" />
                  {lang === 'fr' ? 'Engagement' : 'Engagement'}
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-4 bg-muted/50 rounded-xl">
                    <p className="text-3xl font-heading font-800">{analytics.engagement?.clicks || 0}</p>
                    <p className="text-xs text-muted-foreground">
                      {lang === 'fr' ? 'Clics sur liens' : 'Link clicks'}
                    </p>
                  </div>
                  <div className="text-center p-4 bg-muted/50 rounded-xl">
                    <p className="text-3xl font-heading font-800">{analytics.engagement?.rate || 0}%</p>
                    <p className="text-xs text-muted-foreground">
                      {lang === 'fr' ? 'Taux de clic' : 'Click rate'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'queue' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <span className="text-sm text-muted-foreground">
                    {queue.stats?.total || 0} messages total
                  </span>
                  <StatusBadge status="sent" /> <span className="text-xs">{queue.stats?.sent || 0}</span>
                  <StatusBadge status="pending" /> <span className="text-xs">{queue.stats?.pending || 0}</span>
                  <StatusBadge status="failed" /> <span className="text-xs">{queue.stats?.failed || 0}</span>
                </div>
                <Button variant="ghost" size="sm" onClick={fetchData}>
                  <RefreshCw className="w-4 h-4" />
                </Button>
              </div>

              {queue.items?.length === 0 ? (
                <div className="text-center py-12 bg-card rounded-2xl border border-border">
                  <Send className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-50" />
                  <p className="text-muted-foreground">
                    {lang === 'fr' ? 'Aucun message dans la queue' : 'No messages in queue'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {lang === 'fr' 
                      ? 'Les messages apparaîtront ici quand des RDV seront terminés'
                      : 'Messages will appear here when appointments are completed'}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {queue.items?.map((item) => (
                    <div key={item.id} className="bg-card rounded-xl p-4 border border-border">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 bg-muted rounded-full flex items-center justify-center">
                            <ChannelIcon channel={item.channel} />
                          </div>
                          <div>
                            <p className="font-heading font-600 text-sm">{item.client_name}</p>
                            <p className="text-xs text-muted-foreground">{item.recipient}</p>
                            <p className="text-xs text-muted-foreground mt-1 capitalize">
                              {item.message_type?.replace('_', ' ')} • {item.channel}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <StatusBadge status={item.status} />
                          <p className="text-[10px] text-muted-foreground mt-1">
                            {new Date(item.created_at).toLocaleString()}
                          </p>
                          {item.status === 'failed' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => retryMessage(item.id)}
                              className="mt-1 text-xs"
                            >
                              <RefreshCw className="w-3 h-3 mr-1" />
                              Retry
                            </Button>
                          )}
                        </div>
                      </div>
                      {item.error_message && (
                        <p className="text-xs text-red-600 mt-2 pl-13">{item.error_message}</p>
                      )}
                      <p className="text-xs text-muted-foreground mt-2 pl-13 line-clamp-2">{item.message}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'templates' && (
            <div className="space-y-6">
              <div className="bg-card rounded-xl p-5 border border-border">
                <h3 className="font-heading font-700 mb-4">
                  {lang === 'fr' ? 'Templates actifs' : 'Active Templates'}
                </h3>
                <p className="text-xs text-muted-foreground mb-4">
                  {lang === 'fr' 
                    ? 'Sélectionnez les templates à envoyer automatiquement après chaque RDV terminé'
                    : 'Select templates to send automatically after each completed appointment'}
                </p>
                <div className="space-y-3">
                  {templates.defaults?.map((tpl) => {
                    const isEnabled = settings?.enabled_templates?.includes(tpl.key);
                    return (
                      <div
                        key={tpl.key}
                        className={`p-4 rounded-xl border cursor-pointer transition-all ${
                          isEnabled ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/30'
                        }`}
                        onClick={() => toggleTemplate(tpl.key)}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-3">
                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                              isEnabled ? 'bg-primary border-primary' : 'border-muted-foreground'
                            }`}>
                              {isEnabled && <Check className="w-3 h-3 text-white" />}
                            </div>
                            <div>
                              <p className="font-heading font-600 text-sm">{tpl.name}</p>
                              <p className="text-xs text-muted-foreground capitalize">
                                {tpl.type?.replace('_', ' ')}
                                {tpl.include_link && (
                                  <span className="ml-2 text-primary">
                                    <Link2 className="w-3 h-3 inline" /> Avec lien
                                  </span>
                                )}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            {tpl.channels?.map((ch) => (
                              <span key={ch} className="text-[10px] px-1.5 py-0.5 bg-muted rounded uppercase">
                                {ch}
                              </span>
                            ))}
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground mt-2 pl-8 line-clamp-2">
                          {tpl.message_fr}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Templates personnalisés */}
              <div className="bg-card rounded-xl p-5 border border-border">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-heading font-700">
                    {lang === 'fr' ? 'Templates personnalisés' : 'Custom Templates'}
                  </h3>
                  <Button variant="outline" size="sm" className="rounded-lg">
                    <Plus className="w-4 h-4 mr-1" />
                    {lang === 'fr' ? 'Créer' : 'Create'}
                  </Button>
                </div>
                {templates.custom?.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    {lang === 'fr' ? 'Aucun template personnalisé' : 'No custom templates'}
                  </p>
                ) : (
                  <div className="space-y-2">
                    {templates.custom?.map((tpl) => (
                      <div key={tpl.id} className="p-3 rounded-xl border border-border flex items-center justify-between">
                        <span className="text-sm font-heading font-600">{tpl.name}</span>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm"><Edit2 className="w-4 h-4" /></Button>
                          <Button variant="ghost" size="sm"><Trash2 className="w-4 h-4 text-accent" /></Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'settings' && settings && (
            <div className="space-y-6">
              {/* Activation */}
              <div className="bg-card rounded-xl p-5 border border-border">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-heading font-700">
                      {lang === 'fr' ? 'Automatisation activée' : 'Automation enabled'}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {lang === 'fr' 
                        ? 'Envoie automatiquement des messages quand un RDV passe à "Terminé"'
                        : 'Automatically sends messages when an appointment is marked "Completed"'}
                    </p>
                  </div>
                  <button
                    onClick={() => updateSettings({ ...settings, enabled: !settings.enabled })}
                    className={`w-12 h-6 rounded-full transition-colors ${
                      settings.enabled ? 'bg-primary' : 'bg-muted'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${
                      settings.enabled ? 'translate-x-6' : 'translate-x-0.5'
                    }`} />
                  </button>
                </div>
              </div>

              {/* Canal préféré */}
              <div className="bg-card rounded-xl p-5 border border-border">
                <h3 className="font-heading font-700 mb-4">
                  {lang === 'fr' ? 'Canal préféré' : 'Preferred channel'}
                </h3>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { key: 'sms', label: 'SMS', icon: MessageSquare },
                    { key: 'whatsapp', label: 'WhatsApp', icon: MessageSquare },
                    { key: 'email', label: 'Email', icon: Mail },
                  ].map((ch) => (
                    <button
                      key={ch.key}
                      onClick={() => updateSettings({ ...settings, preferred_channel: ch.key })}
                      className={`p-4 rounded-xl border transition-all ${
                        settings.preferred_channel === ch.key 
                          ? 'border-primary bg-primary/10' 
                          : 'border-border hover:border-primary/30'
                      }`}
                    >
                      <ch.icon className={`w-5 h-5 mx-auto mb-2 ${
                        ch.key === 'whatsapp' ? 'text-green-500' : 'text-muted-foreground'
                      }`} />
                      <p className="text-sm font-heading font-600">{ch.label}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Fallback */}
              <div className="bg-card rounded-xl p-5 border border-border">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-heading font-700">
                      {lang === 'fr' ? 'Fallback automatique' : 'Auto fallback'}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {lang === 'fr' 
                        ? 'Si le canal principal échoue, essayer automatiquement un autre canal'
                        : 'If primary channel fails, automatically try another channel'}
                    </p>
                  </div>
                  <button
                    onClick={() => updateSettings({ ...settings, fallback_enabled: !settings.fallback_enabled })}
                    className={`w-12 h-6 rounded-full transition-colors ${
                      settings.fallback_enabled ? 'bg-primary' : 'bg-muted'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${
                      settings.fallback_enabled ? 'translate-x-6' : 'translate-x-0.5'
                    }`} />
                  </button>
                </div>
                {settings.fallback_enabled && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="px-2 py-1 bg-muted rounded uppercase">{settings.preferred_channel}</span>
                    <ChevronRight className="w-3 h-3" />
                    <span className="px-2 py-1 bg-muted rounded">WhatsApp</span>
                    <ChevronRight className="w-3 h-3" />
                    <span className="px-2 py-1 bg-muted rounded">Email</span>
                  </div>
                )}
              </div>

              {/* Liens */}
              <div className="bg-card rounded-xl p-5 border border-border">
                <h3 className="font-heading font-700 mb-4">
                  {lang === 'fr' ? 'Liens personnalisés' : 'Custom links'}
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-heading font-600 mb-2">
                      {lang === 'fr' ? 'Lien Google Avis' : 'Google Review Link'}
                    </label>
                    <input
                      value={settings.google_review_link || ''}
                      onChange={(e) => setSettings({ ...settings, google_review_link: e.target.value })}
                      onBlur={() => updateSettings(settings)}
                      className="w-full px-4 py-3 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                      placeholder="https://g.page/r/..."
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-heading font-600 mb-2">
                      {lang === 'fr' ? 'Lien Roue de la Fortune' : 'Wheel of Fortune Link'}
                    </label>
                    <input
                      value={settings.wheel_of_fortune_link || ''}
                      onChange={(e) => setSettings({ ...settings, wheel_of_fortune_link: e.target.value })}
                      onBlur={() => updateSettings(settings)}
                      className="w-full px-4 py-3 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                      placeholder="https://..."
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-heading font-600 mb-2">
                        {lang === 'fr' ? 'Réduction fidélité (%)' : 'Loyalty discount (%)'}
                      </label>
                      <input
                        type="number"
                        value={settings.loyalty_discount || '10'}
                        onChange={(e) => setSettings({ ...settings, loyalty_discount: e.target.value })}
                        onBlur={() => updateSettings(settings)}
                        className="w-full px-4 py-3 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-heading font-600 mb-2">
                        {lang === 'fr' ? 'Code promo' : 'Promo code'}
                      </label>
                      <input
                        value={settings.promo_code || ''}
                        onChange={(e) => setSettings({ ...settings, promo_code: e.target.value })}
                        onBlur={() => updateSettings(settings)}
                        className="w-full px-4 py-3 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                        placeholder="MERCI10"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Mode simulation */}
              <div className="bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-800/30 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-heading font-600 text-yellow-700 dark:text-yellow-400">
                      {lang === 'fr' ? 'Mode simulation actif' : 'Simulation mode active'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {lang === 'fr' 
                        ? 'Les messages sont simulés. Pour envoyer de vrais SMS/WhatsApp, configurez vos clés Twilio.'
                        : 'Messages are simulated. To send real SMS/WhatsApp, configure your Twilio keys.'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </BusinessLayout>
  );
}
