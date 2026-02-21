import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, Send, Bell, Trash2, Check, CheckCheck, X, Building2 } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { useLang } from '../../context/LangContext';
import BusinessLayout from '../../components/BusinessLayout';
import axios from 'axios';
import { API } from '../../context/AuthContext';
import { toast } from 'sonner';

export default function BusinessMessagesPage() {
  const { lang } = useLang();
  const [messages, setMessages] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [activeTab, setActiveTab] = useState('messages');
  const messagesEndRef = useRef(null);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchData = async () => {
    try {
      const [msgRes, notifRes] = await Promise.all([
        axios.get(`${API}/business/messages`),
        axios.get(`${API}/business/notifications`)
      ]);
      setMessages(msgRes.data);
      setNotifications(notifRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim()) return;
    
    setSending(true);
    try {
      await axios.post(`${API}/business/messages`, { message: newMessage });
      setNewMessage('');
      fetchData();
    } catch (err) {
      toast.error('Erreur');
    } finally {
      setSending(false);
    }
  };

  const markNotificationRead = async (id) => {
    try {
      await axios.put(`${API}/business/notifications/${id}/read`);
      setNotifications(prev => 
        prev.map(n => n.id === id ? { ...n, read: true } : n)
      );
    } catch (err) {
      console.error(err);
    }
  };

  const deleteNotification = async (id) => {
    try {
      await axios.delete(`${API}/business/notifications/${id}`);
      setNotifications(prev => prev.filter(n => n.id !== id));
      toast.success(lang === 'fr' ? 'Notification supprimée' : 'Notification deleted');
    } catch (err) {
      toast.error('Erreur');
    }
  };

  const clearAllNotifications = async () => {
    if (!window.confirm(lang === 'fr' ? 'Supprimer toutes les notifications ?' : 'Delete all notifications?')) return;
    try {
      await axios.delete(`${API}/business/notifications`);
      setNotifications([]);
      toast.success(lang === 'fr' ? 'Notifications supprimées' : 'Notifications cleared');
    } catch (err) {
      toast.error('Erreur');
    }
  };

  const markAllRead = async () => {
    try {
      await axios.put(`${API}/business/notifications/read-all`);
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    } catch (err) {
      toast.error('Erreur');
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <BusinessLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-heading font-800 flex items-center gap-3">
          <MessageSquare className="w-6 h-6 text-primary" />
          {lang === 'fr' ? 'Messages & Notifications' : 'Messages & Notifications'}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {lang === 'fr' ? 'Échangez avec le support NoShowGone' : 'Chat with NoShowGone support'}
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        <Button
          variant={activeTab === 'messages' ? 'default' : 'outline'}
          onClick={() => setActiveTab('messages')}
          className="rounded-full"
          data-testid="tab-messages"
        >
          <MessageSquare className="w-4 h-4 mr-2" />
          {lang === 'fr' ? 'Messages' : 'Messages'}
        </Button>
        <Button
          variant={activeTab === 'notifications' ? 'default' : 'outline'}
          onClick={() => setActiveTab('notifications')}
          className="rounded-full"
          data-testid="tab-notifications"
        >
          <Bell className="w-4 h-4 mr-2" />
          Notifications
          {unreadCount > 0 && (
            <span className="ml-2 bg-accent text-white px-2 py-0.5 rounded-full text-xs">{unreadCount}</span>
          )}
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {activeTab === 'messages' && (
            <div className="bg-card rounded-2xl border border-border h-[calc(100vh-320px)] flex flex-col">
              {/* Header */}
              <div className="p-4 border-b border-border flex items-center gap-3">
                <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-heading font-700">Support NoShowGone</h3>
                  <p className="text-xs text-muted-foreground">{lang === 'fr' ? 'Équipe support' : 'Support team'}</p>
                </div>
              </div>
              
              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-50" />
                    <p>{lang === 'fr' ? 'Aucun message. Envoyez-nous un message !' : 'No messages. Send us a message!'}</p>
                  </div>
                ) : (
                  messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex ${msg.sender_role === 'business' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div className={`max-w-[70%]`}>
                        <div className={`px-4 py-3 rounded-2xl ${
                          msg.sender_role === 'business' 
                            ? 'bg-primary text-white rounded-br-md' 
                            : 'bg-muted rounded-bl-md'
                        }`}>
                          <p className="text-sm">{msg.message}</p>
                        </div>
                        <div className={`flex items-center gap-2 mt-1 ${msg.sender_role === 'business' ? 'justify-end' : ''}`}>
                          <span className="text-[10px] text-muted-foreground">
                            {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          {msg.sender_role === 'business' && (
                            msg.read ? (
                              <CheckCheck className="w-3 h-3 text-primary" />
                            ) : (
                              <Check className="w-3 h-3 text-muted-foreground" />
                            )
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>
              
              {/* Input */}
              <div className="p-4 border-t border-border">
                <div className="flex gap-2">
                  <input
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                    placeholder={lang === 'fr' ? 'Écrivez un message au support...' : 'Write a message to support...'}
                    className="flex-1 px-4 py-3 bg-muted rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                    data-testid="business-message-input"
                  />
                  <Button 
                    onClick={sendMessage} 
                    disabled={sending || !newMessage.trim()}
                    className="rounded-xl"
                    data-testid="business-send-btn"
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div>
              {notifications.length > 0 && (
                <div className="flex items-center justify-end gap-2 mb-4">
                  <Button variant="ghost" size="sm" onClick={markAllRead} className="text-xs">
                    <Check className="w-3 h-3 mr-1" />
                    {lang === 'fr' ? 'Tout marquer comme lu' : 'Mark all read'}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={clearAllNotifications} className="text-xs text-accent hover:text-accent">
                    <Trash2 className="w-3 h-3 mr-1" />
                    {lang === 'fr' ? 'Tout supprimer' : 'Clear all'}
                  </Button>
                </div>
              )}
              
              {notifications.length === 0 ? (
                <div className="text-center py-12 bg-card rounded-2xl border border-border">
                  <Bell className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-50" />
                  <p className="text-muted-foreground">
                    {lang === 'fr' ? 'Aucune notification' : 'No notifications'}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {notifications.map((notif) => (
                    <div
                      key={notif.id}
                      className={`bg-card rounded-xl p-4 border transition-colors ${
                        notif.read ? 'border-border' : 'border-primary/30 bg-primary/5'
                      }`}
                      onClick={() => !notif.read && markNotificationRead(notif.id)}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 flex-1">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                            notif.type === 'admin_message' 
                              ? 'bg-primary/10' 
                              : 'bg-muted'
                          }`}>
                            {notif.type === 'admin_message' ? (
                              <MessageSquare className="w-5 h-5 text-primary" />
                            ) : (
                              <Bell className="w-5 h-5 text-muted-foreground" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <h4 className="font-heading font-600 text-sm">{notif.title}</h4>
                              {!notif.read && (
                                <span className="w-2 h-2 bg-primary rounded-full" />
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">{notif.content}</p>
                            <p className="text-[10px] text-muted-foreground mt-2">
                              {new Date(notif.created_at).toLocaleString()}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteNotification(notif.id); }}
                          className="p-2 hover:bg-muted rounded-lg transition-colors"
                          data-testid={`delete-notif-${notif.id}`}
                        >
                          <X className="w-4 h-4 text-muted-foreground hover:text-accent" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </BusinessLayout>
  );
}
