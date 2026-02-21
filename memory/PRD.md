# NoShowGone - PRD

## Problème
SaaS anti no-show permettant aux entreprises (restaurants, salons, coachs) de réduire les absences aux RDV via confirmations automatisées, rappels et dépôts de garantie.

## Architecture
- **Frontend**: React (mobile-first, dark/light mode, bilingue FR/EN)
- **Backend**: FastAPI + MongoDB
- **Auth**: JWT custom
- **URL**: https://appointment-armor.preview.emergentagent.com

## Ce qui est implémenté

### Phase 1 - Core Features (Complète)
- Authentification JWT avec 4 rôles (Super Admin, Business, Staff, Client)
- CRUD rendez-vous avec statuts (pending, confirmed, cancelled, no_show, completed)
- Page de confirmation client avec lien unique
- Dashboards pour tous les rôles
- Vue calendrier hebdomadaire
- Gestion clients avec score de fiabilité
- Analytics et statistiques

### Phase 2 - ML Scoring & Intégrations (Complète)

#### Système ML de Scoring No-Show
- Algorithme avec 6 facteurs pondérés
- Page /ml-scoring avec distribution des risques
- Endpoints ML pour scoring automatique

#### Import Google Calendar (Simulation)
- OAuth flow simulé pour connexion
- Sync automatique des événements

#### Templates de Messages Éditables
- 6 templates par défaut
- Variables dynamiques
- Multi-canaux: Email, SMS, WhatsApp

### Phase 3 - Notation & Fidélisation (Session 21 Février 2025)

#### Système de Notation Clients
- **Page /client-ratings** pour noter les clients après RDV terminés
- **4 critères**: Ponctualité, Politesse, Fiabilité, Note globale (1-5 étoiles)
- **Commentaires** optionnels
- **Impact ML**: Les notes alimentent le score de risque amélioré
- **Endpoints**:
  - `POST /api/appointments/{id}/rate-client`
  - `GET /api/clients/unrated-appointments`
  - `GET /api/clients/{phone}/ratings`
  - `GET /api/ml/enhanced-risk-score/{phone}` (avec notes)

#### Messages de Remerciement
- **Page /thankyou** avec système de templates
- **3 templates par défaut**:
  - Remerciement standard
  - Fidélité (-10% code promo)
  - Demande d'avis
- **Création de templates personnalisés**
- **Support de liens** dans les messages
- **Variables dynamiques**: {{client_name}}
- **Envoi en masse** aux RDV terminés
- **Historique** des messages envoyés
- **Endpoints**:
  - `GET /api/thankyou/templates`
  - `POST/PUT/DELETE /api/thankyou/templates`
  - `POST /api/thankyou/bulk-send`
  - `GET /api/thankyou/history`

#### Système de Chat Interne Admin ↔ Business
- **Page /admin/messaging** pour Super Admin
  - Liste des conversations par entreprise
  - Envoi de messages individuels
  - **Message groupé** à plusieurs entreprises
  - Recherche d'entreprises
  - Suppression de messages
  - Indicateur de messages non lus
- **Page /messages** pour Business
  - Chat avec le support NoShowGone
  - Onglet Messages + Onglet Notifications
  - Réponse au support
  - Indicateur de messages non lus
- **Notifications Business**
  - Alertes automatiques lors de messages admin
  - Marquer comme lu (individuel/tous)
  - Supprimer notifications (individuel/tous)
- **Endpoints Admin**:
  - `GET /api/admin/conversations`
  - `GET/POST /api/admin/conversations/{business_id}`
  - `POST /api/admin/conversations/group`
  - `DELETE /api/admin/conversations/{business_id}/messages/{message_id}`
  - `GET /api/admin/business-search`
- **Endpoints Business**:
  - `GET/POST /api/business/messages`
  - `GET /api/business/messages/unread-count`
  - `GET /api/business/notifications`
  - `PUT /api/business/notifications/{id}/read`
  - `DELETE /api/business/notifications/{id}`
  - `PUT /api/business/notifications/read-all`
  - `DELETE /api/business/notifications` (clear all)

#### Insights Admin "2000% Pertinents"
- **Endpoint**: `GET /api/admin/insights`
- **Entreprises à risque**: Taux de no-show > 30%
- **Top performers**: Meilleur taux de succès
- **Essais expirant bientôt**: Abonnements trial <7 jours
- **Messages non lus**: Compteur support
- **RDV du jour**: Toutes entreprises

#### Dashboard Business - Actions Recommandées
- **Clients à noter**: Badge sur lien + section d'action
- **Clients à remercier**: Badge sur lien + section d'action
- **Messages non lus**: Badge sur lien + section d'action
- **Quick links** enrichis avec badges de compteurs

## Structure des Pages

### Business (/dashboard)
| Route | Description |
|-------|-------------|
| /dashboard | KPIs, actions recommandées |
| /appointments | Liste RDV + filtre source |
| /calendar | Vue hebdomadaire |
| /analytics | Charts, stats |
| /clients | Gestion clients |
| /client-ratings | Notation clients après RDV |
| /thankyou | Messages de remerciement |
| /ml-scoring | Scoring prédictif ML |
| /clients-risk | Blacklist, alertes |
| /notifications | Historique notifs |
| /messages | Chat avec support + notifications |
| /templates | Édition messages |
| /integrations | Google Cal, APIs |
| /staff | Équipe |
| /settings | Paramètres |

### Admin (/admin)
| Route | Description |
|-------|-------------|
| /admin | Dashboard + Insights pertinents |
| /admin/businesses | Gestion entreprises |
| /admin/messaging | Chat avec entreprises |
| /admin/plans | CRUD plans |
| /admin/users | Utilisateurs |
| /admin/activity | Logs activité |
| /admin/stats | Analytics plateforme |

## Backlog P0 (Clés API requises)
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

## Services en Mode Simulation
- **NotificationService**: Queue, retry, logs (prêt pour Twilio)
- **StripeService**: Abonnements, dépôts (prêt pour Stripe)
- **CalendarIntegrationService**: Google OAuth (prêt pour vraies clés)
- **MLScoringService**: Algorithme de prédiction amélioré avec notes
- **ThankYouService**: Templates et envoi (simulé)
- **InternalChatService**: Messages admin ↔ business (fonctionnel)

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
│       │   │   ├── ClientRatingsPage.js (NEW)
│       │   │   ├── ThankYouPage.js (NEW)
│       │   │   ├── BusinessMessagesPage.js (NEW)
│       │   │   ├── MLScoringPage.js
│       │   │   └── ...
│       │   └── admin/
│       │       ├── AdminMessaging.js (NEW)
│       │       └── AdminDashboard.js (enhanced)
│       └── components/
│           ├── BusinessLayout.js (updated nav)
│           └── AdminLayout.js (updated nav)
└── memory/
    └── PRD.md
```

## Changelog

### 21 Février 2025
- Système de notation clients (4 critères)
- Messages de remerciement avec templates
- Chat interne Admin ↔ Business bidirectionnel
- Notifications business avec suppression
- ML scoring amélioré avec notes clients
- Insights admin "2000% pertinents"
- Dashboard business avec actions recommandées
- Tests: 28/28 backend, 100% frontend
