import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Save, X, CheckCircle, DollarSign, AlertTriangle, GripVertical } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Switch } from '../../components/ui/switch';
import AdminLayout from '../../components/AdminLayout';
import { useLang } from '../../context/LangContext';
import axios from 'axios';
import { API } from '../../context/AuthContext';
import { toast } from 'sonner';

const DEFAULT_NEW_PLAN = {
  name: 'Nouveau Plan',
  price: 49,
  appointments_per_month: 200,
  staff_members: 3,
  sms_notifications: 100,
  features: [],
  is_active: true,
  trial_days: 0,
  color: '#3b82f6'
};

export default function AdminPlans() {
  const { lang } = useLang();
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingPlan, setEditingPlan] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [newFeature, setNewFeature] = useState('');
  const [showNewPlan, setShowNewPlan] = useState(false);
  const [deletingPlan, setDeletingPlan] = useState(null);

  useEffect(() => { fetchPlans(); }, []);

  const fetchPlans = async () => {
    try {
      const res = await axios.get(`${API}/admin/plans`);
      setPlans(res.data);
    } catch {
      toast.error('Erreur chargement plans');
    } finally {
      setLoading(false);
    }
  };

  const startEdit = (plan) => {
    setEditingPlan(plan.id);
    setEditForm({ ...plan, features: [...(plan.features || [])] });
  };

  const cancelEdit = () => {
    setEditingPlan(null);
    setEditForm({});
    setNewFeature('');
  };

  const savePlan = async () => {
    setSaving(true);
    try {
      await axios.put(`${API}/admin/plans/${editForm.id}`, editForm);
      toast.success(lang === 'fr' ? 'Plan mis à jour !' : 'Plan updated!');
      setEditingPlan(null);
      fetchPlans();
    } catch {
      toast.error('Erreur');
    } finally {
      setSaving(false);
    }
  };

  const createPlan = async () => {
    setSaving(true);
    try {
      const newPlan = {
        ...editForm,
        id: editForm.name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, ''),
        order: plans.length + 1
      };
      await axios.post(`${API}/admin/plans`, newPlan);
      toast.success(lang === 'fr' ? 'Plan créé !' : 'Plan created!');
      setShowNewPlan(false);
      setEditForm({});
      fetchPlans();
    } catch (err) {
      toast.error('Erreur: ' + (err.response?.data?.detail || 'Unknown'));
    } finally {
      setSaving(false);
    }
  };

  const deletePlan = async (planId) => {
    try {
      const res = await axios.delete(`${API}/admin/plans/${planId}`);
      if (res.data.success) {
        toast.success(lang === 'fr' ? 'Plan supprimé' : 'Plan deleted');
        fetchPlans();
      } else {
        toast.error(res.data.message);
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur suppression');
    } finally {
      setDeletingPlan(null);
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

  const startNewPlan = () => {
    setShowNewPlan(true);
    setEditForm({ ...DEFAULT_NEW_PLAN });
  };

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-heading font-800">{lang === 'fr' ? 'Plans & Tarification' : 'Plans & Pricing'}</h1>
          <p className="text-sm text-muted-foreground">{lang === 'fr' ? 'Gérez les plans d\'abonnement, ajoutez ou supprimez des plans' : 'Manage subscription plans, add or remove plans'}</p>
        </div>
        <Button 
          onClick={startNewPlan}
          className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 font-heading font-700"
          data-testid="create-plan-btn"
        >
          <Plus className="w-4 h-4 mr-2" />
          {lang === 'fr' ? 'Nouveau Plan' : 'New Plan'}
        </Button>
      </div>

      {/* New Plan Modal */}
      {showNewPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setShowNewPlan(false)}>
          <div 
            className="bg-card rounded-2xl w-full max-w-lg p-6 shadow-xl animate-slide-up max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
            data-testid="new-plan-modal"
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-heading font-800 text-lg">{lang === 'fr' ? 'Créer un nouveau plan' : 'Create new plan'}</h2>
              <button onClick={() => setShowNewPlan(false)} className="p-1 rounded-full hover:bg-muted">
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>
            
            <PlanForm 
              form={editForm} 
              setForm={setEditForm} 
              newFeature={newFeature}
              setNewFeature={setNewFeature}
              addFeature={addFeature}
              removeFeature={removeFeature}
              lang={lang}
            />
            
            <div className="flex gap-2 mt-5">
              <Button onClick={() => setShowNewPlan(false)} variant="outline" className="flex-1 rounded-full h-10 font-heading font-700">
                {lang === 'fr' ? 'Annuler' : 'Cancel'}
              </Button>
              <Button onClick={createPlan} disabled={saving} className="flex-1 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 h-10 font-heading font-700" data-testid="save-new-plan-btn">
                {saving ? '...' : (lang === 'fr' ? 'Créer le plan' : 'Create plan')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-card rounded-2xl w-full max-w-sm p-6 shadow-xl animate-slide-up" data-testid="delete-plan-modal">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-100 dark:bg-red-900/20 rounded-xl flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <h3 className="font-heading font-800">{lang === 'fr' ? 'Supprimer le plan' : 'Delete plan'}</h3>
                <p className="text-xs text-muted-foreground">{deletingPlan.name}</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mb-5">
              {lang === 'fr' 
                ? 'Êtes-vous sûr de vouloir supprimer ce plan ? Cette action est irréversible.' 
                : 'Are you sure you want to delete this plan? This action cannot be undone.'}
            </p>
            <div className="flex gap-2">
              <Button onClick={() => setDeletingPlan(null)} variant="outline" className="flex-1 rounded-full h-10 font-heading font-700">
                {lang === 'fr' ? 'Annuler' : 'Cancel'}
              </Button>
              <Button onClick={() => deletePlan(deletingPlan.id)} className="flex-1 rounded-full bg-red-500 hover:bg-red-600 text-white h-10 font-heading font-700" data-testid="confirm-delete-btn">
                {lang === 'fr' ? 'Supprimer' : 'Delete'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center h-48 items-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-5">
          {plans.map(plan => (
            <div key={plan.id} className="bg-card rounded-2xl border border-border/50 card-shadow overflow-hidden" data-testid={`plan-card-${plan.id}`}>
              {/* Color bar */}
              <div className="h-1.5" style={{ background: plan.color || '#15803d' }} />

              <div className="p-5">
                {editingPlan === plan.id ? (
                  /* Edit mode */
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-heading font-800 text-base">{lang === 'fr' ? 'Modifier le plan' : 'Edit plan'}</h3>
                      <button onClick={cancelEdit} className="p-1 rounded-full hover:bg-muted">
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <PlanForm 
                      form={editForm} 
                      setForm={setEditForm} 
                      newFeature={newFeature}
                      setNewFeature={setNewFeature}
                      addFeature={addFeature}
                      removeFeature={removeFeature}
                      lang={lang}
                    />

                    <div className="flex gap-2">
                      <Button onClick={cancelEdit} variant="outline" className="flex-1 rounded-full h-9 font-heading font-700 text-sm">
                        {lang === 'fr' ? 'Annuler' : 'Cancel'}
                      </Button>
                      <Button onClick={savePlan} disabled={saving} className="flex-1 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 h-9 font-heading font-700 text-sm" data-testid="save-plan-btn">
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
                          <span className="text-3xl font-heading font-800" style={{ color: plan.color }}>
                            {plan.price === 0 ? (lang === 'fr' ? 'Gratuit' : 'Free') : `${plan.price}€`}
                          </span>
                          {plan.price > 0 && <span className="text-xs text-muted-foreground">{lang === 'fr' ? '/mois' : '/mo'}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className={`w-2 h-2 rounded-full ${plan.is_active ? 'bg-primary' : 'bg-muted-foreground'}`} title={plan.is_active ? 'Actif' : 'Inactif'} />
                        <button onClick={() => startEdit(plan)} className="p-1.5 rounded-lg hover:bg-muted transition-colors" data-testid={`edit-plan-${plan.id}`}>
                          <Edit2 className="w-4 h-4 text-muted-foreground" />
                        </button>
                        <button onClick={() => setDeletingPlan(plan)} className="p-1.5 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/20 transition-colors" data-testid={`delete-plan-${plan.id}`}>
                          <Trash2 className="w-4 h-4 text-muted-foreground hover:text-red-500" />
                        </button>
                      </div>
                    </div>

                    {/* Limits */}
                    <div className="grid grid-cols-3 gap-2 mb-3">
                      {[
                        { label: lang === 'fr' ? 'RDV/mois' : 'Appts/mo', val: plan.appointments_per_month === -1 ? '∞' : plan.appointments_per_month },
                        { label: 'Staff', val: plan.staff_members === -1 ? '∞' : plan.staff_members },
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
                      {(plan.features || []).slice(0, 5).map((f, i) => (
                        <li key={i} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <CheckCircle className="w-3 h-3 text-primary flex-shrink-0" />
                          {f}
                        </li>
                      ))}
                      {(plan.features || []).length > 5 && (
                        <li className="text-xs text-muted-foreground pl-4.5">+{plan.features.length - 5} {lang === 'fr' ? 'autres' : 'more'}...</li>
                      )}
                    </ul>

                    {plan.trial_days > 0 && (
                      <div className="mt-2 text-xs text-primary font-heading font-600">
                        {plan.trial_days} {lang === 'fr' ? "jours d'essai gratuit" : 'days free trial'}
                      </div>
                    )}
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

function PlanForm({ form, setForm, newFeature, setNewFeature, addFeature, removeFeature, lang }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs font-heading font-600">{lang === 'fr' ? 'Nom du plan' : 'Plan name'}</Label>
          <Input 
            value={form.name || ''} 
            onChange={e => setForm(p => ({ ...p, name: e.target.value }))} 
            className="h-9 rounded-xl text-sm" 
            data-testid="plan-name-input" 
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs font-heading font-600">{lang === 'fr' ? 'Prix (€/mois)' : 'Price (€/mo)'}</Label>
          <Input 
            type="number" 
            value={form.price || 0} 
            onChange={e => setForm(p => ({ ...p, price: parseFloat(e.target.value) }))} 
            className="h-9 rounded-xl text-sm" 
            data-testid="plan-price-input" 
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs font-heading font-600">{lang === 'fr' ? 'RDV/mois (-1=∞)' : 'Appts/mo (-1=∞)'}</Label>
          <Input 
            type="number" 
            value={form.appointments_per_month || 0} 
            onChange={e => setForm(p => ({ ...p, appointments_per_month: parseInt(e.target.value) }))} 
            className="h-9 rounded-xl text-sm" 
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs font-heading font-600">Staff (-1=∞)</Label>
          <Input 
            type="number" 
            value={form.staff_members || 0} 
            onChange={e => setForm(p => ({ ...p, staff_members: parseInt(e.target.value) }))} 
            className="h-9 rounded-xl text-sm" 
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs font-heading font-600">SMS (-1=∞)</Label>
          <Input 
            type="number" 
            value={form.sms_notifications || 0} 
            onChange={e => setForm(p => ({ ...p, sms_notifications: parseInt(e.target.value) }))} 
            className="h-9 rounded-xl text-sm" 
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs font-heading font-600">{lang === 'fr' ? 'Jours essai' : 'Trial days'}</Label>
          <Input 
            type="number" 
            value={form.trial_days || 0} 
            onChange={e => setForm(p => ({ ...p, trial_days: parseInt(e.target.value) }))} 
            className="h-9 rounded-xl text-sm" 
          />
        </div>
        <div className="space-y-1 col-span-2">
          <Label className="text-xs font-heading font-600">{lang === 'fr' ? 'Couleur' : 'Color'}</Label>
          <div className="flex gap-2">
            <input 
              type="color" 
              value={form.color || '#3b82f6'} 
              onChange={e => setForm(p => ({ ...p, color: e.target.value }))} 
              className="w-9 h-9 rounded-lg border border-border cursor-pointer"
            />
            <Input 
              value={form.color || '#3b82f6'} 
              onChange={e => setForm(p => ({ ...p, color: e.target.value }))} 
              className="h-9 rounded-xl text-sm flex-1 font-mono" 
            />
          </div>
        </div>
      </div>

      {/* Features */}
      <div>
        <Label className="text-xs font-heading font-600 mb-2 block">{lang === 'fr' ? 'Fonctionnalités' : 'Features'}</Label>
        <div className="space-y-1 mb-2 max-h-32 overflow-y-auto">
          {(form.features || []).map((f, i) => (
            <div key={i} className="flex items-center gap-2 text-xs bg-muted/50 rounded-lg px-2 py-1.5">
              <GripVertical className="w-3 h-3 text-muted-foreground/50 flex-shrink-0" />
              <CheckCircle className="w-3 h-3 text-primary flex-shrink-0" />
              <span className="flex-1">{f}</span>
              <button onClick={() => removeFeature(i)} className="text-muted-foreground hover:text-red-500 transition-colors">
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <Input 
            value={newFeature} 
            onChange={e => setNewFeature(e.target.value)} 
            onKeyDown={e => e.key === 'Enter' && addFeature()} 
            placeholder={lang === 'fr' ? 'Ajouter une fonctionnalité...' : 'Add feature...'} 
            className="h-8 rounded-xl text-xs flex-1" 
          />
          <Button size="sm" onClick={addFeature} className="h-8 rounded-xl bg-primary text-primary-foreground px-3">
            <Plus className="w-3 h-3" />
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-3 pt-2 border-t border-border/50">
        <Switch checked={form.is_active} onCheckedChange={v => setForm(p => ({ ...p, is_active: v }))} />
        <span className="text-xs font-heading font-600">{lang === 'fr' ? 'Plan actif' : 'Plan active'}</span>
      </div>
    </div>
  );
}
