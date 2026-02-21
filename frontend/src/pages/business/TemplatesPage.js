import React, { useState, useEffect } from 'react';
import { FileText, Edit2, Save, X, RotateCcw, Eye, Plus, Trash2, CheckCircle, Mail, MessageSquare, Phone, Copy } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Switch } from '../../components/ui/switch';
import BusinessLayout from '../../components/BusinessLayout';
import { useLang } from '../../context/LangContext';
import axios from 'axios';
import { API } from '../../context/AuthContext';
import { toast } from 'sonner';
import { cn } from '../../lib/utils';

const CHANNEL_ICONS = {
  email: Mail,
  sms: Phone,
  whatsapp: MessageSquare,
};

const CHANNEL_COLORS = {
  email: 'text-blue-500',
  sms: 'text-green-500',
  whatsapp: 'text-green-600',
};

export default function TemplatesPage() {
  const { lang } = useLang();
  const [templates, setTemplates] = useState([]);
  const [variables, setVariables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const [templatesRes, varsRes] = await Promise.all([
        axios.get(`${API}/templates`),
        axios.get(`${API}/templates/variables`)
      ]);
      setTemplates(templatesRes.data);
      setVariables(varsRes.data);
    } catch {
      toast.error('Erreur chargement templates');
    } finally {
      setLoading(false);
    }
  };

  const startEdit = (template) => {
    setEditing(template.id);
    setEditForm({ ...template });
  };

  const cancelEdit = () => {
    setEditing(null);
    setEditForm({});
  };

  const saveTemplate = async () => {
    setSaving(true);
    try {
      await axios.put(`${API}/templates/${editForm.id}`, editForm);
      toast.success(lang === 'fr' ? 'Template sauvegardé !' : 'Template saved!');
      setEditing(null);
      fetchData();
    } catch {
      toast.error('Erreur');
    } finally {
      setSaving(false);
    }
  };

  const resetTemplate = async (templateId) => {
    try {
      await axios.post(`${API}/templates/${templateId}/reset`);
      toast.success(lang === 'fr' ? 'Template réinitialisé' : 'Template reset');
      fetchData();
    } catch {
      toast.error('Erreur');
    }
  };

  const loadPreview = async (templateId) => {
    setLoadingPreview(true);
    try {
      const res = await axios.get(`${API}/templates/${templateId}/preview?lang=${lang}`);
      setPreview(res.data);
    } catch {
      toast.error('Erreur');
    } finally {
      setLoadingPreview(false);
    }
  };

  const toggleChannel = (channel) => {
    const channels = editForm.channels || [];
    if (channels.includes(channel)) {
      setEditForm(f => ({ ...f, channels: channels.filter(c => c !== channel) }));
    } else {
      setEditForm(f => ({ ...f, channels: [...channels, channel] }));
    }
  };

  const insertVariable = (key) => {
    const placeholder = `{{${key}}}`;
    navigator.clipboard.writeText(placeholder);
    toast.success(`${placeholder} copié !`);
  };

  return (
    <BusinessLayout>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-heading font-800 flex items-center gap-2">
            <FileText className="w-6 h-6 text-primary" />
            {lang === 'fr' ? 'Templates de messages' : 'Message templates'}
          </h1>
          <p className="text-sm text-muted-foreground">
            {lang === 'fr' 
              ? 'Personnalisez vos messages de rappel et confirmation' 
              : 'Customize your reminder and confirmation messages'}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center h-48 items-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Templates list */}
          <div className="lg:col-span-2 space-y-4">
            {templates.map(template => (
              <div 
                key={template.id}
                className={cn(
                  "bg-card rounded-2xl border p-5 transition-all",
                  editing === template.id ? "border-primary" : "border-border/50"
                )}
                data-testid={`template-${template.id}`}
              >
                {editing === template.id ? (
                  /* Edit mode */
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-heading font-700">{lang === 'fr' ? 'Modifier le template' : 'Edit template'}</h3>
                      <button onClick={cancelEdit} className="p-1 rounded-full hover:bg-muted">
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="grid sm:grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs">{lang === 'fr' ? 'Nom (FR)' : 'Name (FR)'}</Label>
                        <Input 
                          value={editForm.name_fr || ''} 
                          onChange={e => setEditForm(f => ({ ...f, name_fr: e.target.value }))}
                          className="h-9 rounded-xl text-sm"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">{lang === 'fr' ? 'Nom (EN)' : 'Name (EN)'}</Label>
                        <Input 
                          value={editForm.name_en || ''} 
                          onChange={e => setEditForm(f => ({ ...f, name_en: e.target.value }))}
                          className="h-9 rounded-xl text-sm"
                        />
                      </div>
                    </div>

                    <div>
                      <Label className="text-xs">{lang === 'fr' ? 'Sujet (FR)' : 'Subject (FR)'}</Label>
                      <Input 
                        value={editForm.subject_fr || ''} 
                        onChange={e => setEditForm(f => ({ ...f, subject_fr: e.target.value }))}
                        className="h-9 rounded-xl text-sm"
                      />
                    </div>

                    <div>
                      <Label className="text-xs">{lang === 'fr' ? 'Message (FR)' : 'Body (FR)'}</Label>
                      <textarea 
                        value={editForm.body_fr || ''} 
                        onChange={e => setEditForm(f => ({ ...f, body_fr: e.target.value }))}
                        className="w-full h-32 p-3 rounded-xl border border-border bg-background text-sm resize-none"
                      />
                    </div>

                    <div>
                      <Label className="text-xs mb-2 block">{lang === 'fr' ? 'Canaux' : 'Channels'}</Label>
                      <div className="flex gap-2">
                        {['email', 'sms', 'whatsapp'].map(channel => {
                          const Icon = CHANNEL_ICONS[channel];
                          const isActive = (editForm.channels || []).includes(channel);
                          return (
                            <button
                              key={channel}
                              onClick={() => toggleChannel(channel)}
                              className={cn(
                                "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-heading font-600 transition-all",
                                isActive ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                              )}
                            >
                              <Icon className="w-3.5 h-3.5" />
                              {channel.toUpperCase()}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <Switch 
                        checked={editForm.is_active} 
                        onCheckedChange={v => setEditForm(f => ({ ...f, is_active: v }))}
                      />
                      <span className="text-xs font-heading font-600">{lang === 'fr' ? 'Actif' : 'Active'}</span>
                    </div>

                    <div className="flex gap-2">
                      <Button onClick={cancelEdit} variant="outline" className="flex-1 rounded-full h-9 text-xs font-heading font-700">
                        {lang === 'fr' ? 'Annuler' : 'Cancel'}
                      </Button>
                      <Button onClick={saveTemplate} disabled={saving} className="flex-1 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 h-9 text-xs font-heading font-700">
                        <Save className="w-3.5 h-3.5 mr-1" />
                        {saving ? '...' : (lang === 'fr' ? 'Sauvegarder' : 'Save')}
                      </Button>
                    </div>
                  </div>
                ) : (
                  /* View mode */
                  <>
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-heading font-700">
                            {lang === 'fr' ? template.name_fr : template.name_en}
                          </h3>
                          {template.is_customized && (
                            <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-heading font-600">
                              {lang === 'fr' ? 'Personnalisé' : 'Customized'}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {lang === 'fr' ? template.subject_fr : template.subject_en}
                        </p>
                      </div>
                      <div className={cn(
                        "w-2 h-2 rounded-full",
                        template.is_active ? "bg-green-500" : "bg-muted-foreground"
                      )} title={template.is_active ? 'Actif' : 'Inactif'} />
                    </div>

                    <div className="text-xs text-muted-foreground line-clamp-2 mb-3 bg-muted/30 p-2 rounded-lg">
                      {(lang === 'fr' ? template.body_fr : template.body_en)?.slice(0, 150)}...
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex gap-1">
                        {(template.channels || []).map(channel => {
                          const Icon = CHANNEL_ICONS[channel];
                          return (
                            <div key={channel} className={cn("p-1.5 rounded-lg bg-muted/50", CHANNEL_COLORS[channel])} title={channel}>
                              <Icon className="w-3.5 h-3.5" />
                            </div>
                          );
                        })}
                      </div>
                      <div className="flex gap-1">
                        <button 
                          onClick={() => loadPreview(template.id)}
                          className="p-1.5 rounded-lg hover:bg-muted transition-colors"
                          title={lang === 'fr' ? 'Prévisualiser' : 'Preview'}
                        >
                          <Eye className="w-4 h-4 text-muted-foreground" />
                        </button>
                        {template.is_customized && (
                          <button 
                            onClick={() => resetTemplate(template.id)}
                            className="p-1.5 rounded-lg hover:bg-muted transition-colors"
                            title={lang === 'fr' ? 'Réinitialiser' : 'Reset'}
                          >
                            <RotateCcw className="w-4 h-4 text-muted-foreground" />
                          </button>
                        )}
                        <button 
                          onClick={() => startEdit(template)}
                          className="p-1.5 rounded-lg hover:bg-muted transition-colors"
                          title={lang === 'fr' ? 'Modifier' : 'Edit'}
                          data-testid={`edit-template-${template.id}`}
                        >
                          <Edit2 className="w-4 h-4 text-muted-foreground" />
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>

          {/* Sidebar - Variables & Preview */}
          <div className="space-y-5">
            {/* Variables */}
            <div className="bg-card rounded-2xl border border-border/50 p-5 sticky top-4">
              <h3 className="font-heading font-700 text-sm mb-3 flex items-center gap-2">
                <Copy className="w-4 h-4 text-primary" />
                {lang === 'fr' ? 'Variables disponibles' : 'Available variables'}
              </h3>
              <p className="text-xs text-muted-foreground mb-3">
                {lang === 'fr' 
                  ? 'Cliquez pour copier et coller dans vos messages' 
                  : 'Click to copy and paste in your messages'}
              </p>
              <div className="space-y-1.5">
                {variables.map(v => (
                  <button
                    key={v.key}
                    onClick={() => insertVariable(v.key)}
                    className="w-full flex items-center justify-between p-2 rounded-lg bg-muted/30 hover:bg-muted transition-colors text-left"
                  >
                    <div>
                      <div className="text-xs font-mono text-primary">{'{{' + v.key + '}}'}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {lang === 'fr' ? v.label_fr : v.label_en}
                      </div>
                    </div>
                    <Copy className="w-3 h-3 text-muted-foreground" />
                  </button>
                ))}
              </div>
            </div>

            {/* Preview */}
            {preview && (
              <div className="bg-card rounded-2xl border border-border/50 p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-heading font-700 text-sm flex items-center gap-2">
                    <Eye className="w-4 h-4 text-primary" />
                    {lang === 'fr' ? 'Prévisualisation' : 'Preview'}
                  </h3>
                  <button onClick={() => setPreview(null)} className="p-1 rounded-full hover:bg-muted">
                    <X className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                </div>
                <div className="space-y-2">
                  <div className="text-xs">
                    <span className="text-muted-foreground">Sujet:</span>
                    <p className="font-heading font-600">{preview.subject}</p>
                  </div>
                  <div className="text-xs">
                    <span className="text-muted-foreground">Message:</span>
                    <p className="whitespace-pre-wrap bg-muted/30 p-3 rounded-lg mt-1">{preview.body}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </BusinessLayout>
  );
}
