import React, { useState, useEffect } from 'react';
import { Heart, Send, Link2, Check, Clock, User, Mail, MessageSquare, Plus, Edit2, Trash2, ExternalLink } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { useLang } from '../../context/LangContext';
import BusinessLayout from '../../components/BusinessLayout';
import axios from 'axios';
import { API } from '../../context/AuthContext';
import { toast } from 'sonner';

const TemplateCard = ({ template, onEdit, onDelete, onSelect, selected }) => {
  const { lang } = useLang();
  
  return (
    <div 
      className={`bg-card rounded-xl p-4 border transition-all cursor-pointer ${
        selected ? 'border-primary ring-2 ring-primary/20' : 'border-border hover:border-primary/30'
      }`}
      onClick={() => onSelect(template)}
      data-testid={`thankyou-template-${template.id}`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          {template.include_link && <Link2 className="w-4 h-4 text-primary" />}
          <h3 className="font-heading font-600 text-sm">{template.name}</h3>
        </div>
        <div className="flex items-center gap-1">
          {!template.is_default && (
            <>
              <button onClick={(e) => { e.stopPropagation(); onEdit(template); }} className="p-1.5 hover:bg-muted rounded-lg">
                <Edit2 className="w-3.5 h-3.5 text-muted-foreground" />
              </button>
              <button onClick={(e) => { e.stopPropagation(); onDelete(template); }} className="p-1.5 hover:bg-muted rounded-lg">
                <Trash2 className="w-3.5 h-3.5 text-accent" />
              </button>
            </>
          )}
        </div>
      </div>
      <p className="text-xs text-muted-foreground line-clamp-2">{template.message}</p>
      {template.include_link && template.link_text && (
        <div className="mt-2 flex items-center gap-1 text-xs text-primary">
          <ExternalLink className="w-3 h-3" />
          {template.link_text}
        </div>
      )}
    </div>
  );
};

const SendModal = ({ appointments, template, onClose, onSuccess }) => {
  const { lang } = useLang();
  const [selectedIds, setSelectedIds] = useState([]);
  const [sending, setSending] = useState(false);

  const toggleSelect = (id) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    if (selectedIds.length === appointments.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(appointments.map(a => a.id));
    }
  };

  const sendMessages = async () => {
    if (selectedIds.length === 0) {
      toast.error(lang === 'fr' ? 'Sélectionnez au moins un RDV' : 'Select at least one appointment');
      return;
    }
    
    setSending(true);
    try {
      const res = await axios.post(`${API}/thankyou/bulk-send`, {
        template_id: template.id,
        appointment_ids: selectedIds
      });
      toast.success(lang === 'fr' 
        ? `${res.data.sent} message(s) envoyé(s) !` 
        : `${res.data.sent} message(s) sent!`
      );
      onSuccess();
    } catch (err) {
      toast.error('Erreur');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-2xl p-6 w-full max-w-lg border border-border max-h-[80vh] overflow-hidden flex flex-col">
        <h2 className="text-lg font-heading font-700 mb-2 flex items-center gap-2">
          <Send className="w-5 h-5 text-primary" />
          {lang === 'fr' ? 'Envoyer les remerciements' : 'Send Thank You Messages'}
        </h2>
        
        <p className="text-sm text-muted-foreground mb-4">
          {lang === 'fr' ? 'Template sélectionné:' : 'Selected template:'} <strong>{template.name}</strong>
        </p>
        
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-heading font-600">
            {appointments.length} {lang === 'fr' ? 'client(s) éligible(s)' : 'eligible client(s)'}
          </span>
          <Button variant="ghost" size="sm" onClick={selectAll} className="text-xs">
            {selectedIds.length === appointments.length 
              ? (lang === 'fr' ? 'Tout désélectionner' : 'Deselect all')
              : (lang === 'fr' ? 'Tout sélectionner' : 'Select all')}
          </Button>
        </div>
        
        <div className="flex-1 overflow-y-auto space-y-2 mb-4">
          {appointments.map((appt) => (
            <div
              key={appt.id}
              className={`p-3 rounded-xl border transition-colors cursor-pointer ${
                selectedIds.includes(appt.id) 
                  ? 'bg-primary/10 border-primary' 
                  : 'bg-muted/50 border-border hover:border-primary/30'
              }`}
              onClick={() => toggleSelect(appt.id)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    selectedIds.includes(appt.id) ? 'bg-primary border-primary' : 'border-muted-foreground'
                  }`}>
                    {selectedIds.includes(appt.id) && <Check className="w-3 h-3 text-white" />}
                  </div>
                  <div>
                    <p className="font-heading font-600 text-sm">{appt.client_name}</p>
                    <p className="text-xs text-muted-foreground">{appt.date}</p>
                  </div>
                </div>
                {appt.client_email && <Mail className="w-4 h-4 text-muted-foreground" />}
              </div>
            </div>
          ))}
        </div>
        
        <div className="flex gap-3 pt-4 border-t border-border">
          <Button variant="outline" onClick={onClose} className="flex-1 rounded-xl">
            {lang === 'fr' ? 'Annuler' : 'Cancel'}
          </Button>
          <Button 
            onClick={sendMessages} 
            disabled={sending || selectedIds.length === 0} 
            className="flex-1 rounded-xl bg-primary text-primary-foreground"
          >
            {sending ? '...' : `${lang === 'fr' ? 'Envoyer' : 'Send'} (${selectedIds.length})`}
          </Button>
        </div>
      </div>
    </div>
  );
};

const CreateTemplateModal = ({ template, onClose, onSuccess }) => {
  const { lang } = useLang();
  const [name, setName] = useState(template?.name || '');
  const [message, setMessage] = useState(template?.message || '');
  const [includeLink, setIncludeLink] = useState(template?.include_link || false);
  const [linkText, setLinkText] = useState(template?.link_text || '');
  const [linkUrl, setLinkUrl] = useState(template?.link_url || '');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!name || !message) {
      toast.error(lang === 'fr' ? 'Nom et message requis' : 'Name and message required');
      return;
    }
    
    setSaving(true);
    try {
      if (template?.id) {
        await axios.put(`${API}/thankyou/templates/${template.id}`, {
          name, message, include_link: includeLink, link_text: linkText, link_url: linkUrl
        });
      } else {
        await axios.post(`${API}/thankyou/templates`, {
          name, message, include_link: includeLink, link_text: linkText, link_url: linkUrl
        });
      }
      toast.success(lang === 'fr' ? 'Template sauvegardé' : 'Template saved');
      onSuccess();
    } catch (err) {
      toast.error('Erreur');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-2xl p-6 w-full max-w-md border border-border">
        <h2 className="text-lg font-heading font-700 mb-4">
          {template?.id ? (lang === 'fr' ? 'Modifier le template' : 'Edit Template') : (lang === 'fr' ? 'Nouveau template' : 'New Template')}
        </h2>
        
        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-sm font-heading font-600 mb-2">{lang === 'fr' ? 'Nom' : 'Name'}</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-3 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              placeholder="Ex: Remerciement fidélité"
            />
          </div>
          
          <div>
            <label className="block text-sm font-heading font-600 mb-2">
              Message <span className="text-xs text-muted-foreground">{'(utilisez {{client_name}} pour le nom)'}</span>
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full px-4 py-3 bg-background border border-border rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
              rows={4}
              placeholder="Merci {{client_name}} pour votre visite..."
            />
          </div>
          
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="includeLink"
              checked={includeLink}
              onChange={(e) => setIncludeLink(e.target.checked)}
              className="w-4 h-4 rounded border-border"
            />
            <label htmlFor="includeLink" className="text-sm font-heading font-600">
              {lang === 'fr' ? 'Inclure un lien' : 'Include a link'}
            </label>
          </div>
          
          {includeLink && (
            <div className="grid grid-cols-2 gap-3">
              <input
                value={linkText}
                onChange={(e) => setLinkText(e.target.value)}
                className="px-4 py-3 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                placeholder={lang === 'fr' ? 'Texte du lien' : 'Link text'}
              />
              <input
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                className="px-4 py-3 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                placeholder="https://..."
              />
            </div>
          )}
        </div>
        
        <div className="flex gap-3">
          <Button variant="outline" onClick={onClose} className="flex-1 rounded-xl">
            {lang === 'fr' ? 'Annuler' : 'Cancel'}
          </Button>
          <Button onClick={save} disabled={saving} className="flex-1 rounded-xl bg-primary text-primary-foreground">
            {saving ? '...' : (lang === 'fr' ? 'Sauvegarder' : 'Save')}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default function ThankYouPage() {
  const { lang } = useLang();
  const [templates, setTemplates] = useState([]);
  const [eligibleAppts, setEligibleAppts] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [showSendModal, setShowSendModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [activeTab, setActiveTab] = useState('send');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [templatesRes, eligibleRes, historyRes] = await Promise.all([
        axios.get(`${API}/thankyou/templates`),
        axios.get(`${API}/appointments?status=completed`),
        axios.get(`${API}/thankyou/history`)
      ]);
      setTemplates(templatesRes.data);
      // Filtrer les RDV sans remerciement
      setEligibleAppts(eligibleRes.data.filter(a => !a.thankyou_sent));
      setHistory(historyRes.data);
      if (templatesRes.data.length > 0) {
        setSelectedTemplate(templatesRes.data[0]);
      }
    } catch (err) {
      toast.error('Erreur');
    } finally {
      setLoading(false);
    }
  };

  const deleteTemplate = async (template) => {
    if (!window.confirm(lang === 'fr' ? 'Supprimer ce template ?' : 'Delete this template?')) return;
    try {
      await axios.delete(`${API}/thankyou/templates/${template.id}`);
      toast.success(lang === 'fr' ? 'Template supprimé' : 'Template deleted');
      fetchData();
    } catch (err) {
      toast.error('Erreur');
    }
  };

  return (
    <BusinessLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-heading font-800 flex items-center gap-3">
          <Heart className="w-6 h-6 text-pink-500" />
          {lang === 'fr' ? 'Messages de Remerciement' : 'Thank You Messages'}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {lang === 'fr' 
            ? 'Fidélisez vos clients avec des messages personnalisés'
            : 'Build loyalty with personalized messages'}
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        <Button
          variant={activeTab === 'send' ? 'default' : 'outline'}
          onClick={() => setActiveTab('send')}
          className="rounded-full"
          data-testid="tab-send"
        >
          <Send className="w-4 h-4 mr-2" />
          {lang === 'fr' ? 'Envoyer' : 'Send'}
          {eligibleAppts.length > 0 && (
            <span className="ml-2 bg-white/20 px-2 py-0.5 rounded-full text-xs">{eligibleAppts.length}</span>
          )}
        </Button>
        <Button
          variant={activeTab === 'templates' ? 'default' : 'outline'}
          onClick={() => setActiveTab('templates')}
          className="rounded-full"
          data-testid="tab-templates"
        >
          <MessageSquare className="w-4 h-4 mr-2" />
          Templates
        </Button>
        <Button
          variant={activeTab === 'history' ? 'default' : 'outline'}
          onClick={() => setActiveTab('history')}
          className="rounded-full"
          data-testid="tab-history"
        >
          <Clock className="w-4 h-4 mr-2" />
          {lang === 'fr' ? 'Historique' : 'History'}
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {activeTab === 'send' && (
            <div className="space-y-6">
              {/* Template selection */}
              <div>
                <h2 className="font-heading font-700 text-sm mb-3">
                  {lang === 'fr' ? '1. Choisir un template' : '1. Choose a template'}
                </h2>
                <div className="grid md:grid-cols-3 gap-3">
                  {templates.map((tpl) => (
                    <TemplateCard
                      key={tpl.id}
                      template={tpl}
                      selected={selectedTemplate?.id === tpl.id}
                      onSelect={setSelectedTemplate}
                      onEdit={(t) => { setEditingTemplate(t); setShowCreateModal(true); }}
                      onDelete={deleteTemplate}
                    />
                  ))}
                </div>
              </div>
              
              {/* Send action */}
              <div>
                <h2 className="font-heading font-700 text-sm mb-3">
                  {lang === 'fr' ? '2. Envoyer aux clients' : '2. Send to clients'}
                </h2>
                
                {eligibleAppts.length === 0 ? (
                  <div className="text-center py-8 bg-card rounded-2xl border border-border">
                    <Check className="w-10 h-10 text-primary mx-auto mb-3" />
                    <p className="font-heading font-600">
                      {lang === 'fr' ? 'Tous les clients ont été remerciés !' : 'All clients have been thanked!'}
                    </p>
                  </div>
                ) : (
                  <div className="bg-card rounded-2xl border border-border p-5">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <p className="font-heading font-600">
                          {eligibleAppts.length} {lang === 'fr' ? 'client(s) à remercier' : 'client(s) to thank'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {lang === 'fr' ? 'RDV terminés sans message de remerciement' : 'Completed appointments without thank you'}
                        </p>
                      </div>
                      <Button 
                        onClick={() => setShowSendModal(true)}
                        disabled={!selectedTemplate}
                        className="rounded-xl bg-pink-500 hover:bg-pink-600 text-white"
                        data-testid="send-thankyou-btn"
                      >
                        <Send className="w-4 h-4 mr-2" />
                        {lang === 'fr' ? 'Envoyer' : 'Send'}
                      </Button>
                    </div>
                    
                    <div className="flex flex-wrap gap-2">
                      {eligibleAppts.slice(0, 5).map((appt) => (
                        <span key={appt.id} className="px-3 py-1.5 bg-muted rounded-full text-xs font-heading font-600">
                          {appt.client_name}
                        </span>
                      ))}
                      {eligibleAppts.length > 5 && (
                        <span className="px-3 py-1.5 bg-muted rounded-full text-xs text-muted-foreground">
                          +{eligibleAppts.length - 5}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
          
          {activeTab === 'templates' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-heading font-700">
                  {lang === 'fr' ? 'Mes templates' : 'My templates'}
                </h2>
                <Button 
                  onClick={() => { setEditingTemplate(null); setShowCreateModal(true); }}
                  className="rounded-xl"
                  data-testid="create-template-btn"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  {lang === 'fr' ? 'Créer' : 'Create'}
                </Button>
              </div>
              
              <div className="grid md:grid-cols-2 gap-4">
                {templates.map((tpl) => (
                  <div key={tpl.id} className="bg-card rounded-xl p-5 border border-border">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-heading font-700">{tpl.name}</h3>
                        {tpl.is_default && (
                          <span className="text-xs text-muted-foreground">{lang === 'fr' ? 'Par défaut' : 'Default'}</span>
                        )}
                      </div>
                      {!tpl.is_default && (
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" onClick={() => { setEditingTemplate(tpl); setShowCreateModal(true); }}>
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => deleteTemplate(tpl)}>
                            <Trash2 className="w-4 h-4 text-accent" />
                          </Button>
                        </div>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mb-3">{tpl.message}</p>
                    {tpl.include_link && (
                      <div className="flex items-center gap-2 text-xs text-primary">
                        <Link2 className="w-3 h-3" />
                        {tpl.link_text || tpl.link_url}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {activeTab === 'history' && (
            <div>
              {history.length === 0 ? (
                <div className="text-center py-12 bg-card rounded-2xl border border-border">
                  <MessageSquare className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground">
                    {lang === 'fr' ? 'Aucun message envoyé' : 'No messages sent'}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {history.map((msg) => (
                    <div key={msg.id} className="bg-card rounded-xl p-4 border border-border">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-pink-100 dark:bg-pink-900/20 rounded-full flex items-center justify-center">
                            <Heart className="w-5 h-5 text-pink-500" />
                          </div>
                          <div>
                            <p className="font-heading font-600">{msg.client_name}</p>
                            <p className="text-xs text-muted-foreground">{msg.client_email || msg.client_phone}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className={`text-xs px-2 py-1 rounded-full ${
                            msg.status === 'sent' ? 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400' : 'bg-yellow-100 text-yellow-700'
                          }`}>
                            {msg.status === 'sent' ? (lang === 'fr' ? 'Envoyé' : 'Sent') : msg.status}
                          </span>
                          <p className="text-[10px] text-muted-foreground mt-1">
                            {new Date(msg.sent_at).toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground pl-13">{msg.message}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {showSendModal && selectedTemplate && (
        <SendModal
          template={selectedTemplate}
          appointments={eligibleAppts}
          onClose={() => setShowSendModal(false)}
          onSuccess={() => {
            setShowSendModal(false);
            fetchData();
          }}
        />
      )}

      {showCreateModal && (
        <CreateTemplateModal
          template={editingTemplate}
          onClose={() => { setShowCreateModal(false); setEditingTemplate(null); }}
          onSuccess={() => {
            setShowCreateModal(false);
            setEditingTemplate(null);
            fetchData();
          }}
        />
      )}
    </BusinessLayout>
  );
}
