import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Users, Shield } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import BusinessLayout from '../../components/BusinessLayout';
import { useLang } from '../../context/LangContext';
import axios from 'axios';
import { API } from '../../context/AuthContext';
import { toast } from 'sonner';

export default function StaffPage() {
  const { lang } = useLang();
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ email: '', full_name: '', password: '' });
  const [adding, setAdding] = useState(false);

  useEffect(() => { fetchStaff(); }, []);

  const fetchStaff = async () => {
    try {
      const res = await axios.get(`${API}/staff`);
      setStaff(res.data);
    } catch {
      toast.error('Error');
    } finally {
      setLoading(false);
    }
  };

  const addStaff = async (e) => {
    e.preventDefault();
    if (!form.email || !form.full_name || !form.password) return;
    setAdding(true);
    try {
      await axios.post(`${API}/staff`, form);
      toast.success(lang === 'fr' ? 'Membre ajouté !' : 'Staff member added!');
      setForm({ email: '', full_name: '', password: '' });
      setShowAdd(false);
      fetchStaff();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error');
    } finally {
      setAdding(false);
    }
  };

  const removeStaff = async (id, name) => {
    if (!window.confirm(lang === 'fr' ? `Supprimer ${name} ?` : `Remove ${name}?`)) return;
    try {
      await axios.delete(`${API}/staff/${id}`);
      toast.success(lang === 'fr' ? 'Membre supprimé' : 'Staff removed');
      fetchStaff();
    } catch {
      toast.error('Error');
    }
  };

  return (
    <BusinessLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-heading font-800">
            {lang === 'fr' ? 'Équipe' : 'Staff'}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {staff.length} {lang === 'fr' ? 'membre(s)' : 'member(s)'}
          </p>
        </div>
        <Button
          onClick={() => setShowAdd(!showAdd)}
          className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 font-heading font-700"
          data-testid="add-staff-btn"
        >
          <Plus className="w-4 h-4 mr-2" />
          {lang === 'fr' ? 'Ajouter' : 'Add'}
        </Button>
      </div>

      {/* Add staff form */}
      {showAdd && (
        <div className="bg-card rounded-2xl border border-border/50 p-5 mb-5 card-shadow" data-testid="add-staff-form">
          <h3 className="font-heading font-700 text-base mb-4">
            {lang === 'fr' ? 'Nouveau membre' : 'New Staff Member'}
          </h3>
          <form onSubmit={addStaff} className="space-y-3">
            <Input
              value={form.full_name}
              onChange={e => setForm(p => ({ ...p, full_name: e.target.value }))}
              placeholder={lang === 'fr' ? 'Nom complet' : 'Full name'}
              className="h-11 rounded-xl"
              required
              data-testid="staff-name-input"
            />
            <Input
              type="email"
              value={form.email}
              onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
              placeholder="email@example.com"
              className="h-11 rounded-xl"
              required
              data-testid="staff-email-input"
            />
            <Input
              type="password"
              value={form.password}
              onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
              placeholder={lang === 'fr' ? 'Mot de passe' : 'Password'}
              className="h-11 rounded-xl"
              required
              minLength={8}
              data-testid="staff-password-input"
            />
            <div className="p-3 bg-muted/50 rounded-xl">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Shield className="w-3.5 h-3.5 text-primary" />
                <span>
                  {lang === 'fr'
                    ? 'Accès limité : RDV uniquement. Pas d\'accès aux paiements ni paramètres.'
                    : 'Limited access: Appointments only. No payment or settings access.'}
                </span>
              </div>
            </div>
            <div className="flex gap-2">
              <Button type="submit" className="flex-1 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 font-heading font-700" disabled={adding} data-testid="staff-submit-btn">
                {adding ? '...' : (lang === 'fr' ? 'Ajouter' : 'Add')}
              </Button>
              <Button type="button" variant="outline" className="rounded-full" onClick={() => setShowAdd(false)}>
                {lang === 'fr' ? 'Annuler' : 'Cancel'}
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Staff list */}
      {loading ? (
        <div className="flex justify-center h-32 items-center">
          <div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : staff.length === 0 ? (
        <div className="bg-card rounded-xl border border-border/50 p-12 text-center">
          <Users className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="font-heading font-700 text-sm">
            {lang === 'fr' ? 'Aucun membre d\'équipe' : 'No staff members'}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {lang === 'fr' ? 'Ajoutez des membres pour qu\'ils puissent gérer les RDV' : 'Add members to manage appointments'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {staff.map(member => (
            <div key={member.id} className="bg-card rounded-xl border border-border/50 p-4 flex items-center gap-3" data-testid="staff-row">
              <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="font-heading font-700 text-sm text-primary">
                  {member.full_name?.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-heading font-700 text-sm">{member.full_name}</p>
                <p className="text-xs text-muted-foreground">{member.email}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-heading font-600 text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                  {lang === 'fr' ? 'Staff' : 'Staff'}
                </span>
                <button
                  onClick={() => removeStaff(member.id, member.full_name)}
                  className="p-1.5 rounded-full hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                  data-testid="remove-staff-btn"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </BusinessLayout>
  );
}
