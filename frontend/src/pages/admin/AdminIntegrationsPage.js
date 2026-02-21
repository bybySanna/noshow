import React, { useState, useEffect } from 'react';
import { Settings, Mail, Phone, CreditCard, CheckCircle, XCircle, Key, RefreshCw, Save, AlertCircle } from 'lucide-react';
import AdminLayout from '../../components/AdminLayout';
import { useLang } from '../../context/LangContext';
import { Button } from '../../components/ui/button';
import axios from 'axios';
import { API } from '../../context/AuthContext';
import { toast } from 'sonner';

export default function AdminIntegrationsPage() {
  const { lang } = useLang();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [systemHealth, setSystemHealth] = useState(null);
  const [integrations, setIntegrations] = useState({
    resend: { status: 'simulation', configured: false },
    twilio: { status: 'simulation', configured: false },
    stripe: { status: 'active', configured: true },
    google_calendar: { status: 'simulation', configured: false }
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const healthRes = await axios.get(`${API}/admin/system-health`);
      setSystemHealth(healthRes.data);
      
      // Déterminer les statuts
      setIntegrations({
        resend: { 
          status: healthRes.data?.email_service === 'active' ? 'active' : 'simulation',
          configured: healthRes.data?.email_service === 'active'
        },
        twilio: { 
          status: healthRes.data?.sms_service === 'active' ? 'active' : 'simulation',
          configured: healthRes.data?.sms_service === 'active'
        },
        stripe: { 
          status: 'active',
          configured: true
        },
        google_calendar: { 
          status: healthRes.data?.calendar_integration === 'active' ? 'active' : 'simulation',
          configured: healthRes.data?.calendar_integration === 'active'
        }
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const testIntegration = async (service) => {
    toast.info(lang === 'fr' ? `Test de ${service}...` : `Testing ${service}...`);
    try {
      await axios.post(`${API}/admin/test-integration`, { service });
      toast.success(lang === 'fr' ? 'Test réussi !' : 'Test successful!');
    } catch (err) {
      toast.error(err.response?.data?.detail || lang === 'fr' ? 'Échec du test' : 'Test failed');
    }
  };

  const IntegrationCard = ({ name, icon: Icon, title, description, status, configured, envVars, docsUrl, color }) => (
    <div className="bg-card rounded-2xl border border-border p-6">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color}`}>
            <Icon className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="font-heading font-700 text-lg">{title}</h3>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
        </div>
        <span className={`px-3 py-1 rounded-full text-xs font-heading font-700 ${
          status === 'active' 
            ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400' 
            : 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400'
        }`}>
          {status === 'active' 
            ? (lang === 'fr' ? 'Actif' : 'Active')
            : (lang === 'fr' ? 'Simulation' : 'Simulation')}
        </span>
      </div>

      {status === 'simulation' && (
        <div className="bg-muted/50 rounded-xl p-4 mb-4">
          <p className="text-sm text-muted-foreground mb-3">
            {lang === 'fr' 
              ? 'Pour activer cette intégration, ajoutez les variables d\'environnement suivantes dans /app/backend/.env:'
              : 'To activate this integration, add the following environment variables to /app/backend/.env:'}
          </p>
          <pre className="text-xs bg-background p-3 rounded-lg font-mono overflow-x-auto">
            {envVars}
          </pre>
        </div>
      )}

      <div className="flex items-center gap-3">
        {status === 'active' && (
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => testIntegration(name)}
            className="rounded-xl"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            {lang === 'fr' ? 'Tester' : 'Test'}
          </Button>
        )}
        {docsUrl && (
          <a 
            href={docsUrl} 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-xs text-primary hover:underline"
          >
            {lang === 'fr' ? 'Documentation →' : 'Documentation →'}
          </a>
        )}
      </div>
    </div>
  );

  return (
    <AdminLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-heading font-800 flex items-center gap-3">
          <Settings className="w-6 h-6 text-primary" />
          {lang === 'fr' ? 'Intégrations' : 'Integrations'}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {lang === 'fr' 
            ? 'Gérez les services tiers connectés à NoShowGone'
            : 'Manage third-party services connected to NoShowGone'}
        </p>
      </div>

      {/* System Status */}
      <div className="bg-gradient-to-r from-primary/10 to-blue-500/10 rounded-2xl border border-primary/20 p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-heading font-700 flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-primary" />
            {lang === 'fr' ? 'État du système' : 'System Status'}
          </h2>
          <button onClick={fetchData} className="p-2 rounded-full hover:bg-muted">
            <RefreshCw className={`w-4 h-4 text-muted-foreground ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
        
        {systemHealth && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(systemHealth).filter(([k]) => k !== 'last_check').map(([key, value]) => (
              <div key={key} className="flex items-center gap-2">
                {value === 'healthy' || value === 'active' ? (
                  <CheckCircle className="w-4 h-4 text-green-500" />
                ) : value === 'simulation_mode' ? (
                  <AlertCircle className="w-4 h-4 text-yellow-500" />
                ) : (
                  <XCircle className="w-4 h-4 text-red-500" />
                )}
                <div>
                  <p className="text-xs text-muted-foreground capitalize">{key.replace(/_/g, ' ')}</p>
                  <p className="text-sm font-heading font-600">{value}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-6">
          {/* Email - Resend */}
          <IntegrationCard
            name="resend"
            icon={Mail}
            title="Resend"
            description={lang === 'fr' ? 'Envoi d\'emails transactionnels' : 'Transactional email delivery'}
            status={integrations.resend.status}
            configured={integrations.resend.configured}
            color="bg-purple-500"
            envVars="RESEND_API_KEY=re_xxxxxxxx"
            docsUrl="https://resend.com/docs"
          />

          {/* SMS/WhatsApp - Twilio */}
          <IntegrationCard
            name="twilio"
            icon={Phone}
            title="Twilio"
            description={lang === 'fr' ? 'SMS et WhatsApp' : 'SMS and WhatsApp'}
            status={integrations.twilio.status}
            configured={integrations.twilio.configured}
            color="bg-blue-500"
            envVars={`TWILIO_ACCOUNT_SID=ACxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxx
TWILIO_PHONE_NUMBER=+33xxxxxxxx`}
            docsUrl="https://www.twilio.com/docs"
          />

          {/* Payments - Stripe */}
          <IntegrationCard
            name="stripe"
            icon={CreditCard}
            title="Stripe"
            description={lang === 'fr' ? 'Paiements et facturation' : 'Payments and billing'}
            status={integrations.stripe.status}
            configured={integrations.stripe.configured}
            color="bg-green-500"
            envVars="STRIPE_API_KEY=sk_live_xxxxxxxx"
            docsUrl="https://stripe.com/docs"
          />

          {/* Calendar - Google */}
          <IntegrationCard
            name="google_calendar"
            icon={Settings}
            title="Google Calendar"
            description={lang === 'fr' ? 'Synchronisation calendrier' : 'Calendar synchronization'}
            status={integrations.google_calendar.status}
            configured={integrations.google_calendar.configured}
            color="bg-red-500"
            envVars={`GOOGLE_CLIENT_ID=xxxxxxxx
GOOGLE_CLIENT_SECRET=xxxxxxxx`}
            docsUrl="https://developers.google.com/calendar"
          />
        </div>
      )}

      {/* Info box */}
      <div className="mt-6 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800/30 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <Key className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-heading font-600 text-blue-700 dark:text-blue-400">
              {lang === 'fr' ? 'Où trouver les clés API ?' : 'Where to find API keys?'}
            </p>
            <ul className="text-sm text-muted-foreground mt-2 space-y-1">
              <li>• Resend: <a href="https://resend.com/api-keys" className="text-primary hover:underline" target="_blank" rel="noreferrer">resend.com/api-keys</a></li>
              <li>• Twilio: <a href="https://console.twilio.com" className="text-primary hover:underline" target="_blank" rel="noreferrer">console.twilio.com</a></li>
              <li>• Stripe: <a href="https://dashboard.stripe.com/apikeys" className="text-primary hover:underline" target="_blank" rel="noreferrer">dashboard.stripe.com/apikeys</a></li>
              <li>• Google: <a href="https://console.cloud.google.com/apis/credentials" className="text-primary hover:underline" target="_blank" rel="noreferrer">console.cloud.google.com</a></li>
            </ul>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
