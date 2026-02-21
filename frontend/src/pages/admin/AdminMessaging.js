import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, Send, Users, Search, ChevronRight, Check, CheckCheck, Trash2, User, Building2 } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { useLang } from '../../context/LangContext';
import AdminLayout from '../../components/AdminLayout';
import axios from 'axios';
import { API } from '../../context/AuthContext';
import { toast } from 'sonner';

export default function AdminMessaging() {
  const { lang } = useLang();
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showGroupMessage, setShowGroupMessage] = useState(false);
  const [groupMessage, setGroupMessage] = useState('');
  const [selectedBusinesses, setSelectedBusinesses] = useState([]);
  const [allBusinesses, setAllBusinesses] = useState([]);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    fetchConversations();
    fetchAllBusinesses();
  }, []);

  useEffect(() => {
    if (selectedConversation) {
      fetchMessages(selectedConversation.business_id);
    }
  }, [selectedConversation]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchConversations = async () => {
    try {
      const res = await axios.get(`${API}/admin/conversations`);
      setConversations(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAllBusinesses = async () => {
    try {
      const res = await axios.get(`${API}/admin/businesses?limit=100`);
      setAllBusinesses(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchMessages = async (businessId) => {
    try {
      const res = await axios.get(`${API}/admin/conversations/${businessId}`);
      setMessages(res.data.messages);
      // Rafraîchir les conversations pour mettre à jour les non-lus
      fetchConversations();
    } catch (err) {
      console.error(err);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation) return;
    
    setSending(true);
    try {
      await axios.post(`${API}/admin/conversations/${selectedConversation.business_id}`, {
        message: newMessage
      });
      setNewMessage('');
      fetchMessages(selectedConversation.business_id);
    } catch (err) {
      toast.error('Erreur');
    } finally {
      setSending(false);
    }
  };

  const deleteMessage = async (messageId) => {
    if (!selectedConversation) return;
    try {
      await axios.delete(`${API}/admin/conversations/${selectedConversation.business_id}/messages/${messageId}`);
      fetchMessages(selectedConversation.business_id);
    } catch (err) {
      toast.error('Erreur');
    }
  };

  const sendGroupMessage = async () => {
    if (!groupMessage.trim() || selectedBusinesses.length === 0) {
      toast.error(lang === 'fr' ? 'Sélectionnez au moins une entreprise' : 'Select at least one business');
      return;
    }
    
    setSending(true);
    try {
      await axios.post(`${API}/admin/conversations/group`, {
        business_ids: selectedBusinesses,
        message: groupMessage
      });
      toast.success(lang === 'fr' ? `Message envoyé à ${selectedBusinesses.length} entreprise(s)` : `Message sent to ${selectedBusinesses.length} business(es)`);
      setShowGroupMessage(false);
      setGroupMessage('');
      setSelectedBusinesses([]);
      fetchConversations();
    } catch (err) {
      toast.error('Erreur');
    } finally {
      setSending(false);
    }
  };

  const searchBusinesses = async (query) => {
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }
    try {
      const res = await axios.get(`${API}/admin/business-search?q=${encodeURIComponent(query)}`);
      setSearchResults(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const startNewConversation = (business) => {
    setSelectedConversation({
      business_id: business.id,
      business_name: business.name,
      business_type: business.business_type
    });
    setMessages([]);
    setSearchQuery('');
    setSearchResults([]);
  };

  const toggleBusinessSelection = (id) => {
    setSelectedBusinesses(prev => 
      prev.includes(id) ? prev.filter(b => b !== id) : [...prev, id]
    );
  };

  const totalUnread = conversations.reduce((sum, c) => sum + (c.unread_count || 0), 0);

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-heading font-800 flex items-center gap-3">
            <MessageSquare className="w-6 h-6 text-primary" />
            {lang === 'fr' ? 'Messagerie' : 'Messaging'}
            {totalUnread > 0 && (
              <span className="bg-accent text-white text-sm px-2.5 py-0.5 rounded-full">
                {totalUnread}
              </span>
            )}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {lang === 'fr' ? 'Communiquez avec vos clients' : 'Communicate with your clients'}
          </p>
        </div>
        <Button onClick={() => setShowGroupMessage(true)} className="rounded-xl" data-testid="group-message-btn">
          <Users className="w-4 h-4 mr-2" />
          {lang === 'fr' ? 'Message groupé' : 'Group Message'}
        </Button>
      </div>

      <div className="grid md:grid-cols-3 gap-5 h-[calc(100vh-220px)]">
        {/* Conversation list */}
        <div className="bg-card rounded-2xl border border-border overflow-hidden flex flex-col">
          <div className="p-4 border-b border-border">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  searchBusinesses(e.target.value);
                }}
                placeholder={lang === 'fr' ? 'Rechercher...' : 'Search...'}
                className="w-full pl-10 pr-4 py-2.5 bg-muted rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                data-testid="search-business-input"
              />
            </div>
            
            {searchResults.length > 0 && (
              <div className="mt-2 bg-background rounded-xl border border-border p-2 max-h-40 overflow-y-auto">
                {searchResults.map((biz) => (
                  <button
                    key={biz.id}
                    onClick={() => startNewConversation(biz)}
                    className="w-full flex items-center gap-3 p-2 hover:bg-muted rounded-lg text-left"
                  >
                    <Building2 className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-heading font-600">{biz.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : conversations.length === 0 ? (
              <div className="text-center py-8 px-4 text-muted-foreground text-sm">
                {lang === 'fr' ? 'Aucune conversation' : 'No conversations'}
              </div>
            ) : (
              conversations.map((conv) => (
                <button
                  key={conv.business_id}
                  onClick={() => setSelectedConversation(conv)}
                  className={`w-full flex items-start gap-3 p-4 border-b border-border hover:bg-muted/50 transition-colors text-left ${
                    selectedConversation?.business_id === conv.business_id ? 'bg-muted' : ''
                  }`}
                  data-testid={`conversation-${conv.business_id}`}
                >
                  <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                    <Building2 className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-heading font-600 text-sm truncate">{conv.business_name}</span>
                      {conv.unread_count > 0 && (
                        <span className="bg-primary text-white text-[10px] px-1.5 py-0.5 rounded-full">
                          {conv.unread_count}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {conv.last_sender === 'admin' && <span className="text-primary">Vous: </span>}
                      {conv.last_message}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {new Date(conv.last_date).toLocaleDateString()}
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Chat area */}
        <div className="md:col-span-2 bg-card rounded-2xl border border-border overflow-hidden flex flex-col">
          {selectedConversation ? (
            <>
              {/* Header */}
              <div className="p-4 border-b border-border flex items-center gap-3">
                <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-heading font-700">{selectedConversation.business_name}</h3>
                  <p className="text-xs text-muted-foreground">{selectedConversation.business_type}</p>
                </div>
              </div>
              
              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.sender_role === 'admin' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`max-w-[70%] group ${msg.sender_role === 'admin' ? 'order-1' : ''}`}>
                      <div className={`px-4 py-3 rounded-2xl ${
                        msg.sender_role === 'admin' 
                          ? 'bg-primary text-white rounded-br-md' 
                          : 'bg-muted rounded-bl-md'
                      }`}>
                        <p className="text-sm">{msg.message}</p>
                      </div>
                      <div className={`flex items-center gap-2 mt-1 ${msg.sender_role === 'admin' ? 'justify-end' : ''}`}>
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {msg.sender_role === 'admin' && (
                          <>
                            {msg.read ? (
                              <CheckCheck className="w-3 h-3 text-primary" />
                            ) : (
                              <Check className="w-3 h-3 text-muted-foreground" />
                            )}
                            <button 
                              onClick={() => deleteMessage(msg.id)}
                              className="opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <Trash2 className="w-3 h-3 text-muted-foreground hover:text-accent" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
              
              {/* Input */}
              <div className="p-4 border-t border-border">
                <div className="flex gap-2">
                  <input
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                    placeholder={lang === 'fr' ? 'Écrivez un message...' : 'Type a message...'}
                    className="flex-1 px-4 py-3 bg-muted rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                    data-testid="message-input"
                  />
                  <Button 
                    onClick={sendMessage} 
                    disabled={sending || !newMessage.trim()}
                    className="rounded-xl"
                    data-testid="send-message-btn"
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>{lang === 'fr' ? 'Sélectionnez une conversation' : 'Select a conversation'}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Group Message Modal */}
      {showGroupMessage && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-2xl p-6 w-full max-w-lg border border-border max-h-[80vh] overflow-hidden flex flex-col">
            <h2 className="text-lg font-heading font-700 mb-4 flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              {lang === 'fr' ? 'Message groupé' : 'Group Message'}
            </h2>
            
            <div className="mb-4">
              <label className="block text-sm font-heading font-600 mb-2">
                {lang === 'fr' ? 'Sélectionner les entreprises' : 'Select businesses'}
              </label>
              <div className="flex gap-2 mb-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setSelectedBusinesses(allBusinesses.map(b => b.id))}
                  className="text-xs"
                >
                  {lang === 'fr' ? 'Tout sélectionner' : 'Select all'}
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setSelectedBusinesses([])}
                  className="text-xs"
                >
                  {lang === 'fr' ? 'Tout désélectionner' : 'Deselect all'}
                </Button>
              </div>
              <div className="max-h-40 overflow-y-auto space-y-1 bg-muted/50 rounded-xl p-2">
                {allBusinesses.map((biz) => (
                  <label
                    key={biz.id}
                    className="flex items-center gap-2 p-2 hover:bg-muted rounded-lg cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedBusinesses.includes(biz.id)}
                      onChange={() => toggleBusinessSelection(biz.id)}
                      className="w-4 h-4 rounded border-border"
                    />
                    <span className="text-sm">{biz.name}</span>
                  </label>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {selectedBusinesses.length} {lang === 'fr' ? 'sélectionnée(s)' : 'selected'}
              </p>
            </div>
            
            <div className="mb-4">
              <label className="block text-sm font-heading font-600 mb-2">Message</label>
              <textarea
                value={groupMessage}
                onChange={(e) => setGroupMessage(e.target.value)}
                className="w-full px-4 py-3 bg-background border border-border rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
                rows={4}
                placeholder={lang === 'fr' ? 'Écrivez votre message...' : 'Write your message...'}
              />
            </div>
            
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setShowGroupMessage(false)} className="flex-1 rounded-xl">
                {lang === 'fr' ? 'Annuler' : 'Cancel'}
              </Button>
              <Button 
                onClick={sendGroupMessage} 
                disabled={sending || selectedBusinesses.length === 0 || !groupMessage.trim()}
                className="flex-1 rounded-xl bg-primary text-primary-foreground"
              >
                {sending ? '...' : `${lang === 'fr' ? 'Envoyer' : 'Send'} (${selectedBusinesses.length})`}
              </Button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
