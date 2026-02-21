import React, { createContext, useContext, useState, useEffect } from 'react';

const LangContext = createContext(null);

const translations = {
  fr: {
    // Navigation
    dashboard: 'Tableau de bord',
    appointments: 'Rendez-vous',
    staff: 'Équipe',
    settings: 'Paramètres',
    analytics: 'Statistiques',
    notifications: 'Notifications',
    logout: 'Déconnexion',
    // Auth
    login: 'Connexion',
    register: "S'inscrire",
    email: 'Email',
    password: 'Mot de passe',
    full_name: 'Nom complet',
    forgot_password: 'Mot de passe oublié ?',
    no_account: "Pas encore de compte ?",
    has_account: 'Déjà un compte ?',
    // Appointments
    new_appointment: 'Nouveau RDV',
    client_name: 'Nom du client',
    client_phone: 'Téléphone',
    client_email: 'Email (optionnel)',
    date: 'Date',
    time: 'Heure',
    service: 'Service',
    note: 'Note (optionnel)',
    save: 'Enregistrer',
    cancel: 'Annuler',
    confirm: 'Confirmer',
    delete: 'Supprimer',
    edit: 'Modifier',
    // Status
    status_confirmed: 'Confirmé',
    status_pending: 'En attente',
    status_no_show: 'Absent',
    status_cancelled: 'Annulé',
    status_completed: 'Terminé',
    status_rescheduled: 'Reporté',
    // Stats
    total_appointments: 'Total RDV',
    no_show_rate: 'Taux d\'absence',
    money_saved: 'Argent économisé',
    this_week: 'Cette semaine',
    today: "Aujourd'hui",
    // Plans
    free_trial: 'Essai Gratuit',
    solo: 'Solo',
    pro: 'Pro',
    business: 'Business',
    // Actions
    send_reminder: 'Envoyer rappel',
    mark_no_show: 'Marquer absent',
    mark_completed: 'Marquer terminé',
    add: 'Ajouter',
    search: 'Rechercher...',
    loading: 'Chargement...',
    // Onboarding
    setup_business: 'Configurer votre établissement',
    business_name: 'Nom de l\'établissement',
    business_type: 'Type d\'activité',
    timezone: 'Fuseau horaire',
    phone: 'Téléphone',
    // Misc
    welcome: 'Bienvenue',
    back: 'Retour',
    next: 'Suivant',
    finish: 'Terminer',
    or: 'ou',
    all: 'Tous',
  },
  en: {
    // Navigation
    dashboard: 'Dashboard',
    appointments: 'Appointments',
    staff: 'Staff',
    settings: 'Settings',
    analytics: 'Analytics',
    notifications: 'Notifications',
    logout: 'Log out',
    // Auth
    login: 'Login',
    register: 'Sign Up',
    email: 'Email',
    password: 'Password',
    full_name: 'Full Name',
    forgot_password: 'Forgot password?',
    no_account: "Don't have an account?",
    has_account: 'Already have an account?',
    // Appointments
    new_appointment: 'New Appointment',
    client_name: 'Client Name',
    client_phone: 'Phone',
    client_email: 'Email (optional)',
    date: 'Date',
    time: 'Time',
    service: 'Service',
    note: 'Note (optional)',
    save: 'Save',
    cancel: 'Cancel',
    confirm: 'Confirm',
    delete: 'Delete',
    edit: 'Edit',
    // Status
    status_confirmed: 'Confirmed',
    status_pending: 'Pending',
    status_no_show: 'No Show',
    status_cancelled: 'Cancelled',
    status_completed: 'Completed',
    status_rescheduled: 'Rescheduled',
    // Stats
    total_appointments: 'Total Appointments',
    no_show_rate: 'No-show Rate',
    money_saved: 'Money Saved',
    this_week: 'This Week',
    today: 'Today',
    // Plans
    free_trial: 'Free Trial',
    solo: 'Solo',
    pro: 'Pro',
    business: 'Business',
    // Actions
    send_reminder: 'Send Reminder',
    mark_no_show: 'Mark No-Show',
    mark_completed: 'Mark Completed',
    add: 'Add',
    search: 'Search...',
    loading: 'Loading...',
    // Onboarding
    setup_business: 'Set Up Your Business',
    business_name: 'Business Name',
    business_type: 'Business Type',
    timezone: 'Timezone',
    phone: 'Phone',
    // Misc
    welcome: 'Welcome',
    back: 'Back',
    next: 'Next',
    finish: 'Finish',
    or: 'or',
    all: 'All',
  }
};

export const LangProvider = ({ children }) => {
  const [lang, setLang] = useState(() => localStorage.getItem('noshow_lang') || 'fr');

  const t = (key) => translations[lang][key] || translations['en'][key] || key;

  const toggleLang = () => {
    const newLang = lang === 'fr' ? 'en' : 'fr';
    setLang(newLang);
    localStorage.setItem('noshow_lang', newLang);
  };

  return (
    <LangContext.Provider value={{ lang, t, toggleLang, translations }}>
      {children}
    </LangContext.Provider>
  );
};

export const useLang = () => {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error('useLang must be used within LangProvider');
  return ctx;
};
