# NoShowGone - PRD

## Problème
SaaS anti no-show permettant aux entreprises de réduire les absences aux RDV.

## Architecture
- Frontend: React (mobile-first, dark/light mode, bilingual FR/EN)
- Backend: FastAPI + MongoDB
- Auth: JWT custom
- Deployed: https://parfait-app-7.preview.emergentagent.com

## Rôles
- super_admin: admin@noshow.com / admin123456
- business_owner: demo@bellanapoli.com / demo123456
- staff: accès limité RDV uniquement

## Ce qui est implémenté (Jan 2025)

### Backend (/api/)
- Auth: register, login, me, forgot-password
- Businesses: CRUD, reminders settings, deposit settings
- Appointments: CRUD, send-reminder, bulk-status, today, upcoming, export, confirm/token
- Notifications: list, retry
- Stats: business stats, weekly stats
- Staff: CRUD
- Clients: risk-scores, blacklist CRUD
- Admin: dashboard, businesses list, business details, plans CRUD, users, activity, stats, toggle biz, update plan, send message

### Frontend Pages
- / Landing page marketing
- /login /register /onboarding
- /dashboard Business dashboard (stats + today's RDVs + upcoming)
- /appointments List avec search/filter + detail modal + actions
- /analytics Charts + KPIs + argent économisé
- /notifications Historique notifications
- /staff Gestion équipe
- /settings Tabs: Établissement, Rappels, Dépôt
- /clients-risk Score risque + blacklist clients
- /confirm/:token Page publique confirmation client
- /admin Admin dashboard + KPIs + graphiques
- /admin/businesses Liste + détails complets + plan management + message
- /admin/plans Gestion plans et prix (CRUD)
- /admin/users Liste utilisateurs
- /admin/activity Activité globale tous RDVs
- /admin/stats Analytics plateforme
- /staff-dashboard Dashboard staff simplifié

## Backlog P0
- Vraies notifications email/WhatsApp/SMS (Twilio, Resend)
- Intégration Stripe réelle (dépôts + abonnements)
- Google Auth
- Calendrier vue hebdomadaire business
- Rapports PDF exportables

## Backlog P1
- App mobile native (React Native)
- Multi-langue supplémentaire (ES, DE, AR)
- Webhooks entreprise
- Intégration Google Calendar
- Scoring no-show ML avancé

## Comptes démo permanents
- Restaurant Bella Napoli (Pro plan, 8 RDVs avec différents statuts)
- Super admin toujours disponible
