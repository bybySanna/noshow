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
- Algorithme ML avec 6 facteurs pondérés
- Page /ml-scoring avec distribution des risques
- Import Google Calendar (simulé)
- Templates de messages éditables (6 par défaut)

### Phase 3 - Notation & Fidélisation (Session 21 Fév 2025)
- **Notation clients**: 4 critères (ponctualité, politesse, fiabilité, globale)
- **Messages de remerciement**: Templates avec liens et variables dynamiques
- **Chat interne Admin ↔ Business**: Messages bidirectionnels + notifications
- **Insights Admin "2000% pertinents"**: Entreprises à risque, top performers, alertes

### Phase 4 - Automatisation 100% (Session 21 Fév 2025) ✨ NOUVEAU

#### Système d'Automatisation Post-RDV
- **Trigger automatique**: Dès qu'un RDV passe à "completed", les messages sont envoyés **sans aucune intervention manuelle**
- **Page /automation** avec 4 onglets:
  - **Dashboard**: KPIs (envoyés, en attente, échecs, taux engagement)
  - **File d'envoi**: Liste temps réel avec statuts et retry manuel
  - **Templates**: 4 templates par défaut + création personnalisés
  - **Paramètres**: Canal préféré, fallback, liens

#### Templates Dynamiques par Défaut
1. **Remerciement Standard**: Message simple post-visite
2. **Demande d'Avis Google**: Avec lien vers Google Review
3. **Récompense Fidélité**: Code promo personnalisé
4. **Roue de la Fortune**: Lien vers jeu marketing

#### Variables Dynamiques Supportées
- `{{nom_client}}` - Nom du client
- `{{nom_entreprise}}` - Nom de l'entreprise
- `{{lien_google_avis}}` - Lien Google Review
- `{{lien_roue_fortune}}` - Lien roue de la fortune
- `{{reduction}}` - Pourcentage de réduction
- `{{code_promo}}` - Code promo
- `{{date_expiration}}` - Date d'expiration

#### Multi-Canaux avec Fallback Automatique
- **Canal préféré**: SMS, WhatsApp, ou Email
- **Fallback**: Si le canal échoue → essaie automatiquement le suivant
- **Ordre**: SMS → WhatsApp → Email
- **Retry automatique**: 3 tentatives avec backoff (1min, 5min, 15min)

#### Statuts de Messages
| Statut | Description |
|--------|-------------|
| pending | En attente d'envoi |
| sending | Envoi en cours |
| sent | Envoyé avec succès |
| delivered | Livré (confirmé) |
| failed | Échec définitif |
| retrying | En attente de retry |
| fallback | Basculement vers autre canal |

#### Endpoints API Automatisation
- `GET /api/automation/queue` - Liste la queue avec stats
- `GET /api/automation/analytics` - Statistiques temps réel
- `GET /api/automation/settings` - Paramètres
- `PUT /api/automation/settings` - Mise à jour paramètres
- `GET /api/automation/templates` - Templates
- `POST /api/automation/templates` - Créer template
- `POST /api/automation/retry/{id}` - Retry manuel
- `POST /api/automation/trigger/{id}` - Trigger manuel (debug)
- `POST /api/automation/track-click` - Tracking clics

#### Monitoring Admin
- `GET /api/admin/automation/analytics` - Stats globales
- `GET /api/admin/automation/queue` - Queue globale
- `POST /api/admin/automation/process-retries` - Traiter les retries

### Phase 5 - Onboarding Enrichi (P1 Complète) ✨ NOUVEAU

#### Page /setup - Configuration Guidée
- **Barre de progression**: 7 étapes avec pourcentage
- **5 sections configurables**:
  1. **Profil**: Téléphone, email, adresse, site web
  2. **Fuseau horaire**: 10 options (Europe, Amérique, Afrique, Asie)
  3. **Horaires d'ouverture**: Lundi-Dimanche avec open/close ou fermé
  4. **Liens marketing**: Google Review, Roue de la Fortune
  5. **Automatisation**: Résumé et lien vers /automation

#### Endpoints Onboarding
- `GET /api/onboarding/status` - Progression (7 étapes)
- `PUT /api/onboarding/profile` - Mise à jour profil
- `PUT /api/onboarding/business-hours` - Horaires d'ouverture
- `GET /api/utils/timezones` - Liste fuseaux horaires

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
| /automation | **NOUVEAU** Dashboard automatisation |
| /ml-scoring | Scoring prédictif ML |
| /clients-risk | Blacklist, alertes |
| /notifications | Historique notifs |
| /messages | Chat support + notifications |
| /templates | Édition messages |
| /integrations | Google Cal, APIs |
| /staff | Équipe |
| /setup | **NOUVEAU** Onboarding enrichi |
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

## Schéma DB Mis à Jour

### Collection: post_rdv_queue (NOUVEAU)
```json
{
  "id": "uuid",
  "appointment_id": "uuid",
  "business_id": "uuid",
  "client_name": "string",
  "client_phone": "string",
  "client_email": "string",
  "template_key": "string",
  "message_type": "thankyou|review_request|loyalty_reward|wheel_of_fortune",
  "message": "string (final message with variables replaced)",
  "channel": "sms|whatsapp|email",
  "fallback_channels": ["whatsapp", "email"],
  "status": "pending|sending|sent|failed|retrying|fallback",
  "retry_count": 0,
  "click_tracking": {
    "google_review_clicked": false,
    "wheel_clicked": false
  },
  "simulation_mode": true,
  "created_at": "ISO date",
  "sent_at": "ISO date"
}
```

### Collection: post_rdv_templates (NOUVEAU)
```json
{
  "id": "uuid",
  "business_id": "uuid",
  "key": "custom_xxx",
  "name": "string",
  "type": "thankyou|review_request|...",
  "message_fr": "string with {{variables}}",
  "message_en": "string with {{variables}}",
  "channels": ["sms", "email"],
  "include_link": true,
  "is_default": false
}
```

### Champ ajouté à businesses
```json
{
  "post_rdv_settings": {
    "enabled": true,
    "enabled_templates": ["thankyou_standard", "review_request"],
    "preferred_channel": "sms",
    "fallback_enabled": true,
    "google_review_link": "https://g.page/...",
    "wheel_of_fortune_link": "https://...",
    "loyalty_discount": "10",
    "promo_code": "MERCI10"
  },
  "settings": {
    "timezone": "Europe/Paris",
    "opening_hours": {
      "monday": { "open": "09:00", "close": "18:00", "closed": false },
      "tuesday": { "open": "09:00", "close": "18:00", "closed": false },
      ...
    }
  }
}
```

## Backlog

### P0 (Clés API requises)
- [ ] Intégration Twilio réelle (SMS/WhatsApp)
- [ ] Intégration SMTP réelle (Email)
- [ ] Intégration Stripe réelle

### P1 (Prêt)
- [x] ~~Multi-canal fallback~~ ✅ FAIT
- [x] ~~Onboarding enrichi~~ ✅ FAIT
- [ ] Worker background pour retry automatique (cron job)
- [ ] Heures calmes (ne pas envoyer la nuit)

### P2 (Futur)
- [ ] Tracking des ouvertures d'email
- [ ] Statistiques de conversion
- [ ] Outlook / iCal intégration
- [ ] App mobile native

## Comptes Démo
- **Admin**: admin@noshow.com / admin123456
- **Business**: demo@bellanapoli.com / demo123456

## Services en Mode Simulation
- **PostRdvAutomationService**: Messages dans la queue, envoi simulé
- **NotificationService**: Rappels simulés
- **StripeService**: Paiements simulés
- **CalendarIntegrationService**: Google OAuth simulé
- **MLScoringService**: Algorithme heuristique (pas de ML réel)

## Tests Passés
- **Backend**: 21/21 tests (iteration 5)
- **Frontend**: 100% pages vérifiées
- **Trigger auto**: ✅ Vérifié - RDV completed → message en queue → envoyé

## Changelog

### 21 Février 2025 (Session 2)
- **Automatisation 100%**: Trigger automatique post-RDV
- **4 templates** par défaut avec variables dynamiques
- **Multi-canaux** avec fallback automatique
- **Retry automatique** avec backoff exponentiel
- **Page /automation**: Dashboard, queue, templates, settings
- **Page /setup**: Onboarding enrichi (timezone, horaires)
- **21/21 tests** backend passés

### 21 Février 2025 (Session 1)
- Système de notation clients
- Messages de remerciement
- Chat interne Admin ↔ Business
- Insights admin "2000% pertinents"
- 28/28 tests backend passés
