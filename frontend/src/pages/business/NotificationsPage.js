import React, { useState, useEffect } from 'react';
import { Bell, Mail, MessageCircle, Phone, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import { Button } from '../../components/ui/button';
import BusinessLayout from '../../components/BusinessLayout';
import { useLang } from '../../context/LangContext';
import axios from 'axios';
import { API } from '../../context/AuthContext';
import { toast } from 'sonner';
import { cn } from '../../lib/utils';

export default function NotificationsPage() {
  const { lang } = useLang();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchNotifications(); }, []);

  const fetchNotifications = async () => {
    try {
      const res = await axios.get(`${API}/notifications`);
      setNotifications(res.data);
    } catch {
      toast.error('Error');
    } finally {
      setLoading(false);
    }
  };

  const retry = async (id) => {
    try {
      await axios.post(`${API}/notifications/${id}/retry`);
      toast.success(lang === 'fr' ? 'Notification renvoyée' : 'Notification retried');
      fetchNotifications();
    } catch {
      toast.error('Error');
    }
  };

  const channelIcon = (channel) => {
    switch (channel) {
      case 'email': return <Mail className="w-4 h-4" />;
      case 'whatsapp': return <MessageCircle className="w-4 h-4 text-green-500" />;
      case 'sms': return <Phone className="w-4 h-4 text-blue-500" />;
      default: return <Bell className="w-4 h-4" />;
    }
  };

  const statusIcon = (status) => {
    switch (status) {
      case 'sent': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'failed': return <XCircle className="w-4 h-4 text-destructive" />;
      case 'retrying': return <RefreshCw className="w-4 h-4 text-yellow-500 animate-spin" />;
      default: return <Bell className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const typeLabel = (type) => {
    const types = {
      confirmation_request: { fr: 'Confirmation envoyée', en: 'Confirmation sent' },
      reminder_24h: { fr: 'Rappel 24h', en: '24h reminder' },
      reminder_3h: { fr: 'Rappel 3h', en: '3h reminder' },
      reminder_30min: { fr: 'Rappel 30min', en: '30min reminder' },
      manual_reminder: { fr: 'Rappel manuel', en: 'Manual reminder' },
    };
    const t = types[type];
    return t ? (lang === 'fr' ? t.fr : t.en) : type;
  };

  return (
    <BusinessLayout>
      <h1 className="text-2xl font-heading font-800 mb-2">
        {lang === 'fr' ? 'Notifications' : 'Notifications'}
      </h1>
      <p className="text-sm text-muted-foreground mb-6">
        {lang === 'fr' ? 'Historique de toutes les notifications envoyées' : 'History of all sent notifications'}
      </p>

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { label: lang === 'fr' ? 'Total' : 'Total', val: notifications.length, color: 'text-foreground' },
          { label: lang === 'fr' ? 'Envoyés' : 'Sent', val: notifications.filter(n => n.status === 'sent').length, color: 'text-primary' },
          { label: lang === 'fr' ? 'Échoués' : 'Failed', val: notifications.filter(n => n.status === 'failed').length, color: 'text-destructive' },
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
      ) : notifications.length === 0 ? (
        <div className="bg-card rounded-xl border border-border/50 p-12 text-center">
          <Bell className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm font-heading font-700">
            {lang === 'fr' ? 'Aucune notification pour l\'instant' : 'No notifications yet'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map(n => (
            <div key={n.id} className="bg-card rounded-xl border border-border/50 p-4 flex items-center gap-3" data-testid="notification-row">
              <div className="flex-shrink-0">{channelIcon(n.channel)}</div>
              <div className="flex-1 min-w-0">
                <p className="font-heading font-600 text-sm">{typeLabel(n.type)}</p>
                <p className="text-xs text-muted-foreground truncate">{n.recipient}</p>
                {n.sent_at && (
                  <p className="text-[10px] text-muted-foreground mt-0.5 font-mono">
                    {new Date(n.sent_at).toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-US')}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                {statusIcon(n.status)}
                {n.status === 'failed' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 rounded-lg text-xs"
                    onClick={() => retry(n.id)}
                    data-testid="retry-notification-btn"
                  >
                    <RefreshCw className="w-3 h-3 mr-1" />
                    {lang === 'fr' ? 'Retry' : 'Retry'}
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </BusinessLayout>
  );
}
