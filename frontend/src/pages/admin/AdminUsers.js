import React, { useState, useEffect } from 'react';
import { Users, Building2, Shield, Calendar, Search } from 'lucide-react';
import { Input } from '../../components/ui/input';
import AdminLayout from '../../components/AdminLayout';
import { useLang } from '../../context/LangContext';
import axios from 'axios';
import { API } from '../../context/AuthContext';
import { toast } from 'sonner';
import { cn } from '../../lib/utils';

const ROLE_CONFIG = {
  super_admin: { label_fr: 'Super Admin', label_en: 'Super Admin', className: 'bg-accent/10 text-accent' },
  business_owner: { label_fr: 'Entreprise', label_en: 'Business', className: 'bg-primary/10 text-primary' },
  staff: { label_fr: 'Staff', label_en: 'Staff', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
};

export default function AdminUsers() {
  const { lang } = useLang();
  const [users, setUsers] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => { fetchUsers(); }, []);

  useEffect(() => {
    if (!search) { setFiltered(users); return; }
    const q = search.toLowerCase();
    setFiltered(users.filter(u => u.email?.toLowerCase().includes(q) || u.full_name?.toLowerCase().includes(q)));
  }, [search, users]);

  const fetchUsers = async () => {
    try {
      const res = await axios.get(`${API}/admin/users`);
      setUsers(res.data);
      setFiltered(res.data);
    } catch { toast.error('Error'); }
    finally { setLoading(false); }
  };

  const roleCount = {
    super_admin: users.filter(u => u.role === 'super_admin').length,
    business_owner: users.filter(u => u.role === 'business_owner').length,
    staff: users.filter(u => u.role === 'staff').length,
  };

  return (
    <AdminLayout>
      <div className="mb-5">
        <h1 className="text-2xl font-heading font-800">{lang === 'fr' ? 'Utilisateurs' : 'Users'}</h1>
        <p className="text-sm text-muted-foreground">{users.length} {lang === 'fr' ? 'comptes au total' : 'total accounts'}</p>
      </div>

      {/* Role summary */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        {[
          { role: 'super_admin', icon: Shield, label_fr: 'Admins', label_en: 'Admins' },
          { role: 'business_owner', icon: Building2, label_fr: 'Entreprises', label_en: 'Businesses' },
          { role: 'staff', icon: Users, label_fr: 'Staff', label_en: 'Staff' },
        ].map((r, i) => (
          <div key={i} className="bg-card rounded-xl p-4 border border-border/50 text-center card-shadow">
            <r.icon className="w-5 h-5 text-muted-foreground mx-auto mb-1.5" />
            <div className="text-xl font-heading font-800 text-primary">{roleCount[r.role]}</div>
            <div className="text-xs text-muted-foreground">{lang === 'fr' ? r.label_fr : r.label_en}</div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder={lang === 'fr' ? 'Rechercher...' : 'Search...'} className="pl-9 h-10 rounded-xl" />
      </div>

      {loading ? (
        <div className="flex justify-center h-48 items-center">
          <div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(user => {
            const roleConf = ROLE_CONFIG[user.role] || ROLE_CONFIG.staff;
            return (
              <div key={user.id} className="bg-card rounded-xl border border-border/50 p-4 flex items-center gap-3" data-testid="admin-user-row">
                <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="font-heading font-700 text-primary text-sm">{user.full_name?.charAt(0)?.toUpperCase()}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-heading font-700 text-sm">{user.full_name}</p>
                  <p className="text-xs text-muted-foreground">{user.email}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={cn("text-[11px] font-heading font-700 px-2 py-0.5 rounded-full", roleConf.className)}>
                    {lang === 'fr' ? roleConf.label_fr : roleConf.label_en}
                  </span>
                  <div className={`w-2 h-2 rounded-full ${user.is_active !== false ? 'bg-primary' : 'bg-muted-foreground'}`} title={user.is_active !== false ? 'Active' : 'Inactive'} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </AdminLayout>
  );
}
