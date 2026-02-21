# NoShowGone - PRD

## Problème
SaaS anti no-show permettant aux entreprises (restaurants, salons, coachs) de réduire les absences aux RDV via confirmations automatisées, rappels et dépôts de garantie.

## Architecture
- **Frontend**: React (mobile-first, dark/light mode, bilingue FR/EN)
- **Backend**: FastAPI + MongoDB
- **Auth**: JWT custom
- **URL**: https://appointment-app-demo.preview.emergentagent.com

## Ce qui est implémenté (Session 22 Fév 2025)

### Roue de la Fortune - COMPLET ✅

#### Page Publique (`/play/{code}`)
- **Accès sans authentification** avec code unique par entreprise
- **Roue visuelle animée** avec segments colorés (conic-gradient CSS)
- **Actions à accomplir** configurées par l'entreprise (avis Google, follow réseaux, etc.)
- **Case RGPD obligatoire** avec liens vers CGV et règles du jeu
- **Validation anti-doublon** :
  - Même téléphone bloqué le même jour
  - Même email bloqué le même jour
  - Max participations par client configurable
- **Code de validation** format `WIN-XXXXXXXX` affiché après le gain
- **Date d'expiration** configurable

#### Configuration Business (`/wheel`)
**6 onglets** :
1. **Segments** : Labels, probabilités, couleurs, codes promo
2. **Actions** : Actions à accomplir (Google, Instagram, newsletter, etc.) avec liens et flag obligatoire
3. **Lien & QR** : 
   - URL unique personnalisée (ex: `/play/6BC5CA2B`)
   - **QR Code généré** avec react-qr-code, téléchargeable
   - Toggle activation roue
4. **CGV & Règles** : Textes personnalisables pour RGPD
5. **Validations** : Liste des gains en attente, validés, expirés - Bouton de validation
6. **Stats** : Participations, gains validés, taux de conversion

#### API Endpoints
```
GET  /api/wheel/config           - Configuration de la roue
PUT  /api/wheel/config           - Mise à jour (merge intelligent)
GET  /api/wheel/stats            - Statistiques
GET  /api/wheel/link-info        - Infos du lien unique
GET  /api/wheel/redemptions      - Liste des gains à valider
GET  /api/wheel/{code}/public    - Données publiques (sans auth)
POST /api/wheel/{code}/play      - Jouer (validation complète)
POST /api/wheel/redeem           - Valider un gain
```

### Système de Crédits - COMPLET ✅
- Dashboard avec jauges SMS/Email/WhatsApp
- Packs d'achat avec tarification
- Stripe Checkout intégré (clé test)
- Mode simulation disponible
- Pay-as-you-go configurable

### Fonctionnalités Précédentes (Sessions 1-2)
- Authentification JWT multi-rôles
- Gestion des RDV avec ML scoring
- Automatisation post-RDV 100%
- Messagerie interne Admin ↔ Business
- Notation des clients
- Templates personnalisables

## Collections MongoDB

### wheel_configs
```json
{
  "business_id": "uuid",
  "unique_code": "6BC5CA2B",
  "enabled": true,
  "title": "Roue de la Fortune",
  "subtitle": "Tentez votre chance !",
  "segments": [
    {"label": "-10%", "probability": 30, "color": "#10B981", "promo_code": "ROUE10"}
  ],
  "actions": [
    {"key": "google_review", "label": "Laisser un avis Google", "link": "...", "required": true, "icon": "star"}
  ],
  "social_links": {"facebook": "...", "instagram": "..."},
  "cgv_text": "...",
  "rules_text": "...",
  "require_gdpr": true,
  "expiry_days": 30,
  "max_spins_per_client": 1
}
```

### wheel_spins
```json
{
  "id": "uuid",
  "business_id": "uuid",
  "client_name": "Jean Dupont",
  "client_phone": "0612345678",
  "client_email": "jean@example.com",
  "prize_label": "-10%",
  "validation_code": "WIN-23746F19",
  "status": "pending|validated|expired",
  "expiry_date": "ISO date",
  "created_at": "ISO date"
}
```

## Tests Passés
- **Iteration 6**: 16/16 backend (Crédits)
- **Iteration 7**: 20/20 backend (Roue de Fortune)
- **Frontend**: 100% pages vérifiées
- **Flow E2E**: Spin → Code → Validation ✅

## Mode SIMULATION Actif
- **Resend (Email)**: `RESEND_API_KEY=re_xxx` dans backend/.env
- **Twilio (SMS/WhatsApp)**: `TWILIO_*` dans backend/.env
- **Stripe**: Mode test avec `sk_test_emergent` (fonctionnel)

## Prochaines Tâches

### P1 - À faire
- [ ] Déplacer "Configuration des Intégrations" → Dashboard Admin uniquement
- [ ] Widget "Plans" dans Business Dashboard avec upgrade
- [ ] Widgets "2000% pertinents" supplémentaires

### P2 - Backlog
- [ ] Activer intégrations réelles (Twilio, Resend)
- [ ] Worker background pour retry automatique
- [ ] Intégration Outlook / iCal
- [ ] Heures calmes (pas d'envoi la nuit)

## Comptes Démo
- **Admin**: admin@noshow.com / admin123456
- **Business**: demo@bellanapoli.com / demo123456

## Changelog

### 22 Février 2025 (Session 3) ✨
- **Page Publique Roue** : `/play/{code}` accessible sans connexion
- **Roue visuelle animée** : conic-gradient CSS avec animation
- **Actions configurables** : avis Google, réseaux sociaux, newsletter
- **Anti-doublon** : même jour + même tel/email bloqué
- **Code de validation** : format WIN-XXXXXXXX unique
- **QR Code** : génération avec react-qr-code
- **Validation des gains** : onglet dédié avec statuts
- **Tests** : 20/20 backend + flow E2E validé
