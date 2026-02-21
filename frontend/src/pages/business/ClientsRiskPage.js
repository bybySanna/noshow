import React, { useState, useEffect } from 'react';
import { AlertTriangle, UserX, Plus, Trash2, Shield, TrendingDown } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import BusinessLayout from '../../components/BusinessLayout';
import { useLang } from '../../context/LangContext';
import axios from 'axios';
import { API } from '../../context/AuthContext';
import { toast } from 'sonner';
import { cn } from '../../lib/utils';

export default function ClientsRiskPage() {
  const { lang } = useLang();
  const [riskClients, setRiskClients] = useState([]);
  const [blacklist, setBlacklist] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddBlacklist, setShowAddBlacklist] = useState(false);
  const [blForm, setBlForm] = useState({ client_name: '', client_phone: '', reason: '' });

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const [riskRes, blRes] = await Promise.all([
        axios.get(`${API}/clients/risk-scores`),
        axios.get(`${API}/clients/blacklist`),
      ]);
      setRiskClients(riskRes.data);
      setBlacklist(blRes.data);
    } catch { toast.error('Error'); }
    finally { setLoading(false); }
  };

  const addToBlacklist = async (e) => {
    e.preventDefault();
    if (!blForm.client_phone) return;
    try {
      await axios.post(`${API}/clients/blacklist`, blForm);
      toast.success(lang === 'fr' ? 'Client ajouté à la blacklist' : 'Client blacklisted');
      setBlForm({ client_name: '', client_phone: '', reason: '' });
      setShowAddBlacklist(false);
      fetchData();
    } catch { toast.error('Error'); }
  };

  const removeFromBlacklist = async (id, name) => {
    if (!window.confirm(lang === 'fr' ? `Retirer ${name} de la blacklist ?` : `Remove ${name} from blacklist?`)) return;
    try {
      await axios.delete(`${API}/clients/blacklist/${id}`);
      toast.success(lang === 'fr' ? 'Retiré de la blacklist' : 'Removed from blacklist');
      fetchData();
    } catch { toast.error('Error'); }
  };

  const addClientToBlacklist = async (client) => {
    try {
      await axios.post(`${API}/clients/blacklist`, {
        client_name: client.client_name,
        client_phone: client.phone,
        reason: lang === 'fr' ? 'No-shows répétés' : 'Repeated no-shows',
        no_show_count: client.no_shows,
      });
      toast.success(lang === 'fr' ? 'Client blacklisté' : 'Client blacklisted');
      fetchData();
    } catch { toast.error('Error'); }
  };

  const riskColor = (level) => {
    if (level === 'high') return 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30';
    if (level === 'medium') return 'text-orange-600 dark:text-orange-400 bg-orange-100 dark:bg-orange-900/30';
    return 'text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30';
  };

  const riskLabel = (level) => {
    const labels = { high: { fr: 'Haut', en: 'High' }, medium: { fr: 'Moyen', en: 'Medium' }, low: { fr: 'Faible', en: 'Low' } };
    return lang === 'fr' ? labels[level]?.fr : labels[level]?.en;
  };

  const isBlacklisted = (phone) => blacklist.some(b => b.client_phone === phone);

  return (
    <BusinessLayout>
      <div className="mb-5">
        <h1 className="text-2xl font-heading font-800">
          {lang === 'fr' ? 'Gestion des clients' : 'Client Management'}
        </h1>
        <p className="text-sm text-muted-foreground">
          {lang === 'fr' ? 'Score de risque et blacklist clients' : 'Risk scoring and client blacklist'}
        </p>
      </div>

      <Tabs defaultValue="risk">
        <TabsList className="rounded-xl mb-5 h-10">
          <TabsTrigger value="risk" className="rounded-lg text-sm font-heading font-600">
            <AlertTriangle className="w-3.5 h-3.5 mr-1.5" />
            {lang === 'fr' ? `Score risque (${riskClients.length})` : `Risk Score (${riskClients.length})`}
          </TabsTrigger>
          <TabsTrigger value="blacklist" className="rounded-lg text-sm font-heading font-600">
            <UserX className="w-3.5 h-3.5 mr-1.5" />
            {lang === 'fr' ? `Blacklist (${blacklist.length})` : `Blacklist (${blacklist.length})`}
          </TabsTrigger>
        </TabsList>

        {/* Risk scores */}
        <TabsContent value="risk">
          <div className="mb-4 p-4 bg-muted/50 rounded-xl border border-border/50 text-sm text-muted-foreground">
            {lang === 'fr'
              ? 'Les clients avec un taux d\'absence ≥50% sont à haut risque. ≥25% = risque moyen.'
              : 'Clients with no-show rate ≥50% are high risk. ≥25% = medium risk.'}
          </div>

          {loading ? (
            <div className="flex justify-center h-32 items-center">
              <div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : riskClients.length === 0 ? (
            <div className="bg-card rounded-xl border border-border/50 p-12 text-center">
              <Shield className="w-10 h-10 text-primary mx-auto mb-3" />
              <p className="font-heading font-700 text-sm">{lang === 'fr' ? 'Aucun client à risque !' : 'No at-risk clients!'}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {riskClients.map((client, i) => (
                <div key={i} className="bg-card rounded-xl border border-border/50 p-4" data-testid="risk-client-row">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-muted rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="font-heading font-700 text-sm">{client.client_name?.charAt(0) || '?'}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-heading font-700 text-sm">{client.client_name || lang === 'fr' ? 'Inconnu' : 'Unknown'}</p>
                      <p className="text-xs text-muted-foreground">{client.phone}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <span className={cn("text-xs font-heading font-700 px-2 py-0.5 rounded-full", riskColor(client.risk_level))}>
                        {riskLabel(client.risk_level)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground pl-[52px]">
                    <span>{client.total_appointments} {lang === 'fr' ? 'RDV' : 'appts'}</span>
                    <span className="text-accent font-heading font-600">{client.no_shows} {lang === 'fr' ? 'absences' : 'no-shows'}</span>
                    <span>{client.no_show_rate}% {lang === 'fr' ? 'taux' : 'rate'}</span>
                  </div>
                  {/* Progress bar */}
                  <div className="mt-2 pl-[52px]">
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{
                        width: `${Math.min(client.no_show_rate, 100)}%`,
                        background: client.risk_level === 'high' ? '#ef4444' : client.risk_level === 'medium' ? '#ea580c' : '#15803d'
                      }} />
                    </div>
                  </div>
                  {client.risk_level !== 'low' && !isBlacklisted(client.phone) && (
                    <div className="mt-2 pl-[52px]">
                      <button
                        onClick={() => addClientToBlacklist(client)}
                        className="text-xs text-accent font-heading font-600 hover:underline"
                        data-testid="blacklist-from-risk-btn"
                      >
                        {lang === 'fr' ? '+ Ajouter à la blacklist' : '+ Add to blacklist'}
                      </button>
                    </div>
                  )}
                  {isBlacklisted(client.phone) && (
                    <div className="mt-2 pl-[52px]">
                      <span className="text-xs text-red-500 font-heading font-600">{lang === 'fr' ? 'Déjà blacklisté' : 'Already blacklisted'}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Blacklist */}
        <TabsContent value="blacklist">
          <div className="flex justify-between items-center mb-4">
            <p className="text-sm text-muted-foreground">
              {lang === 'fr' ? 'Clients bannis de votre établissement' : 'Banned clients from your business'}
            </p>
            <Button size="sm" onClick={() => setShowAddBlacklist(p => !p)} className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90 h-8 px-3 text-xs font-heading font-700" data-testid="add-blacklist-btn">
              <Plus className="w-3 h-3 mr-1" /> {lang === 'fr' ? 'Ajouter' : 'Add'}
            </Button>
          </div>

          {showAddBlacklist && (
            <form onSubmit={addToBlacklist} className="bg-card rounded-xl border border-border/50 p-4 mb-4 space-y-3" data-testid="blacklist-form">
              <Input value={blForm.client_name} onChange={e => setBlForm(p => ({ ...p, client_name: e.target.value }))} placeholder={lang === 'fr' ? 'Nom du client' : 'Client name'} className="h-10 rounded-xl text-sm" />
              <Input value={blForm.client_phone} onChange={e => setBlForm(p => ({ ...p, client_phone: e.target.value }))} placeholder={lang === 'fr' ? 'Téléphone *' : 'Phone *'} className="h-10 rounded-xl text-sm" required />
              <Input value={blForm.reason} onChange={e => setBlForm(p => ({ ...p, reason: e.target.value }))} placeholder={lang === 'fr' ? 'Raison' : 'Reason'} className="h-10 rounded-xl text-sm" />
              <Button type="submit" className="w-full rounded-full bg-primary text-primary-foreground hover:bg-primary/90 h-9 text-sm font-heading font-700" data-testid="blacklist-submit-btn">
                {lang === 'fr' ? 'Blacklister' : 'Blacklist'}
              </Button>
            </form>
          )}

          {loading ? (
            <div className="flex justify-center h-32 items-center">
              <div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : blacklist.length === 0 ? (
            <div className="bg-card rounded-xl border border-border/50 p-12 text-center">
              <UserX className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="font-heading font-700 text-sm">{lang === 'fr' ? 'Aucun client blacklisté' : 'No blacklisted clients'}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {blacklist.map(entry => (
                <div key={entry.id} className="bg-card rounded-xl border border-destructive/20 p-4 flex items-center gap-3" data-testid="blacklist-row">
                  <div className="w-10 h-10 bg-destructive/10 rounded-full flex items-center justify-center flex-shrink-0">
                    <UserX className="w-4 h-4 text-destructive" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-heading font-700 text-sm">{entry.client_name || lang === 'fr' ? 'Inconnu' : 'Unknown'}</p>
                    <p className="text-xs text-muted-foreground">{entry.client_phone}</p>
                    {entry.reason && <p className="text-xs text-accent">{entry.reason}</p>}
                  </div>
                  <button onClick={() => removeFromBlacklist(entry.id, entry.client_name)} className="p-1.5 rounded-full hover:bg-destructive/10 text-muted-foreground hover:text-destructive" data-testid="remove-blacklist-btn">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </BusinessLayout>
  );
}
