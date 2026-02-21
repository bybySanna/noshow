import React, { useState, useEffect } from 'react';
import { Building2, X, ChevronDown, ChevronUp, Search, ToggleLeft, ToggleRight, Eye, Mail } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import AdminLayout from '../../components/AdminLayout';
import { useLang } from '../../context/LangContext';
import axios from 'axios';
import { API } from '../../context/AuthContext';
import { toast } from 'sonner';
import { cn } from '../../lib/utils';

const PLAN_LABELS = { free_trial: 'Trial', solo: 'Solo', pro: 'Pro', business: 'Business' };
const PLAN_COLORS = {
  free_trial: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  solo: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  pro: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  business: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
};

export default function AdminBusinesses() {
  const { lang } = useLang();
  const [businesses, setBusinesses] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedBiz, setSelectedBiz] = useState(null);
  const [bizDetails, setBizDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [search, setSearch] = useState('');
  const [expandedAppts, setExpandedAppts] = useState(false);
  const [messageText, setMessageText] = useState('');

  useEffect(() => { fetchBusinesses(); }, []);

  useEffect(() => {
    if (!search) { setFiltered(businesses); return; }
    const q = search.toLowerCase();
    setFiltered(businesses.filter(b =>
      b.name?.toLowerCase().includes(q) ||
      b.owner?.email?.toLowerCase().includes(q) ||
      b.business_type?.toLowerCase().includes(q)
    ));
  }, [search, businesses]);

  const fetchBusinesses = async () => {
    try {
      const res = await axios.get(`${API}/admin/businesses`);
      setBusinesses(res.data);
      setFiltered(res.data);
    } catch { toast.error('Error'); }
    finally { setLoading(false); }
  };

  const openDetails = async (biz) => {
    setSelectedBiz(biz);
    setLoadingDetails(true);
    try {
      const res = await axios.get(`${API}/admin/business/${biz.id}/details`);
      setBizDetails(res.data);
    } catch { toast.error('Error loading details'); }
    finally { setLoadingDetails(false); }
  };

  const toggleBiz = async (id, currentStatus) => {
    try {
      const res = await axios.put(`${API}/admin/businesses/${id}/toggle`);
      toast.success(res.data.is_active
        ? (lang === 'fr' ? 'Entreprise activée' : 'Business activated')
        : (lang === 'fr' ? 'Entreprise suspendue' : 'Business suspended'));
      fetchBusinesses();
      if (selectedBiz?.id === id) setSelectedBiz(b => ({ ...b, is_active: res.data.is_active }));
    } catch { toast.error('Error'); }
  };

  const updatePlan = async (id, plan) => {
    try {
      await axios.put(`${API}/admin/businesses/${id}/subscription`, { plan, status: 'active' });
      toast.success(lang === 'fr' ? 'Plan mis à jour' : 'Plan updated');
      fetchBusinesses();
    } catch { toast.error('Error'); }
  };

  const sendMessage = async (bizId) => {
    if (!messageText.trim()) return;
    try {
      await axios.post(`${API}/admin/businesses/${bizId}/message`, { message: messageText });
      toast.success(lang === 'fr' ? 'Message envoyé' : 'Message sent');
      setMessageText('');
    } catch { toast.error('Error'); }
  };

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-heading font-800">{lang === 'fr' ? 'Entreprises' : 'Businesses'}</h1>
          <p className="text-sm text-muted-foreground">{filtered.length} {lang === 'fr' ? 'entreprises' : 'businesses'}</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder={lang === 'fr' ? 'Rechercher par nom, email...' : 'Search by name, email...'} className="pl-9 h-10 rounded-xl" data-testid="admin-search-biz" />
      </div>

      {loading ? (
        <div className="flex justify-center h-64 items-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(biz => (
            <div key={biz.id} className="bg-card rounded-xl border border-border/50 p-4 hover:border-primary/20 transition-all" data-testid="admin-business-row">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${biz.is_active ? 'bg-primary/10' : 'bg-red-100 dark:bg-red-900/20'}`}>
                  <Building2 className={`w-5 h-5 ${biz.is_active ? 'text-primary' : 'text-red-500'}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-heading font-700 text-sm">{biz.name}</p>
                    {!biz.is_active && (
                      <span className="text-[10px] bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 px-1.5 py-0.5 rounded-full font-heading font-700">
                        {lang === 'fr' ? 'Suspendu' : 'Suspended'}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{biz.owner?.email} • {biz.business_type}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={cn("text-[11px] font-heading font-700 px-2 py-0.5 rounded-full", PLAN_COLORS[biz.subscription?.plan] || PLAN_COLORS.free_trial)}>
                    {PLAN_LABELS[biz.subscription?.plan] || 'Trial'}
                  </span>
                  <span className="text-xs font-mono text-muted-foreground">{biz.appointment_count} rdv</span>
                  <button onClick={() => openDetails(biz)} className="p-1.5 rounded-full hover:bg-muted transition-colors" data-testid="view-biz-details-btn">
                    <Eye className="w-4 h-4 text-muted-foreground" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Business details modal */}
      {selectedBiz && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 overflow-y-auto" onClick={() => { setSelectedBiz(null); setBizDetails(null); }}>
          <div className="bg-card rounded-2xl w-full max-w-xl border border-border my-4" onClick={e => e.stopPropagation()} data-testid="admin-biz-detail-modal">
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-border/50">
              <div>
                <h3 className="font-heading font-800 text-lg">{selectedBiz.name}</h3>
                <p className="text-xs text-muted-foreground">{selectedBiz.business_type} • {selectedBiz.owner?.email}</p>
              </div>
              <button onClick={() => { setSelectedBiz(null); setBizDetails(null); }} className="p-1.5 rounded-full hover:bg-muted">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-5">
              {loadingDetails ? (
                <div className="flex justify-center py-8"><div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
              ) : bizDetails ? (
                <>
                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: lang === 'fr' ? 'Total RDV' : 'Total Appts', val: bizDetails.stats.total_appointments, color: 'text-primary' },
                      { label: lang === 'fr' ? 'No-shows' : 'No-shows', val: bizDetails.stats.no_shows, color: 'text-accent' },
                      { label: lang === 'fr' ? 'Taux absence' : 'No-show Rate', val: `${bizDetails.stats.no_show_rate}%`, color: bizDetails.stats.no_show_rate > 25 ? 'text-accent' : 'text-primary' },
                    ].map((s, i) => (
                      <div key={i} className="bg-muted/50 rounded-xl p-3 text-center">
                        <div className={`text-xl font-heading font-800 ${s.color}`}>{s.val}</div>
                        <div className="text-xs text-muted-foreground">{s.label}</div>
                      </div>
                    ))}
                  </div>

                  {/* Plan management */}
                  <div>
                    <p className="text-xs font-heading font-700 text-muted-foreground mb-2">{lang === 'fr' ? 'Changer le plan :' : 'Change plan:'}</p>
                    <div className="flex gap-2 flex-wrap">
                      {['free_trial', 'solo', 'pro', 'business'].map(plan => (
                        <button key={plan} onClick={() => updatePlan(selectedBiz.id, plan)}
                          className={cn("text-xs font-heading font-700 px-3 py-1.5 rounded-full border transition-all",
                            selectedBiz.subscription?.plan === plan ? "bg-primary text-primary-foreground border-primary" : "border-border hover:border-primary hover:text-primary"
                          )} data-testid={`plan-btn-${plan}`}>{PLAN_LABELS[plan]}</button>
                      ))}
                    </div>
                  </div>

                  {/* Staff list */}
                  {bizDetails.staff?.length > 0 && (
                    <div>
                      <p className="text-xs font-heading font-700 text-muted-foreground mb-2">{lang === 'fr' ? `Staff (${bizDetails.staff.length})` : `Staff (${bizDetails.staff.length})`}</p>
                      <div className="space-y-1">
                        {bizDetails.staff.map(s => (
                          <div key={s.id} className="flex items-center gap-2 text-sm py-1">
                            <div className="w-6 h-6 bg-primary/10 rounded-full flex items-center justify-center">
                              <span className="text-[10px] font-heading font-700 text-primary">{s.full_name?.charAt(0)}</span>
                            </div>
                            <span className="font-heading font-600">{s.full_name}</span>
                            <span className="text-muted-foreground text-xs">{s.email}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Recent appointments */}
                  <div>
                    <button
                      className="flex items-center justify-between w-full text-xs font-heading font-700 text-muted-foreground mb-2"
                      onClick={() => setExpandedAppts(p => !p)}
                    >
                      {lang === 'fr' ? `RDV récents (${bizDetails.recent_appointments?.length || 0})` : `Recent Appts (${bizDetails.recent_appointments?.length || 0})`}
                      {expandedAppts ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>
                    {expandedAppts && (
                      <div className="space-y-1 max-h-40 overflow-y-auto">
                        {(bizDetails.recent_appointments || []).map((a, i) => (
                          <div key={i} className="flex items-center justify-between text-xs py-1 border-b border-border/30">
                            <span className="font-heading font-600">{a.client_name}</span>
                            <span className="text-muted-foreground">{a.date} {a.time}</span>
                            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-heading font-700 status-${a.status}`}>{a.status}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Message */}
                  <div>
                    <p className="text-xs font-heading font-700 text-muted-foreground mb-2">{lang === 'fr' ? 'Envoyer un message :' : 'Send message:'}</p>
                    <div className="flex gap-2">
                      <Input value={messageText} onChange={e => setMessageText(e.target.value)} placeholder={lang === 'fr' ? 'Message à l\'entreprise...' : 'Message to business...'} className="h-9 rounded-xl text-sm flex-1" data-testid="admin-message-input" />
                      <Button size="sm" onClick={() => sendMessage(selectedBiz.id)} className="rounded-xl bg-primary text-primary-foreground h-9 px-3" data-testid="admin-send-message-btn">
                        <Mail className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </>
              ) : null}

              {/* Toggle active */}
              <Button
                variant="outline"
                className={cn("w-full rounded-full font-heading font-700 h-10", selectedBiz.is_active ? "border-destructive text-destructive hover:bg-destructive/10" : "border-primary text-primary hover:bg-primary/10")}
                onClick={() => toggleBiz(selectedBiz.id, selectedBiz.is_active)}
                data-testid="toggle-business-btn"
              >
                {selectedBiz.is_active
                  ? (lang === 'fr' ? 'Suspendre cette entreprise' : 'Suspend this business')
                  : (lang === 'fr' ? 'Réactiver cette entreprise' : 'Reactivate this business')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
