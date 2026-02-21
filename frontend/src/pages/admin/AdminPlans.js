import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Save, X, CheckCircle, DollarSign } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Switch } from '../../components/ui/switch';
import AdminLayout from '../../components/AdminLayout';
import { useLang } from '../../context/LangContext';
import axios from 'axios';
import { API } from '../../context/AuthContext';
import { toast } from 'sonner';

const DEFAULT_PLANS = [
  { id: 'free_trial', name: 'Essai Gratuit', price: 0, appointments_per_month: 30, staff_members: 1, sms_notifications: 10, features: ['Email reminders', 'Basic dashboard'], is_active: true, trial_days: 14, color: '#f59e0b' },
  { id: 'solo', name: 'Solo', price: 29, appointments_per_month: 100, staff_members: 1, sms_notifications: 50, features: ['All free features', 'WhatsApp reminders', 'Analytics'], is_active: true, trial_days: 0, color: '#3b82f6' },
  { id: 'pro', name: 'Pro', price: 59, appointments_per_month: 500, staff_members: 5, sms_notifications: 200, features: ['All Solo features', 'SMS', 'Deposit collection', 'Risk score'], is_active: true, trial_days: 0, color: '#15803d' },
  { id: 'business', name: 'Business', price: 99, appointments_per_month: -1, staff_members: -1, sms_notifications: -1, features: ['Everything unlimited', 'Priority support', 'API access', 'White label'], is_active: true, trial_days: 0, color: '#8b5cf6' },
];

export default function AdminPlans() {
  const { lang } = useLang();
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingPlan, setEditingPlan] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [newFeature, setNewFeature] = useState('');

  useEffect(() => { fetchPlans(); }, []);

  const fetchPlans = async () => {
    try {
      const res = await axios.get(`${API}/admin/plans`);
      setPlans(res.data.length > 0 ? res.data : DEFAULT_PLANS);
    } catch {
      setPlans(DEFAULT_PLANS);
    } finally {
      setLoading(false);
    }
  };

  const startEdit = (plan) => {
    setEditingPlan(plan.id);
    setEditForm({ ...plan, features: [...(plan.features || [])] });
  };

  const savePlan = async () => {
    setSaving(true);
    try {
      await axios.put(`${API}/admin/plans/${editForm.id}`, editForm);
      toast.success(lang === 'fr' ? 'Plan mis à jour !' : 'Plan updated!');
      setEditingPlan(null);
      fetchPlans();
    } catch {
      toast.error('Error saving plan');
    } finally {
      setSaving(false);
    }
  };

  const addFeature = () => {
    if (!newFeature.trim()) return;
    setEditForm(p => ({ ...p, features: [...(p.features || []), newFeature.trim()] }));
    setNewFeature('');
  };

  const removeFeature = (idx) => {
    setEditForm(p => ({ ...p, features: p.features.filter((_, i) => i !== idx) }));
  };

  const planColors = { free_trial: '#f59e0b', solo: '#3b82f6', pro: '#15803d', business: '#8b5cf6' };

  return (
    <AdminLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-heading font-800">{lang === 'fr' ? 'Plans & Tarification' : 'Plans & Pricing'}</h1>
        <p className="text-sm text-muted-foreground">{lang === 'fr' ? 'Gérez les plans d\'abonnement, prix et fonctionnalités' : 'Manage subscription plans, prices and features'}</p>
      </div>

      {loading ? (
        <div className="flex justify-center h-48 items-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-5">
          {plans.map(plan => (
            <div key={plan.id} className="bg-card rounded-2xl border border-border/50 card-shadow overflow-hidden" data-testid={`plan-card-${plan.id}`}>
              {/* Color bar */}
              <div className="h-1.5" style={{ background: planColors[plan.id] || plan.color || '#15803d' }} />

              <div className="p-5">
                {editingPlan === plan.id ? (
                  /* Edit mode */
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-heading font-800 text-base">{lang === 'fr' ? 'Modifier le plan' : 'Edit plan'}</h3>
                      <button onClick={() => setEditingPlan(null)} className="p-1 rounded-full hover:bg-muted">
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs font-heading font-600">{lang === 'fr' ? 'Nom' : 'Name'}</Label>
                        <Input value={editForm.name || ''} onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))} className="h-9 rounded-xl text-sm" data-testid="plan-name-input" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs font-heading font-600">{lang === 'fr' ? 'Prix (€/mois)' : 'Price (€/mo)'}</Label>
                        <Input type="number" value={editForm.price || 0} onChange={e => setEditForm(p => ({ ...p, price: parseFloat(e.target.value) }))} className="h-9 rounded-xl text-sm" data-testid="plan-price-input" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs font-heading font-600">{lang === 'fr' ? 'RDV/mois (-1=∞)' : 'Appts/mo (-1=∞)'}</Label>
                        <Input type="number" value={editForm.appointments_per_month || 0} onChange={e => setEditForm(p => ({ ...p, appointments_per_month: parseInt(e.target.value) }))} className="h-9 rounded-xl text-sm" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs font-heading font-600">{lang === 'fr' ? 'Staff (-1=∞)' : 'Staff (-1=∞)'}</Label>
                        <Input type="number" value={editForm.staff_members || 0} onChange={e => setEditForm(p => ({ ...p, staff_members: parseInt(e.target.value) }))} className="h-9 rounded-xl text-sm" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs font-heading font-600">SMS (-1=∞)</Label>
                        <Input type="number" value={editForm.sms_notifications || 0} onChange={e => setEditForm(p => ({ ...p, sms_notifications: parseInt(e.target.value) }))} className="h-9 rounded-xl text-sm" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs font-heading font-600">{lang === 'fr' ? 'Jours essai' : 'Trial days'}</Label>
                        <Input type="number" value={editForm.trial_days || 0} onChange={e => setEditForm(p => ({ ...p, trial_days: parseInt(e.target.value) }))} className="h-9 rounded-xl text-sm" />
                      </div>
                    </div>

                    {/* Features */}
                    <div>
                      <Label className="text-xs font-heading font-600 mb-2 block">{lang === 'fr' ? 'Fonctionnalités' : 'Features'}</Label>
                      <div className="space-y-1 mb-2 max-h-32 overflow-y-auto">
                        {(editForm.features || []).map((f, i) => (
                          <div key={i} className="flex items-center gap-2 text-xs bg-muted/50 rounded-lg px-2 py-1">
                            <CheckCircle className="w-3 h-3 text-primary flex-shrink-0" />
                            <span className="flex-1">{f}</span>
                            <button onClick={() => removeFeature(i)} className="text-muted-foreground hover:text-destructive">
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <Input value={newFeature} onChange={e => setNewFeature(e.target.value)} onKeyDown={e => e.key === 'Enter' && addFeature()} placeholder={lang === 'fr' ? 'Ajouter une fonctionnalité...' : 'Add feature...'} className="h-8 rounded-xl text-xs flex-1" />
                        <Button size="sm" onClick={addFeature} className="h-8 rounded-xl bg-primary text-primary-foreground px-3">
                          <Plus className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Switch checked={editForm.is_active} onCheckedChange={v => setEditForm(p => ({ ...p, is_active: v }))} />
                        <span className="text-xs font-heading font-600">{lang === 'fr' ? 'Actif' : 'Active'}</span>
                      </div>
                      <Button onClick={savePlan} disabled={saving} className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90 h-9 px-4 font-heading font-700 text-sm" data-testid="save-plan-btn">
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
                        <h3 className="font-heading font-800 text-lg">{plan.name}</h3>
                        <div className="flex items-baseline gap-1">
                          <span className="text-3xl font-heading font-800" style={{ color: planColors[plan.id] || plan.color }}>
                            {plan.price === 0 ? (lang === 'fr' ? 'Gratuit' : 'Free') : `${plan.price}€`}
                          </span>
                          {plan.price > 0 && <span className="text-xs text-muted-foreground">{lang === 'fr' ? '/mois' : '/mo'}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${plan.is_active ? 'bg-primary' : 'bg-muted-foreground'}`} />
                        <button onClick={() => startEdit(plan)} className="p-1.5 rounded-lg hover:bg-muted transition-colors" data-testid={`edit-plan-${plan.id}`}>
                          <Edit2 className="w-4 h-4 text-muted-foreground" />
                        </button>
                      </div>
                    </div>

                    {/* Limits */}
                    <div className="grid grid-cols-3 gap-2 mb-3">
                      {[
                        { label: lang === 'fr' ? 'RDV/mois' : 'Appts/mo', val: plan.appointments_per_month === -1 ? '∞' : plan.appointments_per_month },
                        { label: lang === 'fr' ? 'Staff' : 'Staff', val: plan.staff_members === -1 ? '∞' : plan.staff_members },
                        { label: 'SMS', val: plan.sms_notifications === -1 ? '∞' : plan.sms_notifications },
                      ].map((l, i) => (
                        <div key={i} className="bg-muted/50 rounded-lg p-2 text-center">
                          <div className="font-mono font-600 text-sm">{l.val}</div>
                          <div className="text-[10px] text-muted-foreground">{l.label}</div>
                        </div>
                      ))}
                    </div>

                    {/* Features */}
                    <ul className="space-y-1">
                      {(plan.features || []).slice(0, 4).map((f, i) => (
                        <li key={i} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <CheckCircle className="w-3 h-3 text-primary flex-shrink-0" />
                          {f}
                        </li>
                      ))}
                      {(plan.features || []).length > 4 && (
                        <li className="text-xs text-muted-foreground pl-4.5">+{plan.features.length - 4} {lang === 'fr' ? 'autres' : 'more'}...</li>
                      )}
                    </ul>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </AdminLayout>
  );
}
