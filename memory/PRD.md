# NoShowGone - PRD

## Problème
SaaS anti no-show permettant aux entreprises (restaurants, salons, coachs) de réduire les absences aux RDV via confirmations automatisées, rappels et dépôts de garantie.

## Architecture
- **Frontend**: React (mobile-first, dark/light mode, bilingue FR/EN)
- **Backend**: FastAPI + MongoDB
- **Auth**: JWT custom
- **URL**: https://appointment-app-demo.preview.emergentagent.com

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
- Algorithme ML avec 6 facteurs pondérés
- Page /ml-scoring avec distribution des risques
- Import Google Calendar (simulé)
- Templates de messages éditables (6 par défaut)

### Phase 3 - Notation & Fidélisation (Complète)
- **Notation clients**: 4 critères (ponctualité, politesse, fiabilité, globale)
- **Messages de remerciement**: Templates avec liens et variables dynamiques
- **Chat interne Admin ↔ Business**: Messages bidirectionnels + notifications
- **Insights Admin "2000% pertinents"**: Entreprises à risque, top performers, alertes

### Phase 4 - Automatisation 100% (Complète)
- **Trigger automatique**: Dès qu'un RDV passe à "completed", les messages sont envoyés
- **Page /automation**: Dashboard, queue, templates, paramètres
- **Multi-canaux avec fallback**: SMS → WhatsApp → Email
- **Retry automatique** avec backoff exponentiel

### Phase 5 - Onboarding Enrichi (Complète)
- **Page /setup**: Configuration guidée (timezone, horaires d'ouverture)
- Barre de progression avec 7 étapes

### Phase 6 - Crédits & Monétisation (Session 22 Fév 2025) ✨ NOUVEAU
#### Système de Crédits
- **Dashboard crédits** (`/credits`): Vue d'ensemble SMS/Email/WhatsApp
- **Limites par plan**: SMS=10, Email=50, WhatsApp=10 (plan défaut)
- **Jauges visuelles**: Usage, restants, pourcentage, alertes

#### Achat de Crédits
- **Packs prédéfinis**:
  - SMS: 50 (2€), 200 (7€), 500 (15€), 1000 (25€)
  - Email: 100 (0.50€), 500 (2€), 2000 (6€), 5000 (12€)
  - WhatsApp: 50 (3.50€), 200 (12€), 500 (25€)
- **Stripe Checkout**: Intégration complète avec clé test
- **Mode simulation**: Toggle pour ajouter crédits sans paiement

#### Pay-as-you-go
- Recharge automatique quand crédits < seuil
- Facturation mensuelle selon consommation

#### Intégrations (Mode Simulation)
- **Resend** (Email): Emplacement pour clé API (`RESEND_API_KEY=re_xxx`)
- **Twilio** (SMS/WhatsApp): Emplacement pour clés (`TWILIO_*`)
- **Stripe**: Clé test active (`sk_test_emergent`)

### Phase 7 - Roue de la Fortune (Session 22 Fév 2025) ✨ NOUVEAU
#### Configuration (`/wheel`)
- **4 segments par défaut**: -10% (30%), -20% (15%), Cadeau (10%), -5% (45%)
- **Personnalisation**: Label, couleur, probabilité, code promo
- **Tâches requises**: Avis Google, suivre réseaux, newsletter, ou aucune
- **Paramètres**: Validité (jours), tours max par client

#### Fonctionnalités
- **Aperçu visuel**: Roue SVG interactive avec animation
- **Test de spin**: Bouton pour tester avec résultat en toast
- **Légende des prix**: Affichage des probabilités

#### API Publique
- `GET /api/wheel/{business_id}/public`: Affichage pour clients
- `POST /api/wheel/{business_id}/spin`: Fait tourner la roue
- **Validation**: Max spins, tâche complétée, expiration

#### Statistiques
- Tours joués
- Gains utilisés
- Taux de conversion

## Pages Frontend

### Business
| Route | Description |
|-------|-------------|
| /dashboard | KPIs, actions recommandées |
| /appointments | Liste RDV + filtre source |
| /calendar | Vue hebdomadaire |
| /analytics | Charts, stats |
| /clients | Gestion clients |
| /client-ratings | Notation clients |
| /thankyou | Messages de remerciement |
| /automation | Dashboard automatisation |
| /wheel | **NOUVEAU** Roue de la Fortune |
| /ml-scoring | Scoring prédictif ML |
| /clients-risk | Blacklist, alertes |
| /notifications | Historique notifs |
| /messages | Chat support + notifications |
| /templates | Édition messages |
| /integrations | Google Cal, APIs |
| /credits | **NOUVEAU** Crédits & Facturation |
| /staff | Équipe |
| /setup | Onboarding enrichi |
| /settings | Paramètres |

### Admin
| Route | Description |
|-------|-------------|
| /admin | Dashboard + Insights |
| /admin/businesses | Gestion entreprises |
| /admin/messaging | Chat avec entreprises |
| /admin/plans | CRUD plans |
| /admin/users | Utilisateurs |
| /admin/activity | Logs activité |
| /admin/stats | Analytics plateforme |

## Schéma DB

### Collection: payment_transactions (NOUVEAU)
```json
{
  "id": "uuid",
  "session_id": "cs_xxx (Stripe)",
  "business_id": "uuid",
  "credit_type": "sms|email|whatsapp",
  "pack_key": "pack_50",
  "quantity": 50,
  "amount_cents": 200,
  "currency": "eur",
  "status": "initiated|complete|expired",
  "payment_status": "pending|paid",
  "created_at": "ISO date"
}
```

### Collection: wheel_configs (NOUVEAU)
```json
{
  "business_id": "uuid",
  "enabled": true,
  "title": "Roue de la Fortune",
  "subtitle": "Tentez votre chance !",
  "segments": [
    {"label": "-10%", "probability": 30, "color": "#10B981", "promo_code": "ROUE10"}
  ],
  "tasks_required": ["google_review"],
  "expiry_days": 30,
  "max_spins_per_client": 1
}
```

### Collection: wheel_spins (NOUVEAU)
```json
{
  "id": "uuid",
  "business_id": "uuid",
  "client_phone": "+33xxx",
  "prize_label": "-10%",
  "promo_code": "ROUE10",
  "expiry_date": "ISO date",
  "redeemed": false
}
```

## Endpoints API

### Crédits
- `GET /api/credits/dashboard` - Dashboard complet
- `GET /api/credits/check/{type}` - Vérifier solde
- `GET /api/credits/packs` - Liste des packs
- `POST /api/credits/checkout` - Créer session Stripe
- `GET /api/credits/checkout/status/{id}` - Vérifier paiement
- `POST /api/credits/purchase` - Achat simulation
- `PUT /api/credits/pay-as-you-go` - Configurer auto-recharge
- `GET /api/credits/history` - Historique

### Roue de Fortune
- `GET /api/wheel/config` - Configuration
- `PUT /api/wheel/config` - Sauvegarder
- `GET /api/wheel/stats` - Statistiques
- `GET /api/wheel/{id}/public` - Vue publique
- `POST /api/wheel/{id}/spin` - Faire tourner
- `POST /api/wheel/redeem` - Utiliser gain

## Backlog

### P0 (Clés API requises)
- [ ] Intégration Twilio réelle (SMS/WhatsApp)
- [ ] Intégration Resend réelle (Email)
- [ ] Stripe en mode production

### P1 (Prêt)
- [x] ~~Système de crédits~~ ✅ FAIT
- [x] ~~Roue de la Fortune~~ ✅ FAIT
- [ ] Worker background pour retry automatique (cron job)
- [ ] Heures calmes (ne pas envoyer la nuit)
- [ ] Page publique de la roue pour clients

### P2 (Futur)
- [ ] Tracking des ouvertures d'email
- [ ] Statistiques de conversion
- [ ] Outlook / iCal intégration
- [ ] App mobile native
- [ ] Widgets "2000% pertinents" supplémentaires

## Comptes Démo
- **Admin**: admin@noshow.com / admin123456
- **Business**: demo@bellanapoli.com / demo123456

## Services en Mode Simulation
- **EmailService (Resend)**: Emails dans les logs, pas envoyés
- **NotificationService (Twilio)**: SMS/WhatsApp simulés
- **StripeService**: Paiements en mode test
- **CalendarIntegrationService**: Google OAuth simulé
- **MLScoringService**: Algorithme heuristique

## Tests Passés
- **Backend**: 16/16 tests (iteration 6)
- **Frontend**: 100% pages vérifiées
- **Stripe Checkout**: ✅ Sessions créées avec succès
- **Roue de Fortune**: ✅ Configuration et spin fonctionnels

## Changelog

### 22 Février 2025 (Session 3)
- **Système de Crédits**: Dashboard, limites par plan, packs d'achat
- **Stripe Checkout**: Intégration complète pour achat crédits
- **Roue de la Fortune**: Configuration complète, aperçu, statistiques
- **Tests**: 16/16 backend + 100% frontend

### 21 Février 2025 (Session 2)
- Automatisation 100% post-RDV
- Multi-canaux avec fallback
- Page /setup onboarding enrichi
- 21/21 tests passés

### 21 Février 2025 (Session 1)
- Système de notation clients
- Messages de remerciement
- Chat interne Admin ↔ Business
- 28/28 tests passés
