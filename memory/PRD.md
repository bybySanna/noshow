# NoShowGone - PRD

## Problème
SaaS anti no-show permettant aux entreprises (restaurants, salons, coachs) de réduire les absences aux RDV via confirmations automatisées, rappels et dépôts de garantie.

## Architecture
- **Frontend**: React (mobile-first, dark/light mode, bilingue FR/EN)
- **Backend**: FastAPI + MongoDB
- **Auth**: JWT custom
- **URL**: https://appointment-armor.preview.emergentagent.com

## Ce qui est implémenté (Session Février 2025)

### ✅ Phase 1 - Core Features (Complète)
- Authentification JWT avec 4 rôles (Super Admin, Business, Staff, Client)
- CRUD rendez-vous avec statuts (pending, confirmed, cancelled, no_show, completed)
- Page de confirmation client avec lien unique
- Dashboards pour tous les rôles
- Vue calendrier hebdomadaire
- Gestion clients avec score de fiabilité
- Analytics et statistiques

### ✅ Phase 2 - ML Scoring & Intégrations (Session courante)

#### Système ML de Scoring No-Show
- **Algorithme** avec 6 facteurs pondérés :
  - Historique no-shows (35%)
  - Taux de confirmation (25%)
  - Récence (15%)
  - Pattern de réservation (10%)
  - Ancienneté client (10%)
  - Dépôt payé (5%)
- **Page /ml-scoring** avec distribution des risques
- **Endpoints**: `/api/ml/risk-overview`, `/api/ml/score-appointment/{id}`
- **Actions suggérées**: Dépôt obligatoire, rappels supplémentaires

#### Import Google Calendar (Simulation)
- **OAuth flow** simulé pour connexion
- **Sync automatique** des événements → RDV
- **Source visible** dans la liste des RDV (badge calendrier)
- **Statut initial**: Non confirmé → notifications auto

#### Préparation API Externes
- **TheFork** (LaFourchette) - Structure webhook prête
- **OpenTable** - Structure webhook prête
- **API Personnalisée** - Pour systèmes de réservation custom
- **Mapping automatique** des champs (nom, téléphone, date, nb personnes)

#### Templates de Messages Éditables
- **6 templates par défaut**: Confirmation, Rappel 24h/3h/30min, Annulation, Report
- **Variables dynamiques**: {{client_name}}, {{date}}, {{time}}, {{business_name}}, etc.
- **Multi-canaux**: Email, SMS, WhatsApp par template
- **Prévisualisation** avant envoi
- **Page /templates** pour personnalisation

#### Gestion des Plans Admin (CRUD)
- **Créer** nouveaux plans
- **Modifier** prix, limites, fonctionnalités
- **Supprimer** plans (si non utilisés)
- **Page /admin/plans** avec interface complète

#### Affichage Source RDV
- **Filtre par source** dans la liste des RDV
- **Badge visuel** pour identifier la source (Manuel, Google Cal, TheFork, etc.)
- **Sources supportées**: manual, google_calendar, api_thefork, api_opentable

### Services en Mode Simulation
- **NotificationService**: Queue, retry, logs, templates (prêt pour Twilio)
- **StripeService**: Abonnements, dépôts (prêt pour Stripe)
- **CalendarIntegrationService**: Google OAuth, sync (prêt pour vraies clés)
- **TemplateService**: Gestion templates avec fallback
- **MLScoringService**: Algorithme de prédiction

## Structure des Pages

### Business (/dashboard)
| Route | Description |
|-------|-------------|
| /dashboard | KPIs, quick links |
| /appointments | Liste RDV + filtre source |
| /calendar | Vue hebdomadaire |
| /analytics | Charts, stats |
| /clients | Gestion clients |
| /ml-scoring | Scoring prédictif ML |
| /clients-risk | Blacklist, alertes |
| /notifications | Historique notifs |
| /templates | Édition messages |
| /integrations | Google Cal, APIs |
| /staff | Équipe |
| /settings | Paramètres |

### Admin (/admin)
| Route | Description |
|-------|-------------|
| /admin | Dashboard global |
| /admin/businesses | Gestion entreprises |
| /admin/plans | CRUD plans (créer/modifier/supprimer) |
| /admin/users | Utilisateurs |
| /admin/activity | Logs activité |
| /admin/stats | Analytics plateforme |

## Backlog P0 (Bloqué - Clés API requises)
- [ ] Intégration Stripe réelle
- [ ] Intégration Twilio réelle
- [ ] OAuth Google réel

## Backlog P1 (Prêt à implémenter)
- [ ] Multi-canaux fallback (SMS → Email si échec)
- [ ] Onboarding enrichi (fuseau horaire, horaires)
- [ ] Widget "Argent économisé" landing page
- [ ] Rapports PDF exportables

## Backlog P2 (Futur)
- [ ] Outlook / iCal intégration
- [ ] App mobile native
- [ ] Scoring ML avancé avec apprentissage

## Comptes Démo
- **Admin**: admin@noshow.com / admin123456
- **Business**: demo@bellanapoli.com / demo123456

## Structure Code
```
/app/
├── backend/
│   ├── server.py
│   └── services/
│       ├── ml_scoring_service.py
│       ├── calendar_integration_service.py
│       ├── template_service.py
│       ├── notification_service.py
│       └── stripe_service.py
├── frontend/
│   └── src/
│       ├── pages/
│       │   ├── business/
│       │   │   ├── MLScoringPage.js
│       │   │   ├── IntegrationsPage.js
│       │   │   ├── TemplatesPage.js
│       │   │   └── ...
│       │   └── admin/
│       │       └── AdminPlans.js (CRUD)
│       └── components/
│           └── BusinessLayout.js
└── memory/
    └── PRD.md
```
