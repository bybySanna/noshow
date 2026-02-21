import React, { useState, useEffect } from 'react';
import { Activity, Calendar, Building2, RefreshCw } from 'lucide-react';
import { Button } from '../../components/ui/button';
import AdminLayout from '../../components/AdminLayout';
import { useLang } from '../../context/LangContext';
import axios from 'axios';
import { API } from '../../context/AuthContext';
import { toast } from 'sonner';
import { cn } from '../../lib/utils';

const STATUS_COLORS = {
  confirmed: 'status-confirmed', pending: 'status-pending',
  no_show: 'status-no_show', cancelled: 'status-cancelled',
  completed: 'status-completed', rescheduled: 'status-rescheduled',
};

export default function AdminActivity() {
  const { lang } = useLang();
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [limit, setLimit] = useState(30);

  useEffect(() => { fetchActivity(); }, [limit]);

  const fetchActivity = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/admin/activity?limit=${limit}`);
      setActivity(res.data);
    } catch { toast.error('Error'); }
    finally { setLoading(false); }
  };

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-heading font-800">{lang === 'fr' ? 'Activité globale' : 'Global Activity'}</h1>
          <p className="text-sm text-muted-foreground">
            {lang === 'fr' ? 'Tous les RDV de toutes les entreprises' : 'All appointments across all businesses'}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchActivity} className="rounded-full h-9 px-3" data-testid="refresh-activity-btn">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        {[
          { label: lang === 'fr' ? 'Affichés' : 'Shown', val: activity.length, color: 'text-primary' },
          { label: lang === 'fr' ? 'Confirmés' : 'Confirmed', val: activity.filter(a => a.status === 'confirmed').length, color: 'text-green-600 dark:text-green-400' },
          { label: lang === 'fr' ? 'No-shows' : 'No-shows', val: activity.filter(a => a.status === 'no_show').length, color: 'text-accent' },
        ].map((s, i) => (
          <div key={i} className="bg-card rounded-xl p-3 border border-border/50 text-center">
            <div className={`text-xl font-heading font-800 ${s.color}`}>{s.val}</div>
            <div className="text-xs text-muted-foreground">{s.label}</div>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center h-48 items-center">
          <div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {activity.map((appt, i) => (
              <div key={i} className="bg-card rounded-xl border border-border/50 p-4 flex items-center gap-3" data-testid="admin-activity-row">
                <div className="text-center min-w-[48px]">
                  <div className="font-mono text-sm font-500">{appt.time}</div>
                  <div className="text-[10px] text-muted-foreground">{appt.date?.slice(5)}</div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-heading font-700 text-sm">{appt.client_name}</p>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Building2 className="w-3 h-3" />
                    <span className="truncate">{appt.business_name}</span>
                  </div>
                </div>
                <span className={cn("text-[11px] font-heading font-700 px-2 py-0.5 rounded-full", STATUS_COLORS[appt.status] || 'status-pending')}>
                  {appt.status}
                </span>
              </div>
            ))}
          </div>

          {activity.length >= limit && (
            <div className="text-center mt-4">
              <Button variant="outline" onClick={() => setLimit(l => l + 30)} className="rounded-full h-9 px-5 text-sm font-heading font-600">
                {lang === 'fr' ? 'Charger plus' : 'Load more'}
              </Button>
            </div>
          )}
        </>
      )}
    </AdminLayout>
  );
}
