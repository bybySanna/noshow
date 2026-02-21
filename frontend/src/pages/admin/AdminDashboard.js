import React, { useState, useEffect } from 'react';
import { Building2, Calendar, TrendingDown, DollarSign, Users, Activity, ArrowUpRight, ArrowDownRight, Bell, AlertTriangle, CheckCircle, Zap, Send, Server, RefreshCw } from 'lucide-react';
import AdminLayout from '../../components/AdminLayout';
import { useLang } from '../../context/LangContext';
import { Button } from '../../components/ui/button';
import axios from 'axios';
import { API } from '../../context/AuthContext';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';

export default function AdminDashboard() {
  const { lang } = useLang();
  const [stats, setStats] = useState(null);
  const [chartData, setChartData] = useState([]);
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [systemHealth, setSystemHealth] = useState(null);
  const [showBroadcast, setShowBroadcast] = useState(false);
  const [broadcastMsg, setBroadcastMsg] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const [statsRes, chartRes, actRes, healthRes] = await Promise.all([
        axios.get(`${API}/admin/dashboard`),
        axios.get(`${API}/admin/stats`),
        axios.get(`${API}/admin/activity?limit=5`),
        axios.get(`${API}/admin/system-health`),
      ]);
      setStats(statsRes.data);
      setChartData(chartRes.data.monthly_signups || []);
      setActivity(actRes.data);
      setSystemHealth(healthRes.data);
    } catch (err) {
      toast.error('Erreur chargement stats admin');
    } finally {
      setLoading(false);
    }
  };

  const sendBroadcast = async () => {
    if (!broadcastMsg.trim()) return;
    setSending(true);
    try {
      await axios.post(`${API}/admin/broadcast`, { message: broadcastMsg, subject: 'Message de NoShowGone' });
      toast.success(lang === 'fr' ? 'Message envoyé à tous les clients' : 'Broadcast sent to all clients');
      setShowBroadcast(false);
      setBroadcastMsg('');
    } catch {
      toast.error('Erreur');
    } finally {
      setSending(false);
    }
  };

  const STATUS_COLORS = {
    confirmed: 'status-confirmed', pending: 'status-pending',
    no_show: 'status-no_show', cancelled: 'status-cancelled',
    completed: 'status-completed',
  };

  const kpis = stats ? [
    {
      label: lang === 'fr' ? 'Entreprises' : 'Businesses',
      value: stats.total_businesses,
      sub: `${stats.active_businesses} ${lang === 'fr' ? 'actives' : 'active'}`,
      icon: Building2, color: 'text-primary', bg: 'bg-primary/10', trend: 'up'
    },
    {
      label: lang === 'fr' ? 'RDV totaux' : 'Total Appts',
      value: stats.total_appointments,
      sub: lang === 'fr' ? 'Toutes entreprises' : 'All businesses',
      icon: Calendar, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-100 dark:bg-blue-900/20', trend: 'up'
    },
    {
      label: lang === 'fr' ? 'Taux absence' : 'No-show Rate',
      value: `${stats.no_show_rate}%`,
      sub: `${stats.total_no_shows} ${lang === 'fr' ? 'no-shows' : 'no-shows'}`,
      icon: TrendingDown, color: stats.no_show_rate > 25 ? 'text-accent' : 'text-primary',
      bg: stats.no_show_rate > 25 ? 'bg-orange-100 dark:bg-orange-900/20' : 'bg-primary/10', trend: 'down'
    },
    {
      label: 'MRR',
      value: `${stats.mrr}€`,
      sub: lang === 'fr' ? 'Revenus mensuels' : 'Monthly revenue',
      icon: DollarSign, color: 'text-primary', bg: 'bg-primary/10', trend: 'up'
    },
    {
      label: lang === 'fr' ? 'Utilisateurs' : 'Users',
      value: stats.total_users,
      sub: lang === 'fr' ? 'Total comptes' : 'Total accounts',
      icon: Users, color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-100 dark:bg-purple-900/20', trend: 'up'
    },
  ] : [];

  const subBreakdown = stats?.subscription_breakdown || {};
  const planColors = { free_trial: '#f59e0b', solo: '#3b82f6', pro: '#15803d', business: '#8b5cf6' };
  const planLabels = { free_trial: 'Trial', solo: 'Solo', pro: 'Pro', business: 'Business' };

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-heading font-800">
            {lang === 'fr' ? 'Super Admin' : 'Super Admin'}
          </h1>
          <p className="text-sm text-muted-foreground">
            {lang === 'fr' ? 'Vue globale de la plateforme NoShowGone' : 'NoShowGone platform overview'}
          </p>
        </div>
        <div className="hidden md:flex items-center gap-2 text-xs font-mono text-muted-foreground bg-muted px-3 py-1.5 rounded-full">
          <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
          {lang === 'fr' ? 'Système en ligne' : 'System online'}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center h-64 items-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6 stagger-children">
            {kpis.map((kpi, i) => (
              <div key={i} className="bg-card rounded-2xl p-4 border border-border/50 card-shadow animate-slide-up" data-testid={`admin-kpi-${i}`}>
                <div className="flex items-start justify-between mb-3">
                  <div className={`w-8 h-8 ${kpi.bg} rounded-xl flex items-center justify-center`}>
                    <kpi.icon style={{width: '16px', height: '16px'}} className={kpi.color} />
                  </div>
                  {kpi.trend === 'up'
                    ? <ArrowUpRight className="w-3.5 h-3.5 text-primary" />
                    : <ArrowDownRight className="w-3.5 h-3.5 text-accent" />}
                </div>
                <div className={`text-xl font-heading font-800 ${kpi.color}`}>{kpi.value}</div>
                <div className="text-xs font-heading font-600 text-foreground mt-0.5">{kpi.label}</div>
                <div className="text-[10px] text-muted-foreground">{kpi.sub}</div>
              </div>
            ))}
          </div>

          <div className="grid md:grid-cols-3 gap-5 mb-5">
            {/* Subscription breakdown */}
            <div className="md:col-span-1 bg-card rounded-2xl border border-border/50 p-5 card-shadow">
              <h2 className="font-heading font-700 text-sm mb-4">
                {lang === 'fr' ? 'Abonnements' : 'Subscriptions'}
              </h2>
              <div className="space-y-3">
                {Object.entries(subBreakdown).map(([plan, count]) => {
                  const total = Object.values(subBreakdown).reduce((a, b) => a + b, 0);
                  const pct = total > 0 ? Math.round(count / total * 100) : 0;
                  return (
                    <div key={plan}>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="font-heading font-600">{planLabels[plan]}</span>
                        <span className="font-mono font-500 text-muted-foreground">{count} ({pct}%)</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${pct}%`, background: planColors[plan] }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 pt-3 border-t border-border/50">
                <Link to="/admin/plans" className="text-xs text-primary font-heading font-600 hover:underline">
                  {lang === 'fr' ? 'Gérer les plans →' : 'Manage plans →'}
                </Link>
              </div>
            </div>

            {/* Growth chart */}
            <div className="md:col-span-2 bg-card rounded-2xl border border-border/50 p-5 card-shadow">
              <h2 className="font-heading font-700 text-sm mb-4">
                {lang === 'fr' ? 'Inscriptions entreprises' : 'Business Signups'}
              </h2>
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={150}>
                  <BarChart data={chartData} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="_id" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                    <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                    <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '12px' }} />
                    <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[150px] flex items-center justify-center text-sm text-muted-foreground">
                  {lang === 'fr' ? 'Pas encore de données' : 'No data yet'}
                </div>
              )}
            </div>
          </div>

          {/* Recent Activity */}
          <div className="bg-card rounded-2xl border border-border/50 p-5 card-shadow">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-heading font-700 text-sm">
                {lang === 'fr' ? 'Activité récente' : 'Recent Activity'}
              </h2>
              <Link to="/admin/activity" className="text-xs text-primary font-heading font-600 hover:underline">
                {lang === 'fr' ? 'Tout voir →' : 'See all →'}
              </Link>
            </div>
            <div className="space-y-2">
              {activity.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  {lang === 'fr' ? 'Aucune activité récente' : 'No recent activity'}
                </p>
              ) : activity.map((appt, i) => (
                <div key={i} className="flex items-center gap-3 text-sm py-1.5 border-b border-border/30 last:border-0">
                  <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Calendar className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-heading font-600 text-sm truncate">{appt.client_name}</p>
                    <p className="text-xs text-muted-foreground">{appt.business_name} • {appt.date}</p>
                  </div>
                  <span className={`text-[11px] font-heading font-700 px-2 py-0.5 rounded-full ${STATUS_COLORS[appt.status] || 'status-pending'}`}>
                    {appt.status}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Quick actions */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5">
            {[
              { to: '/admin/businesses', icon: Building2, label_fr: 'Gérer entreprises', label_en: 'Manage businesses', color: 'text-primary', bg: 'bg-primary/10' },
              { to: '/admin/plans', icon: DollarSign, label_fr: 'Modifier plans', label_en: 'Edit plans', color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-100 dark:bg-blue-900/20' },
              { to: '/admin/users', icon: Users, label_fr: 'Utilisateurs', label_en: 'Users', color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-100 dark:bg-purple-900/20' },
              { to: '/admin/activity', icon: Activity, label_fr: 'Voir activité', label_en: 'View activity', color: 'text-accent', bg: 'bg-orange-100 dark:bg-orange-900/20' },
            ].map((item, i) => (
              <Link key={i} to={item.to} className="bg-card rounded-xl border border-border/50 p-4 flex items-center gap-3 hover:border-primary/30 transition-all card-shadow" data-testid={`admin-quick-${i}`}>
                <div className={`w-9 h-9 ${item.bg} rounded-xl flex items-center justify-center flex-shrink-0`}>
                  <item.icon style={{width: '18px', height: '18px'}} className={item.color} />
                </div>
                <span className="text-sm font-heading font-600 leading-tight">{lang === 'fr' ? item.label_fr : item.label_en}</span>
              </Link>
            ))}
          </div>
        </>
      )}
    </AdminLayout>
  );
}
