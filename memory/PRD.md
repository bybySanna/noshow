# NoShowGone - PRD

## Problème
SaaS anti no-show permettant aux entreprises (restaurants, salons, coachs) de réduire les absences aux RDV via confirmations automatisées, rappels et dépôts de garantie.

## Architecture
- **Frontend**: React (mobile-first, dark/light mode, bilingue FR/EN)
- **Backend**: FastAPI + MongoDB
- **Auth**: JWT custom
- **URL**: https://no-show-reduction.preview.emergentagent.com

## Rôles
1. **Super Admin**: admin@noshow.com / admin123456 - Gestion plateforme SaaS
2. **Business Owner**: demo@bellanapoli.com / demo123456 - Gestion de son établissement
3. **Staff**: Accès limité RDV (vue + création)
4. **Client final**: Pas de compte, interaction via lien unique de confirmation

## Ce qui est implémenté (Fév 2025)

### Backend (/api/)
- **Auth**: register, login, me, forgot-password, reset-password
- **Businesses**: CRUD, reminders settings, deposit settings
- **Appointments**: CRUD, send-reminder, bulk-status, today, upcoming, export, calendar, confirm/token
- **Notifications**: list, retry, stats
- **Payments (SIMULATION)**: subscription, cancel-subscription, deposit-checkout, simulate-deposit, stats
- **Stats**: business stats, weekly stats, public stats
- **Staff**: CRUD
- **Clients**: liste avec scores fiabilité, historique, risk-scores, blacklist CRUD
- **Admin**: dashboard, businesses, business details, plans CRUD, users, activity, stats, revenue, system-health, broadcast, toggle biz, update plan

### Frontend Pages
| Route | Description | Rôle |
|-------|-------------|------|
| `/` | Landing page marketing | Public |
| `/login` `/register` | Authentification | Public |
| `/onboarding` | Configuration business | Business |
| `/dashboard` | Tableau de bord avec KPIs et quick links | Business |
| `/appointments` | Liste RDV avec search/filter + actions | Business |
| `/calendar` | Vue calendrier hebdomadaire | Business |
| `/analytics` | Charts + KPIs + argent économisé | Business |
| `/notifications` | Historique notifications | Business |
| `/clients` | Gestion clients avec score fiabilité | Business |
| `/clients-risk` | Score risque + blacklist | Business |
| `/staff` | Gestion équipe | Business |
| `/settings` | Paramètres (établissement, rappels, dépôt) | Business |
| `/confirm/:token` | Confirmation client (confirmer/annuler/reporter) | Public |
| `/admin` | Dashboard admin avec KPIs, graphiques, broadcast | Admin |
| `/admin/businesses` | Liste + détails + plan management | Admin |
| `/admin/plans` | Gestion plans et prix (CRUD) | Admin |
| `/admin/users` | Liste utilisateurs | Admin |
| `/admin/activity` | Activité globale tous RDVs | Admin |
| `/admin/stats` | Analytics plateforme | Admin |
| `/staff-dashboard` | Dashboard staff simplifié | Staff |

### Services en Mode Simulation
- **NotificationService**: Queue, retry, logs, templates (prêt pour Twilio)
- **StripeService**: Abonnements, dépôts (prêt pour intégration Stripe)

## Bugs corrigés cette session
1. ✅ **Bug reprogrammation** (ConfirmPage.js): Le formulaire ne s'ouvrait pas correctement car `newDate` était utilisé à la fois comme flag de visibilité et comme valeur. Corrigé avec `showReschedule` (boolean) séparé.
2. ✅ **Bug ordre routes** (server.py): Les routes `/appointments/calendar`, `/today`, etc. étaient matchées par `/appointments/{id}`. Routes spécifiques déplacées avant les routes paramétriques.

## Backlog P0 (Prioritaire)
- [ ] Intégration Stripe réelle (dépôts + abonnements) - nécessite clés API
- [ ] Intégration Twilio réelle (SMS/WhatsApp) - nécessite clés API
- [ ] Widget "Argent économisé" sur landing page avec vraies stats

## Backlog P1 (Important)
- [ ] Rapports PDF exportables
- [ ] Intégration Google Calendar
- [ ] Google Auth (login social)

## Backlog P2 (Nice to have)
- [ ] App mobile native (React Native)
- [ ] Multi-langue supplémentaire (ES, DE)
- [ ] Webhooks entreprise pour intégrations tierces
- [ ] Scoring no-show ML avancé

## Comptes démo permanents
- **Restaurant Bella Napoli**: Pro plan, données de démo avec différents statuts RDV
- **Super admin**: Toujours disponible

## Structure du code
```
/app/
├── backend/
│   ├── server.py (API principale)
│   ├── services/
│   │   ├── notification_service.py (simulation Twilio)
│   │   └── stripe_service.py (simulation Stripe)
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── admin/ (Dashboard, Businesses, Plans, Users, Activity, Stats)
│   │   │   ├── business/ (Dashboard, Appointments, Calendar, Clients, Analytics, etc.)
│   │   │   ├── staff/ (StaffDashboard)
│   │   │   └── public/ (ConfirmPage)
│   │   ├── components/ (BusinessLayout, AdminLayout, UI components)
│   │   └── context/ (Auth, Theme, Lang)
│   └── package.json
└── memory/
    └── PRD.md
```
