import React, { useState, useEffect } from 'react';
import { CreditCard, Zap, MessageSquare, Mail, Phone, TrendingUp, AlertTriangle, Plus, Check, RefreshCw, Package, Clock, ArrowRight, Settings } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { useLang } from '../../context/LangContext';
import BusinessLayout from '../../components/BusinessLayout';
import axios from 'axios';
import { API } from '../../context/AuthContext';
import { toast } from 'sonner';

const CreditGauge = ({ label, icon: Icon, usage, limit, remaining, usagePercent, unlimited, color }) => {
  const getColor = () => {
    if (unlimited) return 'bg-green-500';
    if (usagePercent >= 100) return 'bg-red-500';
    if (usagePercent >= 80) return 'bg-orange-500';
    return color;
  };

  return (
    <div className="bg-card rounded-xl p-5 border border-border">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color.replace('bg-', 'bg-').replace('-500', '-100')} dark:bg-opacity-20`}>
            <Icon className={`w-5 h-5 ${color.replace('bg-', 'text-')}`} />
          </div>
          <div>
            <p className="font-heading font-700">{label}</p>
            <p className="text-xs text-muted-foreground">
              {unlimited ? '∞ illimité' : `${remaining} restants`}
            </p>
          </div>
        </div>
        {usagePercent >= 80 && !unlimited && (
          <AlertTriangle className="w-5 h-5 text-orange-500" />
        )}
      </div>
      
      {!unlimited && (
        <>
          <div className="h-2 bg-muted rounded-full overflow-hidden mb-2">
            <div
              className={`h-full rounded-full transition-all ${getColor()}`}
              style={{ width: `${Math.min(usagePercent, 100)}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{usage} utilisés</span>
            <span>{limit} limite mensuelle</span>
          </div>
        </>
      )}
      
      {unlimited && (
        <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
          <Check className="w-4 h-4" />
          <span className="text-sm font-heading font-600">Plan illimité</span>
        </div>
      )}
    </div>
  );
};

const PackCard = ({ pack, quantity, price, onPurchase, loading, useStripe }) => {
  const { lang } = useLang();
  
  return (
    <button
      onClick={() => onPurchase(pack)}
      disabled={loading}
      className="p-4 bg-muted/50 rounded-xl border border-border hover:border-primary/30 transition-all text-left group"
      data-testid={`pack-${pack}`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="font-heading font-700">{quantity}</span>
        <span className="text-primary font-heading font-700">{(price / 100).toFixed(2)}€</span>
      </div>
      <p className="text-xs text-muted-foreground">
        {(price / quantity / 100).toFixed(3)}€/{lang === 'fr' ? 'unité' : 'unit'}
      </p>
      {useStripe && (
        <p className="text-xs text-primary mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
          {lang === 'fr' ? '→ Payer avec Stripe' : '→ Pay with Stripe'}
        </p>
      )}
    </button>
  );
};

export default function CreditsPage() {
  const { lang } = useLang();
  const [dashboard, setDashboard] = useState(null);
  const [history, setHistory] = useState({ usage_logs: [], purchases: [] });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [purchasing, setPurchasing] = useState(false);
  const [selectedType, setSelectedType] = useState('sms');
  const [useStripeCheckout, setUseStripeCheckout] = useState(true);
  const [checkingPayment, setCheckingPayment] = useState(false);

  useEffect(() => {
    fetchData();
    checkPaymentReturn();
  }, []);

  // Vérifie si on revient d'un paiement Stripe
  const checkPaymentReturn = async () => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get('session_id');
    const success = params.get('success');
    const cancelled = params.get('cancelled');

    if (cancelled) {
      toast.error(lang === 'fr' ? 'Paiement annulé' : 'Payment cancelled');
      window.history.replaceState({}, '', window.location.pathname);
      return;
    }

    if (sessionId && success) {
      setCheckingPayment(true);
      await pollPaymentStatus(sessionId);
      window.history.replaceState({}, '', window.location.pathname);
      setCheckingPayment(false);
    }
  };

  // Polling du statut de paiement
  const pollPaymentStatus = async (sessionId, attempts = 0) => {
    const maxAttempts = 5;
    
    if (attempts >= maxAttempts) {
      toast.error(lang === 'fr' 
        ? 'Vérification du paiement expirée. Consultez votre email.'
        : 'Payment check timed out. Check your email.');
      return;
    }

    try {
      const response = await axios.get(`${API}/credits/checkout/status/${sessionId}`);
      const data = response.data;

      if (data.payment_status === 'paid') {
        toast.success(
          lang === 'fr' 
            ? `Paiement réussi ! ${data.credits_added} crédits ajoutés.`
            : `Payment successful! ${data.credits_added} credits added.`
        );
        fetchData();
        return;
      } else if (data.status === 'expired') {
        toast.error(lang === 'fr' ? 'Session expirée' : 'Session expired');
        return;
      }

      // Continuer le polling
      await new Promise(r => setTimeout(r, 2000));
      await pollPaymentStatus(sessionId, attempts + 1);
    } catch (err) {
      console.error('Payment status error:', err);
      if (attempts < maxAttempts - 1) {
        await new Promise(r => setTimeout(r, 2000));
        await pollPaymentStatus(sessionId, attempts + 1);
      }
    }
  };

  const fetchData = async () => {
    try {
      const [dashboardRes, historyRes] = await Promise.all([
        axios.get(`${API}/credits/dashboard`),
        axios.get(`${API}/credits/history`)
      ]);
      setDashboard(dashboardRes.data);
      setHistory(historyRes.data);
    } catch (err) {
      toast.error('Erreur');
    } finally {
      setLoading(false);
    }
  };

  const purchasePack = async (packKey) => {
    setPurchasing(true);
    try {
      if (useStripeCheckout) {
        // Paiement via Stripe Checkout
        const response = await axios.post(`${API}/credits/checkout`, {
          credit_type: selectedType,
          pack_key: packKey,
          origin_url: window.location.origin
        });
        
        // Redirection vers Stripe
        if (response.data.checkout_url) {
          window.location.href = response.data.checkout_url;
        }
      } else {
        // Mode simulation (sans paiement réel)
        await axios.post(`${API}/credits/purchase`, {
          credit_type: selectedType,
          pack_key: packKey
        });
        toast.success(lang === 'fr' ? 'Crédits ajoutés !' : 'Credits added!');
        fetchData();
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur');
    } finally {
      setPurchasing(false);
    }
  };

  const togglePayAsYouGo = async () => {
    try {
      const enabled = !dashboard?.pay_as_you_go?.enabled;
      await axios.put(`${API}/credits/pay-as-you-go`, {
        credit_types: enabled ? ['sms', 'email', 'whatsapp'] : [],
        auto_reload_threshold: 10
      });
      toast.success(lang === 'fr' 
        ? (enabled ? 'Pay-as-you-go activé' : 'Pay-as-you-go désactivé')
        : (enabled ? 'Pay-as-you-go enabled' : 'Pay-as-you-go disabled')
      );
      fetchData();
    } catch (err) {
      toast.error('Erreur');
    }
  };

  const creditConfig = {
    sms: { icon: Phone, label: 'SMS', color: 'bg-blue-500' },
    email: { icon: Mail, label: 'Email', color: 'bg-purple-500' },
    whatsapp: { icon: MessageSquare, label: 'WhatsApp', color: 'bg-green-500' }
  };

  return (
    <BusinessLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-heading font-800 flex items-center gap-3">
          <CreditCard className="w-6 h-6 text-primary" />
          {lang === 'fr' ? 'Crédits & Facturation' : 'Credits & Billing'}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {lang === 'fr' 
            ? 'Gérez vos crédits SMS, Email et WhatsApp'
            : 'Manage your SMS, Email and WhatsApp credits'}
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {[
          { key: 'overview', icon: TrendingUp, label_fr: 'Vue d\'ensemble', label_en: 'Overview' },
          { key: 'purchase', icon: Plus, label_fr: 'Acheter', label_en: 'Purchase' },
          { key: 'history', icon: Clock, label_fr: 'Historique', label_en: 'History' },
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
          {activeTab === 'overview' && dashboard && (
            <div className="space-y-6">
              {/* Credit Gauges */}
              <div className="grid md:grid-cols-3 gap-4">
                {Object.entries(dashboard.credits || {}).map(([type, data]) => {
                  const config = creditConfig[type];
                  if (!config) return null;
                  return (
                    <CreditGauge
                      key={type}
                      label={config.label}
                      icon={config.icon}
                      usage={data.usage || 0}
                      limit={data.limit || 0}
                      remaining={data.remaining || 0}
                      usagePercent={data.usage_percent || 0}
                      unlimited={data.unlimited}
                      color={config.color}
                    />
                  );
                })}
              </div>

              {/* Bonus Credits */}
              {Object.keys(dashboard.bonus_credits || {}).length > 0 && (
                <div className="bg-gradient-to-r from-primary/10 to-primary/5 rounded-xl p-5 border border-primary/20">
                  <h3 className="font-heading font-700 mb-3 flex items-center gap-2">
                    <Package className="w-5 h-5 text-primary" />
                    {lang === 'fr' ? 'Crédits bonus' : 'Bonus Credits'}
                  </h3>
                  <div className="flex gap-4">
                    {Object.entries(dashboard.bonus_credits).map(([type, count]) => (
                      <div key={type} className="flex items-center gap-2">
                        {creditConfig[type] && React.createElement(creditConfig[type].icon, { className: "w-4 h-4 text-muted-foreground" })}
                        <span className="font-heading font-600">{count}</span>
                        <span className="text-xs text-muted-foreground uppercase">{type}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Usage comparison */}
              <div className="bg-card rounded-xl p-5 border border-border">
                <h3 className="font-heading font-700 mb-4">
                  {lang === 'fr' ? 'Utilisation ce mois vs mois dernier' : 'This month vs last month'}
                </h3>
                <div className="grid grid-cols-3 gap-4">
                  {['sms', 'email', 'whatsapp'].map((type) => {
                    const thisMonth = dashboard.usage_this_month?.[type] || 0;
                    const lastMonth = dashboard.usage_last_month?.[type] || 0;
                    const trend = thisMonth > lastMonth ? 'up' : thisMonth < lastMonth ? 'down' : 'same';
                    
                    return (
                      <div key={type} className="text-center">
                        <p className="text-2xl font-heading font-800">{thisMonth}</p>
                        <p className="text-xs text-muted-foreground uppercase">{type}</p>
                        {lastMonth > 0 && (
                          <p className={`text-xs mt-1 ${trend === 'up' ? 'text-red-500' : trend === 'down' ? 'text-green-500' : 'text-muted-foreground'}`}>
                            {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '='} {lastMonth} mois dernier
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Low credits alert */}
              {Object.values(dashboard.credits || {}).some(c => c.usage_percent >= 80 && !c.unlimited) && (
                <div className="bg-orange-50 dark:bg-orange-900/10 border border-orange-200 dark:border-orange-800/30 rounded-xl p-4 flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-orange-600 flex-shrink-0" />
                  <div>
                    <p className="font-heading font-600 text-orange-700 dark:text-orange-400">
                      {lang === 'fr' ? 'Crédits bientôt épuisés' : 'Credits running low'}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {lang === 'fr' 
                        ? 'Achetez des crédits supplémentaires ou activez le pay-as-you-go.'
                        : 'Purchase additional credits or enable pay-as-you-go.'}
                    </p>
                    <Button 
                      onClick={() => setActiveTab('purchase')}
                      className="mt-3 rounded-xl"
                      size="sm"
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      {lang === 'fr' ? 'Acheter des crédits' : 'Buy credits'}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'purchase' && dashboard && (
            <div className="space-y-6">
              {/* Credit type selector */}
              <div className="flex gap-2">
                {Object.entries(creditConfig).map(([type, config]) => (
                  <Button
                    key={type}
                    variant={selectedType === type ? 'default' : 'outline'}
                    onClick={() => setSelectedType(type)}
                    className="rounded-full"
                  >
                    <config.icon className="w-4 h-4 mr-2" />
                    {config.label}
                  </Button>
                ))}
              </div>

              {/* Packs */}
              <div className="bg-card rounded-xl p-5 border border-border">
                <h3 className="font-heading font-700 mb-4">
                  {lang === 'fr' ? `Packs ${creditConfig[selectedType]?.label}` : `${creditConfig[selectedType]?.label} Packs`}
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {Object.entries(dashboard.packs_available?.[selectedType]?.packs || {}).map(([key, pack]) => (
                    <PackCard
                      key={key}
                      pack={key}
                      quantity={pack.quantity}
                      price={pack.price_cents}
                      onPurchase={purchasePack}
                      loading={purchasing}
                    />
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-4">
                  {lang === 'fr' 
                    ? 'Les crédits achetés n\'expirent jamais et s\'ajoutent à votre quota mensuel.'
                    : 'Purchased credits never expire and are added to your monthly quota.'}
                </p>
              </div>

              {/* Pay-as-you-go promo */}
              <div className="bg-gradient-to-r from-primary/10 to-purple-500/10 rounded-xl p-5 border border-primary/20">
                <div className="flex items-start gap-4">
                  <Zap className="w-8 h-8 text-primary flex-shrink-0" />
                  <div className="flex-1">
                    <h3 className="font-heading font-700">Pay-as-you-go</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      {lang === 'fr' 
                        ? 'Activez la recharge automatique pour ne jamais tomber à court de crédits. Facturé mensuellement selon votre consommation.'
                        : 'Enable auto-reload to never run out of credits. Billed monthly based on usage.'}
                    </p>
                    <Button 
                      onClick={() => setActiveTab('settings')}
                      variant="outline"
                      className="mt-3 rounded-xl"
                      size="sm"
                    >
                      {lang === 'fr' ? 'Configurer' : 'Configure'}
                      <ArrowRight className="w-4 h-4 ml-1" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'history' && (
            <div className="space-y-6">
              {/* Purchases */}
              <div className="bg-card rounded-xl p-5 border border-border">
                <h3 className="font-heading font-700 mb-4">
                  {lang === 'fr' ? 'Achats récents' : 'Recent Purchases'}
                </h3>
                {history.purchases?.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    {lang === 'fr' ? 'Aucun achat' : 'No purchases'}
                  </p>
                ) : (
                  <div className="space-y-2">
                    {history.purchases?.map((p) => (
                      <div key={p.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-xl">
                        <div className="flex items-center gap-3">
                          <Package className="w-4 h-4 text-muted-foreground" />
                          <div>
                            <p className="text-sm font-heading font-600">
                              +{p.quantity} {p.credit_type}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(p.created_at).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <span className="text-sm font-heading font-700 text-primary">
                          {(p.price_cents / 100).toFixed(2)}€
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Usage logs */}
              <div className="bg-card rounded-xl p-5 border border-border">
                <h3 className="font-heading font-700 mb-4">
                  {lang === 'fr' ? 'Utilisation récente' : 'Recent Usage'}
                </h3>
                {history.usage_logs?.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    {lang === 'fr' ? 'Aucune utilisation' : 'No usage'}
                  </p>
                ) : (
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {history.usage_logs?.slice(0, 30).map((log) => {
                      const config = creditConfig[log.credit_type];
                      return (
                        <div key={log.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-xl">
                          <div className="flex items-center gap-3">
                            {config && React.createElement(config.icon, { 
                              className: `w-4 h-4 ${config.color.replace('bg-', 'text-')}` 
                            })}
                            <div>
                              <p className="text-sm font-heading font-600 uppercase">
                                {log.credit_type}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {new Date(log.created_at).toLocaleString()}
                              </p>
                            </div>
                          </div>
                          <span className="text-sm text-muted-foreground">
                            -{log.quantity}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'settings' && dashboard && (
            <div className="space-y-6">
              {/* Pay-as-you-go */}
              <div className="bg-card rounded-xl p-5 border border-border">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-heading font-700 flex items-center gap-2">
                      <Zap className="w-5 h-5 text-yellow-500" />
                      Pay-as-you-go
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      {lang === 'fr' 
                        ? 'Recharge automatique quand les crédits sont bas'
                        : 'Auto-reload when credits run low'}
                    </p>
                  </div>
                  <button
                    onClick={togglePayAsYouGo}
                    className={`w-12 h-6 rounded-full transition-colors ${
                      dashboard.pay_as_you_go?.enabled ? 'bg-primary' : 'bg-muted'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${
                      dashboard.pay_as_you_go?.enabled ? 'translate-x-6' : 'translate-x-0.5'
                    }`} />
                  </button>
                </div>
                
                {dashboard.pay_as_you_go?.enabled && (
                  <div className="mt-4 p-4 bg-muted/50 rounded-xl">
                    <p className="text-sm">
                      {lang === 'fr' 
                        ? 'Quand vos crédits passent sous 10, nous rechargeons automatiquement 100 crédits.'
                        : 'When your credits fall below 10, we automatically reload 100 credits.'}
                    </p>
                    <p className="text-xs text-muted-foreground mt-2">
                      {lang === 'fr' 
                        ? 'Facturé mensuellement selon votre consommation réelle.'
                        : 'Billed monthly based on actual usage.'}
                    </p>
                  </div>
                )}
              </div>

              {/* Pricing info */}
              <div className="bg-card rounded-xl p-5 border border-border">
                <h3 className="font-heading font-700 mb-4">
                  {lang === 'fr' ? 'Tarifs unitaires' : 'Unit Pricing'}
                </h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-muted/50 rounded-xl">
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4 text-blue-500" />
                      <span>SMS</span>
                    </div>
                    <span className="font-heading font-700">0.05€</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-muted/50 rounded-xl">
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-purple-500" />
                      <span>Email</span>
                    </div>
                    <span className="font-heading font-700">0.01€</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-muted/50 rounded-xl">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="w-4 h-4 text-green-500" />
                      <span>WhatsApp</span>
                    </div>
                    <span className="font-heading font-700">0.08€</span>
                  </div>
                </div>
              </div>

              {/* Upgrade suggestion */}
              <div className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 rounded-xl p-5 border border-purple-500/20">
                <h3 className="font-heading font-700 mb-2">
                  {lang === 'fr' ? 'Besoin de plus ?' : 'Need more?'}
                </h3>
                <p className="text-sm text-muted-foreground mb-3">
                  {lang === 'fr' 
                    ? 'Passez à un plan supérieur pour des limites plus élevées et des fonctionnalités avancées.'
                    : 'Upgrade to a higher plan for increased limits and advanced features.'}
                </p>
                <Button className="rounded-xl" variant="outline">
                  {lang === 'fr' ? 'Voir les plans' : 'View plans'}
                  <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </BusinessLayout>
  );
}
