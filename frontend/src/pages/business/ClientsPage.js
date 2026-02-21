import React, { useState, useEffect } from 'react';
import { Users, Search, Phone, Mail, Calendar, TrendingUp, TrendingDown, ChevronRight, AlertTriangle, Star, Download } from 'lucide-react';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';
import BusinessLayout from '../../components/BusinessLayout';
import { useLang } from '../../context/LangContext';
import axios from 'axios';
import { API } from '../../context/AuthContext';
import { toast } from 'sonner';
import { cn } from '../../lib/utils';

export default function ClientsPage() {
  const { lang } = useLang();
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedClient, setSelectedClient] = useState(null);
  const [clientHistory, setClientHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [sortBy, setSortBy] = useState('total'); // total, reliability, recent

  useEffect(() => { fetchClients(); }, []);

  const fetchClients = async () => {
    try {
      const res = await axios.get(`${API}/clients`);
      setClients(res.data);
    } catch (err) {
      toast.error('Erreur chargement clients');
    } finally {
      setLoading(false);
    }
  };

  const fetchClientHistory = async (phone) => {
    setLoadingHistory(true);
    try {
      const res = await axios.get(`${API}/clients/${encodeURIComponent(phone)}/history`);
      setClientHistory(res.data);
    } catch {
      toast.error('Erreur');
    } finally {
      setLoadingHistory(false);
    }
  };

  const selectClient = (client) => {
    setSelectedClient(client);
    fetchClientHistory(client.phone);
  };

  const filteredClients = clients.filter(c => 
    c.name?.toLowerCase().includes(search.toLowerCase()) ||
    c.phone?.includes(search)
  );

  const sortedClients = [...filteredClients].sort((a, b) => {
    if (sortBy === 'reliability') return a.reliability_score - b.reliability_score;
    if (sortBy === 'recent') return (b.last_appointment || '').localeCompare(a.last_appointment || '');
    return b.total_appointments - a.total_appointments;
  });

  const exportClients = () => {
    const csv = [
      ['Nom', 'Téléphone', 'Email', 'Total RDV', 'Confirmés', 'No-shows', 'Score fiabilité'].join(','),
      ...clients.map(c => [c.name, c.phone, c.email || '', c.total_appointments, c.confirmed, c.no_shows, c.reliability_score].join(','))
    ].join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `clients_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    toast.success(lang === 'fr' ? 'Export téléchargé' : 'Export downloaded');
  };

  const getReliabilityColor = (score) => {
    if (score >= 80) return 'text-green-600 dark:text-green-400';
    if (score >= 50) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-500';
  };

  const getReliabilityBg = (score) => {
    if (score >= 80) return 'bg-green-100 dark:bg-green-900/20';
    if (score >= 50) return 'bg-yellow-100 dark:bg-yellow-900/20';
    return 'bg-red-100 dark:bg-red-900/20';
  };

  return (
    <BusinessLayout>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-heading font-800">
            {lang === 'fr' ? 'Mes Clients' : 'My Clients'}
          </h1>
          <p className="text-sm text-muted-foreground">
            {clients.length} {lang === 'fr' ? 'clients enregistrés' : 'registered clients'}
          </p>
        </div>
        <Button 
          onClick={exportClients}
          variant="outline"
          className="rounded-full h-9 px-4 text-xs font-heading font-700"
          data-testid="export-clients-btn"
        >
          <Download className="w-3.5 h-3.5 mr-1" />
          CSV
        </Button>
      </div>

      {/* Search and filters */}
      <div className="flex gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder={lang === 'fr' ? 'Rechercher un client...' : 'Search client...'}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 h-10 rounded-xl"
            data-testid="search-clients"
          />
        </div>
        <select 
          value={sortBy}
          onChange={e => setSortBy(e.target.value)}
          className="h-10 px-3 rounded-xl border border-border bg-card text-sm font-heading font-600"
        >
          <option value="total">{lang === 'fr' ? 'Plus de RDV' : 'Most appts'}</option>
          <option value="reliability">{lang === 'fr' ? 'À risque' : 'At risk'}</option>
          <option value="recent">{lang === 'fr' ? 'Récents' : 'Recent'}</option>
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center h-64 items-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {/* Client list */}
          <div className="space-y-2">
            {sortedClients.length === 0 ? (
              <div className="bg-card rounded-xl border border-border/50 p-8 text-center">
                <Users className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  {search ? (lang === 'fr' ? 'Aucun résultat' : 'No results') : (lang === 'fr' ? 'Aucun client' : 'No clients')}
                </p>
              </div>
            ) : (
              sortedClients.map(client => (
                <div 
                  key={client.phone}
                  onClick={() => selectClient(client)}
                  className={cn(
                    "bg-card rounded-xl border p-3 flex items-center gap-3 cursor-pointer transition-all hover:border-primary/30",
                    selectedClient?.phone === client.phone ? 'border-primary bg-primary/5' : 'border-border/50'
                  )}
                  data-testid="client-card"
                >
                  <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0", getReliabilityBg(client.reliability_score))}>
                    <span className={cn("font-heading font-800 text-sm", getReliabilityColor(client.reliability_score))}>
                      {Math.round(client.reliability_score)}%
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-heading font-700 text-sm truncate">{client.name || client.phone}</p>
                    <p className="text-xs text-muted-foreground">{client.total_appointments} RDV • {client.no_shows} absences</p>
                  </div>
                  {client.reliability_score < 50 && (
                    <AlertTriangle className="w-4 h-4 text-accent flex-shrink-0" />
                  )}
                  <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                </div>
              ))
            )}
          </div>

          {/* Client detail */}
          <div className="bg-card rounded-2xl border border-border/50 p-5 sticky top-4">
            {selectedClient ? (
              <>
                <div className="flex items-center gap-3 mb-4">
                  <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center", getReliabilityBg(selectedClient.reliability_score))}>
                    <span className={cn("font-heading font-800", getReliabilityColor(selectedClient.reliability_score))}>
                      {Math.round(selectedClient.reliability_score)}%
                    </span>
                  </div>
                  <div>
                    <h2 className="font-heading font-800 text-lg">{selectedClient.name}</h2>
                    <p className="text-xs text-muted-foreground">
                      {lang === 'fr' ? 'Score de fiabilité' : 'Reliability score'}
                    </p>
                  </div>
                </div>

                <div className="space-y-2 mb-4">
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="w-4 h-4 text-muted-foreground" />
                    <span>{selectedClient.phone}</span>
                  </div>
                  {selectedClient.email && (
                    <div className="flex items-center gap-2 text-sm">
                      <Mail className="w-4 h-4 text-muted-foreground" />
                      <span>{selectedClient.email}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    <span>{lang === 'fr' ? 'Dernier RDV:' : 'Last appt:'} {selectedClient.last_appointment || '-'}</span>
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-2 mb-4">
                  <div className="bg-muted/50 rounded-lg p-2 text-center">
                    <div className="text-lg font-heading font-800 text-primary">{selectedClient.total_appointments}</div>
                    <div className="text-[10px] text-muted-foreground">Total</div>
                  </div>
                  <div className="bg-green-100 dark:bg-green-900/20 rounded-lg p-2 text-center">
                    <div className="text-lg font-heading font-800 text-green-600 dark:text-green-400">{selectedClient.confirmed + selectedClient.completed}</div>
                    <div className="text-[10px] text-muted-foreground">{lang === 'fr' ? 'Honorés' : 'Honored'}</div>
                  </div>
                  <div className="bg-red-100 dark:bg-red-900/20 rounded-lg p-2 text-center">
                    <div className="text-lg font-heading font-800 text-red-500">{selectedClient.no_shows}</div>
                    <div className="text-[10px] text-muted-foreground">No-shows</div>
                  </div>
                </div>

                {/* History */}
                <h3 className="font-heading font-700 text-sm mb-2">{lang === 'fr' ? 'Historique' : 'History'}</h3>
                {loadingHistory ? (
                  <div className="flex justify-center py-4">
                    <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : (
                  <div className="space-y-1 max-h-[200px] overflow-y-auto">
                    {clientHistory.map(appt => (
                      <div key={appt.id} className="flex items-center gap-2 text-xs py-1.5 border-b border-border/30 last:border-0">
                        <span className="font-mono text-muted-foreground">{appt.date}</span>
                        <span className="font-heading font-600">{appt.time}</span>
                        <span className={cn(
                          "ml-auto px-1.5 py-0.5 rounded text-[10px] font-heading font-700",
                          appt.status === 'confirmed' || appt.status === 'completed' ? 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400' :
                          appt.status === 'no_show' ? 'bg-red-100 text-red-600 dark:bg-red-900/20' :
                          'bg-muted text-muted-foreground'
                        )}>
                          {appt.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-12">
                <Users className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">
                  {lang === 'fr' ? 'Sélectionnez un client pour voir ses détails' : 'Select a client to view details'}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </BusinessLayout>
  );
}
