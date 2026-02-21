import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { TrendingDown, TrendingUp, Bell, Building2 } from 'lucide-react';
import AdminLayout from '../../components/AdminLayout';
import { useLang } from '../../context/LangContext';
import axios from 'axios';
import { API } from '../../context/AuthContext';
import { toast } from 'sonner';

export default function AdminStats() {
  const { lang } = useLang();
  const [stats, setStats] = useState(null);
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const [statsRes, dashRes] = await Promise.all([
        axios.get(`${API}/admin/stats`),
        axios.get(`${API}/admin/dashboard`),
      ]);
      setStats(statsRes.data);
      setDashboard(dashRes.data);
    } catch { toast.error('Error'); }
    finally { setLoading(false); }
  };

  return (
    <AdminLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-heading font-800">{lang === 'fr' ? 'Statistiques' : 'Analytics'}</h1>
        <p className="text-sm text-muted-foreground">{lang === 'fr' ? 'Vue analytique globale de la plateforme' : 'Platform-wide analytics overview'}</p>
      </div>

      {loading ? (
        <div className="flex justify-center h-64 items-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-5">
          {/* Global KPIs */}
          {dashboard && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: lang === 'fr' ? 'Entreprises actives' : 'Active businesses', value: dashboard.active_businesses, icon: Building2, color: 'text-primary' },
                { label: 'MRR', value: `${dashboard.mrr}€`, icon: TrendingUp, color: 'text-primary' },
                { label: lang === 'fr' ? 'Total RDV' : 'Total Appts', value: dashboard.total_appointments, icon: TrendingDown, color: 'text-blue-600 dark:text-blue-400' },
                { label: lang === 'fr' ? 'Taux no-show' : 'No-show Rate', value: `${dashboard.no_show_rate}%`, icon: TrendingDown, color: dashboard.no_show_rate > 25 ? 'text-accent' : 'text-primary' },
              ].map((k, i) => (
                <div key={i} className="bg-card rounded-2xl p-4 border border-border/50 card-shadow">
                  <div className={`text-xl font-heading font-800 ${k.color}`}>{k.value}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{k.label}</div>
                </div>
              ))}
            </div>
          )}

          {/* Signup chart */}
          <div className="bg-card rounded-2xl border border-border/50 p-5 card-shadow">
            <h2 className="font-heading font-700 text-sm mb-4">
              {lang === 'fr' ? 'Nouvelles inscriptions / mois' : 'New signups per month'}
            </h2>
            {stats?.monthly_signups?.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={stats.monthly_signups} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="_id" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                  <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} allowDecimals={false} />
                  <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '12px' }} />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} name={lang === 'fr' ? 'Inscriptions' : 'Signups'} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-sm text-muted-foreground">
                {lang === 'fr' ? 'Données insuffisantes' : 'Insufficient data'}
              </div>
            )}
          </div>

          {/* Notification stats */}
          {stats?.notifications && (
            <div className="bg-card rounded-2xl border border-border/50 p-5 card-shadow">
              <h2 className="font-heading font-700 text-sm mb-4">
                <Bell className="w-4 h-4 inline mr-2 text-muted-foreground" />
                {lang === 'fr' ? 'Notifications' : 'Notifications'}
              </h2>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-heading font-800 text-foreground">{stats.notifications.total}</div>
                  <div className="text-xs text-muted-foreground">{lang === 'fr' ? 'Total' : 'Total'}</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-heading font-800 text-primary">{stats.notifications.sent}</div>
                  <div className="text-xs text-muted-foreground">{lang === 'fr' ? 'Envoyées' : 'Sent'}</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-heading font-800 text-destructive">{stats.notifications.failed}</div>
                  <div className="text-xs text-muted-foreground">{lang === 'fr' ? 'Échouées' : 'Failed'}</div>
                </div>
              </div>
              <div className="mt-3 h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full"
                  style={{ width: stats.notifications.total > 0 ? `${stats.notifications.sent / stats.notifications.total * 100}%` : '0%' }}
                />
              </div>
              <p className="text-xs text-muted-foreground text-right mt-1">
                {stats.notifications.total > 0 ? Math.round(stats.notifications.sent / stats.notifications.total * 100) : 0}% {lang === 'fr' ? 'taux de succès' : 'success rate'}
              </p>
            </div>
          )}
        </div>
      )}
    </AdminLayout>
  );
}
