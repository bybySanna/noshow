import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { TrendingDown, TrendingUp, Calendar, Users, DollarSign, AlertTriangle } from 'lucide-react';
import BusinessLayout from '../../components/BusinessLayout';
import { useLang } from '../../context/LangContext';
import axios from 'axios';
import { API } from '../../context/AuthContext';
import { toast } from 'sonner';

const COLORS = ['#15803d', '#22c55e', '#ea580c', '#ef4444', '#3b82f6', '#8b5cf6'];

export default function AnalyticsPage() {
  const { lang } = useLang();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const res = await axios.get(`${API}/stats/business`);
      setStats(res.data);
    } catch {
      toast.error('Error loading stats');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return (
    <BusinessLayout>
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    </BusinessLayout>
  );

  const pieData = stats ? [
    { name: lang === 'fr' ? 'Confirmés' : 'Confirmed', value: stats.confirmed, color: '#15803d' },
    { name: lang === 'fr' ? 'En attente' : 'Pending', value: stats.pending, color: '#f59e0b' },
    { name: lang === 'fr' ? 'Absents' : 'No Shows', value: stats.no_show, color: '#ea580c' },
    { name: lang === 'fr' ? 'Annulés' : 'Cancelled', value: stats.cancelled, color: '#ef4444' },
    { name: lang === 'fr' ? 'Terminés' : 'Completed', value: stats.completed, color: '#3b82f6' },
  ].filter(d => d.value > 0) : [];

  const barData = stats ? [
    { name: lang === 'fr' ? 'Confirmés' : 'Confirmed', value: stats.confirmed, fill: '#15803d' },
    { name: lang === 'fr' ? 'En attente' : 'Pending', value: stats.pending, fill: '#f59e0b' },
    { name: lang === 'fr' ? 'Absents' : 'No Shows', value: stats.no_show, fill: '#ea580c' },
    { name: lang === 'fr' ? 'Annulés' : 'Cancelled', value: stats.cancelled, fill: '#ef4444' },
    { name: lang === 'fr' ? 'Terminés' : 'Completed', value: stats.completed, fill: '#3b82f6' },
  ] : [];

  const kpis = stats ? [
    {
      label: lang === 'fr' ? 'Total RDV' : 'Total Appts',
      value: stats.total,
      icon: Calendar,
      color: 'text-primary',
      bg: 'bg-primary/10',
    },
    {
      label: lang === 'fr' ? 'Cette semaine' : 'This Week',
      value: stats.this_week,
      icon: TrendingUp,
      color: 'text-blue-600 dark:text-blue-400',
      bg: 'bg-blue-100 dark:bg-blue-900/20',
    },
    {
      label: lang === 'fr' ? 'Taux absence' : 'No-show Rate',
      value: `${stats.no_show_rate}%`,
      icon: TrendingDown,
      color: stats.no_show_rate > 20 ? 'text-accent' : 'text-primary',
      bg: stats.no_show_rate > 20 ? 'bg-orange-100 dark:bg-orange-900/20' : 'bg-primary/10',
    },
    {
      label: lang === 'fr' ? 'Argent récupéré' : 'Revenue Saved',
      value: `${stats.money_saved_estimate}€`,
      icon: DollarSign,
      color: 'text-primary',
      bg: 'bg-primary/10',
    },
  ] : [];

  return (
    <BusinessLayout>
      <h1 className="text-2xl font-heading font-800 mb-6">
        {lang === 'fr' ? 'Statistiques' : 'Analytics'}
      </h1>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {kpis.map((kpi, i) => (
          <div key={i} className="bg-card rounded-2xl p-4 border border-border/50 card-shadow" data-testid={`kpi-${i}`}>
            <div className={`w-9 h-9 ${kpi.bg} rounded-xl flex items-center justify-center mb-3`}>
              <kpi.icon style={{width: '18px', height: '18px'}} className={kpi.color} />
            </div>
            <div className={`text-2xl font-heading font-800 ${kpi.color}`}>{kpi.value}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{kpi.label}</div>
          </div>
        ))}
      </div>

      {/* No-show risk */}
      {stats?.high_risk_clients > 0 && (
        <div className="flex items-center gap-3 p-4 bg-accent/10 border border-accent/20 rounded-xl mb-6">
          <AlertTriangle className="w-5 h-5 text-accent" />
          <div>
            <p className="text-sm font-heading font-700 text-accent">
              {stats.high_risk_clients} {lang === 'fr' ? 'client(s) à risque élevé' : 'high-risk client(s)'}
            </p>
            <p className="text-xs text-muted-foreground">
              {lang === 'fr' ? 'Ces clients ont déjà été absents' : 'These clients have been no-shows before'}
            </p>
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-5">
        {/* Bar chart */}
        <div className="bg-card rounded-2xl p-5 border border-border/50 card-shadow">
          <h2 className="font-heading font-700 text-base mb-4">
            {lang === 'fr' ? 'Répartition des RDV' : 'Appointment Breakdown'}
          </h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={barData} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
              <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
              <Tooltip
                contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '12px' }}
                labelStyle={{ color: 'hsl(var(--foreground))' }}
              />
              <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                {barData.map((entry, index) => (
                  <Cell key={index} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Pie chart */}
        <div className="bg-card rounded-2xl p-5 border border-border/50 card-shadow">
          <h2 className="font-heading font-700 text-base mb-4">
            {lang === 'fr' ? 'Taux de confirmation' : 'Confirmation Rate'}
          </h2>
          {pieData.length > 0 ? (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width={140} height={140}>
                <PieChart>
                  <Pie data={pieData} cx={65} cy={65} innerRadius={40} outerRadius={65} paddingAngle={3} dataKey="value">
                    {pieData.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-2">
                {pieData.map((item, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: item.color }} />
                    <span className="text-xs text-muted-foreground">{item.name}</span>
                    <span className="text-xs font-mono font-500 ml-auto">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="h-[140px] flex items-center justify-center text-muted-foreground text-sm">
              {lang === 'fr' ? 'Aucune donnée' : 'No data'}
            </div>
          )}
        </div>
      </div>

      {/* Money saved callout */}
      <div className="mt-5 bg-primary/5 border border-primary/20 rounded-2xl p-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <p className="font-heading font-800 text-xl text-primary">{stats?.money_saved_estimate}€</p>
            <p className="text-sm text-muted-foreground">
              {lang === 'fr' ? 'de chiffre d\'affaires potentiellement récupéré grâce à NoShowGone' : 'of potential revenue recovered with NoShowGone'}
            </p>
          </div>
        </div>
      </div>
    </BusinessLayout>
  );
}
