import React, { useState, useEffect } from 'react';
import { Calendar, Link2, RefreshCw, Unplug, CheckCircle, AlertCircle, ExternalLink, Plus, Settings } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import BusinessLayout from '../../components/BusinessLayout';
import { useLang } from '../../context/LangContext';
import axios from 'axios';
import { API } from '../../context/AuthContext';
import { toast } from 'sonner';
import { cn } from '../../lib/utils';

const CALENDAR_PROVIDERS = [
  { 
    id: 'google_calendar', 
    name: 'Google Calendar', 
    icon: '📅', 
    color: '#4285F4',
    description_fr: 'Synchronisez vos RDV depuis Google Calendar',
    description_en: 'Sync appointments from Google Calendar'
  },
  { 
    id: 'outlook', 
    name: 'Outlook / Office 365', 
    icon: '📆', 
    color: '#0078D4',
    description_fr: 'Connectez votre calendrier Microsoft',
    description_en: 'Connect your Microsoft calendar',
    coming_soon: true
  },
  { 
    id: 'ical', 
    name: 'iCal / Apple', 
    icon: '🍎', 
    color: '#555555',
    description_fr: 'Importez depuis Apple Calendar',
    description_en: 'Import from Apple Calendar',
    coming_soon: true
  }
];

const EXTERNAL_PLATFORMS = [
  { 
    id: 'thefork', 
    name: 'TheFork (LaFourchette)', 
    icon: '🍴', 
    color: '#00A651',
    description_fr: 'Recevez automatiquement les réservations TheFork',
    description_en: 'Automatically receive TheFork bookings'
  },
  { 
    id: 'opentable', 
    name: 'OpenTable', 
    icon: '🍽️', 
    color: '#DA3743',
    description_fr: 'Synchronisez avec OpenTable',
    description_en: 'Sync with OpenTable'
  },
  { 
    id: 'custom', 
    name: 'API Personnalisée', 
    icon: '🔌', 
    color: '#8b5cf6',
    description_fr: 'Connectez votre propre système de réservation',
    description_en: 'Connect your own booking system'
  }
];

export default function IntegrationsPage() {
  const { lang } = useLang();
  const [calendarConnections, setCalendarConnections] = useState([]);
  const [externalConnections, setExternalConnections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(null);
  const [showApiSetup, setShowApiSetup] = useState(null);
  const [apiForm, setApiForm] = useState({ platform: '', api_key: '', webhook_secret: '' });

  useEffect(() => { fetchConnections(); }, []);

  const fetchConnections = async () => {
    try {
      const [calRes, extRes] = await Promise.all([
        axios.get(`${API}/calendar/connections`),
        axios.get(`${API}/external-api/connections`)
      ]);
      setCalendarConnections(calRes.data);
      setExternalConnections(extRes.data);
    } catch (err) {
      console.error('Error fetching connections:', err);
    } finally {
      setLoading(false);
    }
  };

  const connectGoogleCalendar = async () => {
    try {
      const res = await axios.get(`${API}/calendar/google/auth-url`);
      const authUrl = res.data.auth_url;
      
      // Si c'est une URL de simulation, on l'appelle directement
      if (authUrl.startsWith('/api/')) {
        const callbackRes = await axios.get(`${API}${authUrl.replace('/api', '')}`);
        if (callbackRes.data.success) {
          toast.success(lang === 'fr' ? 'Google Calendar connecté (simulation)' : 'Google Calendar connected (simulation)');
          fetchConnections();
        }
      } else {
        // URL réelle - ouvrir dans un popup ou rediriger
        window.open(authUrl, '_blank', 'width=500,height=600');
      }
    } catch {
      toast.error('Erreur connexion Google Calendar');
    }
  };

  const syncCalendar = async (provider) => {
    setSyncing(provider);
    try {
      let res;
      if (provider === 'google_calendar') {
        res = await axios.post(`${API}/calendar/google/sync`);
      }
      
      if (res?.data?.success) {
        toast.success(
          lang === 'fr' 
            ? `${res.data.events_imported} RDV importés !` 
            : `${res.data.events_imported} appointments imported!`
        );
        fetchConnections();
      } else if (res?.data?.error) {
        toast.error(res.data.error);
      }
    } catch {
      toast.error('Erreur synchronisation');
    } finally {
      setSyncing(null);
    }
  };

  const disconnectCalendar = async (provider) => {
    try {
      await axios.delete(`${API}/calendar/${provider}/disconnect`);
      toast.success(lang === 'fr' ? 'Déconnecté' : 'Disconnected');
      fetchConnections();
    } catch {
      toast.error('Erreur');
    }
  };

  const setupExternalApi = async () => {
    try {
      const res = await axios.post(`${API}/external-api/register`, {
        platform: apiForm.platform,
        api_key: apiForm.api_key || null,
        webhook_secret: apiForm.webhook_secret || null
      });
      
      if (res.data.success) {
        toast.success(lang === 'fr' ? 'API configurée !' : 'API configured!');
        setShowApiSetup(null);
        setApiForm({ platform: '', api_key: '', webhook_secret: '' });
        fetchConnections();
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur');
    }
  };

  const isConnected = (providerId) => {
    return calendarConnections.some(c => c.provider === providerId && c.status === 'connected') ||
           externalConnections.some(c => c.platform?.toLowerCase() === providerId);
  };

  const getConnection = (providerId) => {
    return calendarConnections.find(c => c.provider === providerId) ||
           externalConnections.find(c => c.platform?.toLowerCase() === providerId);
  };

  return (
    <BusinessLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-heading font-800">
          {lang === 'fr' ? 'Intégrations' : 'Integrations'}
        </h1>
        <p className="text-sm text-muted-foreground">
          {lang === 'fr' 
            ? 'Connectez vos calendriers et plateformes de réservation' 
            : 'Connect your calendars and booking platforms'}
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center h-48 items-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-8">
          {/* Calendar Integrations */}
          <section>
            <h2 className="font-heading font-700 text-lg mb-4 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary" />
              {lang === 'fr' ? 'Calendriers' : 'Calendars'}
            </h2>
            
            <div className="grid md:grid-cols-3 gap-4">
              {CALENDAR_PROVIDERS.map(provider => {
                const connected = isConnected(provider.id);
                const connection = getConnection(provider.id);
                
                return (
                  <div 
                    key={provider.id}
                    className={cn(
                      "bg-card rounded-2xl border p-5 transition-all",
                      connected ? "border-primary/30" : "border-border/50",
                      provider.coming_soon && "opacity-60"
                    )}
                    data-testid={`calendar-${provider.id}`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div 
                          className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
                          style={{ background: `${provider.color}20` }}
                        >
                          {provider.icon}
                        </div>
                        <div>
                          <h3 className="font-heading font-700 text-sm">{provider.name}</h3>
                          {connected && (
                            <div className="flex items-center gap-1 text-xs text-primary">
                              <CheckCircle className="w-3 h-3" />
                              {lang === 'fr' ? 'Connecté' : 'Connected'}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <p className="text-xs text-muted-foreground mb-4">
                      {lang === 'fr' ? provider.description_fr : provider.description_en}
                    </p>
                    
                    {provider.coming_soon ? (
                      <div className="text-xs text-muted-foreground text-center py-2 bg-muted/50 rounded-lg">
                        {lang === 'fr' ? 'Bientôt disponible' : 'Coming soon'}
                      </div>
                    ) : connected ? (
                      <div className="space-y-2">
                        {connection?.last_sync && (
                          <p className="text-[10px] text-muted-foreground">
                            {lang === 'fr' ? 'Dernière sync:' : 'Last sync:'} {new Date(connection.last_sync).toLocaleString()}
                          </p>
                        )}
                        <div className="flex gap-2">
                          <Button 
                            onClick={() => syncCalendar(provider.id)}
                            disabled={syncing === provider.id}
                            className="flex-1 rounded-full h-9 text-xs font-heading font-700 bg-primary text-primary-foreground hover:bg-primary/90"
                            data-testid={`sync-${provider.id}`}
                          >
                            <RefreshCw className={cn("w-3.5 h-3.5 mr-1", syncing === provider.id && "animate-spin")} />
                            {syncing === provider.id ? '...' : 'Sync'}
                          </Button>
                          <Button 
                            onClick={() => disconnectCalendar(provider.id)}
                            variant="outline"
                            className="rounded-full h-9 text-xs font-heading font-700 px-3"
                            data-testid={`disconnect-${provider.id}`}
                          >
                            <Unplug className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button 
                        onClick={connectGoogleCalendar}
                        className="w-full rounded-full h-9 text-xs font-heading font-700"
                        style={{ background: provider.color }}
                        data-testid={`connect-${provider.id}`}
                      >
                        <Link2 className="w-3.5 h-3.5 mr-1" />
                        {lang === 'fr' ? 'Connecter' : 'Connect'}
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* External Platform Integrations */}
          <section>
            <h2 className="font-heading font-700 text-lg mb-4 flex items-center gap-2">
              <ExternalLink className="w-5 h-5 text-primary" />
              {lang === 'fr' ? 'Plateformes de réservation' : 'Booking platforms'}
            </h2>
            
            <div className="grid md:grid-cols-3 gap-4">
              {EXTERNAL_PLATFORMS.map(platform => {
                const connected = externalConnections.some(c => c.platform?.toLowerCase() === platform.id);
                const connection = externalConnections.find(c => c.platform?.toLowerCase() === platform.id);
                
                return (
                  <div 
                    key={platform.id}
                    className={cn(
                      "bg-card rounded-2xl border p-5 transition-all",
                      connected ? "border-primary/30" : "border-border/50"
                    )}
                    data-testid={`platform-${platform.id}`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div 
                          className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
                          style={{ background: `${platform.color}20` }}
                        >
                          {platform.icon}
                        </div>
                        <div>
                          <h3 className="font-heading font-700 text-sm">{platform.name}</h3>
                          {connected && (
                            <div className="flex items-center gap-1 text-xs text-yellow-600 dark:text-yellow-400">
                              <AlertCircle className="w-3 h-3" />
                              {lang === 'fr' ? 'En attente config' : 'Pending config'}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <p className="text-xs text-muted-foreground mb-4">
                      {lang === 'fr' ? platform.description_fr : platform.description_en}
                    </p>
                    
                    {connected ? (
                      <div className="space-y-2">
                        <div className="bg-muted/50 rounded-lg p-2 text-[10px] font-mono text-muted-foreground break-all">
                          Webhook: {connection?.webhook_url}
                        </div>
                        <Button 
                          onClick={() => { setShowApiSetup(platform); setApiForm({ ...apiForm, platform: platform.id }); }}
                          variant="outline"
                          className="w-full rounded-full h-9 text-xs font-heading font-700"
                        >
                          <Settings className="w-3.5 h-3.5 mr-1" />
                          {lang === 'fr' ? 'Configurer' : 'Configure'}
                        </Button>
                      </div>
                    ) : (
                      <Button 
                        onClick={() => { setShowApiSetup(platform); setApiForm({ ...apiForm, platform: platform.id }); }}
                        className="w-full rounded-full h-9 text-xs font-heading font-700"
                        style={{ background: platform.color }}
                        data-testid={`setup-${platform.id}`}
                      >
                        <Plus className="w-3.5 h-3.5 mr-1" />
                        {lang === 'fr' ? 'Configurer' : 'Setup'}
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* Info section */}
          <section className="bg-muted/30 rounded-2xl p-5">
            <h3 className="font-heading font-700 text-sm mb-2">
              {lang === 'fr' ? '💡 Comment ça marche ?' : '💡 How does it work?'}
            </h3>
            <ul className="text-xs text-muted-foreground space-y-1">
              <li>• {lang === 'fr' 
                ? 'Les RDV importés depuis les calendriers sont automatiquement ajoutés avec le statut "Non confirmé"'
                : 'Imported appointments are automatically added with "Pending" status'}
              </li>
              <li>• {lang === 'fr'
                ? 'Les notifications de confirmation sont envoyées automatiquement comme pour un RDV manuel'
                : 'Confirmation notifications are sent automatically like for manual appointments'}
              </li>
              <li>• {lang === 'fr'
                ? 'Vous pouvez voir la source de chaque RDV dans votre planning'
                : 'You can see the source of each appointment in your schedule'}
              </li>
            </ul>
          </section>
        </div>
      )}

      {/* API Setup Modal */}
      {showApiSetup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setShowApiSetup(null)}>
          <div 
            className="bg-card rounded-2xl w-full max-w-md p-6 shadow-xl animate-slide-up"
            onClick={e => e.stopPropagation()}
            data-testid="api-setup-modal"
          >
            <div className="flex items-center gap-3 mb-5">
              <div 
                className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
                style={{ background: `${showApiSetup.color}20` }}
              >
                {showApiSetup.icon}
              </div>
              <div>
                <h2 className="font-heading font-800">{lang === 'fr' ? 'Configurer' : 'Setup'} {showApiSetup.name}</h2>
                <p className="text-xs text-muted-foreground">
                  {lang === 'fr' ? 'Entrez vos identifiants API' : 'Enter your API credentials'}
                </p>
              </div>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="text-xs font-heading font-600 block mb-1">
                  {lang === 'fr' ? 'Clé API (optionnel)' : 'API Key (optional)'}
                </label>
                <Input 
                  value={apiForm.api_key}
                  onChange={e => setApiForm(p => ({ ...p, api_key: e.target.value }))}
                  placeholder="sk_live_..."
                  className="h-10 rounded-xl font-mono text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-heading font-600 block mb-1">
                  Webhook Secret (optionnel)
                </label>
                <Input 
                  value={apiForm.webhook_secret}
                  onChange={e => setApiForm(p => ({ ...p, webhook_secret: e.target.value }))}
                  placeholder="whsec_..."
                  className="h-10 rounded-xl font-mono text-sm"
                />
              </div>
              
              <div className="bg-muted/50 rounded-lg p-3 text-xs text-muted-foreground">
                <p className="font-heading font-600 mb-1">{lang === 'fr' ? 'Note:' : 'Note:'}</p>
                <p>{lang === 'fr' 
                  ? 'Les clés API seront ajoutées plus tard. Pour l\'instant, nous préparons la structure de connexion.'
                  : 'API keys will be added later. For now, we are preparing the connection structure.'}
                </p>
              </div>
            </div>
            
            <div className="flex gap-2 mt-5">
              <Button onClick={() => setShowApiSetup(null)} variant="outline" className="flex-1 rounded-full h-10 font-heading font-700">
                {lang === 'fr' ? 'Annuler' : 'Cancel'}
              </Button>
              <Button onClick={setupExternalApi} className="flex-1 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 h-10 font-heading font-700" data-testid="save-api-btn">
                {lang === 'fr' ? 'Enregistrer' : 'Save'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </BusinessLayout>
  );
}
