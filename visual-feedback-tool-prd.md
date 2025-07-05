# PRD - Outil de Feedback Visuel Simple

## Executive Summary

**Vision** : Créer un outil de feedback visuel ultra-simplifié permettant aux clients de laisser des commentaires contextuels sur des sites web en développement, sans création de compte ni complexité technique.

**Mission** : Éliminer les frictions dans le processus de collecte de retours clients en proposant une solution accessible via code d'invitation, capture d'écran intégrée, et interface développeur minimaliste.

**Objectifs Business** :
- Réduire de 70% le temps de collecte et traitement des feedbacks clients
- Proposer une alternative économique (< 50€/mois) aux solutions complexes du marché
- Permettre aux développeurs freelance/PME d'améliorer leur workflow client sans investissement lourd

---

## 1. Contexte et Problématique

### 1.1 Analyse du Marché
Le marché des outils de feedback visuel est dominé par des solutions complexes (Marker.io, Usersnap, BugHerd) nécessitant création de comptes, formations client, et tarifs élevés (150-400€/mois). Les freelances et petites équipes ont besoin d'une solution plus directe.

### 1.2 Problèmes Identifiés
- **Friction utilisateur** : Les clients doivent créer des comptes, installer des extensions, suivre des tutoriels
- **Complexité technique** : Tableaux de bord surchargés, fonctionnalités inutilisées (85% des utilisateurs n'utilisent que 20% des features)
- **Coût prohibitif** : Solutions existantes trop chères pour les petites structures
- **Processus fragmenté** : Captures d'écran externes, emails, outils séparés

### 1.3 Opportunité
Gap identifié : outil ultra-simple avec système d'invitation par code, capture d'écran intégrée, et interface développeur minimaliste.

---

## 2. Solution Proposée

### 2.1 Concept Global
**Extension Chrome** + **API Hono** + **Dashboard simple** = Solution complète de feedback visuel en 3 composants.

### 2.2 Proposition de Valeur
- **Pour le développeur** : Génère un code, récupère les commentaires, export des données
- **Pour le client** : Installe l'extension, saisit le code, clique et commente
- **Pour l'équipe** : Workflow fluide, pas de formation, résolution rapide

### 2.3 Différenciation
- **Zéro friction client** : Pas de création de compte
- **Capture flexible** : Écran entier ou zone sélectionnée
- **Prix accessible** : < 50€/mois vs 150-400€/mois concurrents
- **Déploiement edge** : Performance optimale via Cloudflare Workers

---

## 3. Spécifications Fonctionnelles

### 3.1 Extension Chrome

#### 3.1.1 Installation et Activation
- **Installation** : Chrome Web Store standard
- **Activation** : Icône dans la barre d'outils
- **Authentification** : Saisie code d'invitation (format : ABC-123-XYZ)
- **Validation** : Vérification du code via API, stockage local sécurisé

#### 3.1.2 Interface Utilisateur
```
┌─────────────────────────────────────┐
│ 🔥 Feedback Tool                    │
├─────────────────────────────────────┤
│ Code projet: [ABC-123-XYZ]   [✓]   │
│ Status: ✓ Connecté au projet       │
├─────────────────────────────────────┤
│ 📸 Nouvelle capture                 │
│ 💬 Mes commentaires (3)            │
│ ⚙️  Paramètres                     │
└─────────────────────────────────────┘
```

#### 3.1.3 Processus de Feedback

**Principe** : Navigation normale préservée, capture uniquement sur action intentionnelle.

#### Mode 1 : Overlay Flottant (Recommandé)
1. **Activation** : Clic sur l'icône extension → Overlay flottant apparaît
2. **Overlay** : 
   ```
   ┌─────────────────────────────────────────┐
   │ Site Web Normal (navigation libre)      │
   │                                         │
   │                              ┌────────┐ │
   │                              │🔥 📸   │ │ ← Overlay fixe
   │                              │Capture │ │   coin page
   │                              └────────┘ │
   └─────────────────────────────────────────┘
   ```
3. **Sélection** : Clic sur overlay → Mode capture activé temporairement
   - **Indicateur visuel** : Bordure rouge de 3px autour de la page entière
   - **Écran entier** : Clic droit → "Capturer l'écran entier"
   - **Zone spécifique** : Clic + glisser pour sélectionner
4. **Retour automatique** : Après capture → Bordure disparaît, mode normal restauré
5. **Annotation** : Modal overlay avec aperçu, commentaire, priorité

#### Mode 2 : Raccourci Clavier (Option avancée)
1. **Configuration** : Paramètres extension → Définir raccourci (défaut: Ctrl+Shift+C)
2. **Activation** : Maintenir raccourci → Bordure rouge de 3px autour de la page + overlay "Mode Capture"
3. **Sélection** : Tant que raccourci maintenu :
   - **Écran entier** : Clic droit
   - **Zone spécifique** : Clic + glisser
4. **Désactivation** : Relâcher raccourci → Bordure disparaît, retour navigation normale

#### Paramètres Utilisateur
```javascript
// Dans popup extension
const captureSettings = {
  mode: 'overlay' | 'keyboard' | 'both',
  overlayPosition: 'top-right' | 'bottom-left' | 'bottom-right',
  keyboardShortcut: 'Ctrl+Shift+C' | 'Alt+C' | 'custom',
  overlaySize: 'small' | 'medium' | 'large'
}
```

#### Avantages UX
- ✅ **Navigation libre** : Aucune contrainte sur les clics normaux
- ✅ **Intention claire** : L'utilisateur décide quand capturer
- ✅ **Feedback visuel** : Overlay montre le statut actuel
- ✅ **Flexibilité** : Deux modes selon les préférences
- ✅ **Retour automatique** : Pas de "piège" en mode capture

#### 3.1.4 Fonctionnalités Techniques
- **Capture d'écran** : API `chrome.tabs.captureVisibleTab()`
- **Sélection de zone** : Canvas overlay avec coordonnées précises
- **Compression** : Optimisation automatique des images (WebP, qualité 85%)
- **Métadonnées** : URL, User-Agent, résolution, timestamp
- **Offline** : Stockage local avec sync automatique

### 3.2 API Backend (Hono)

#### 3.2.1 Architecture
```typescript
// Structure de l'API
/api/projects          - POST: Créer projet + code
/api/projects/{code}   - GET: Infos projet
/api/comments          - POST: Nouveau commentaire
/api/comments/{code}   - GET: Lister commentaires
/api/export/{code}     - GET: Export JSON/CSV
```

#### 3.2.2 Modèle de Données
```typescript
// Projet
interface Project {
  id: string
  code: string           // ABC-123-XYZ
  name: string
  owner_email: string
  created_at: Date
  expires_at: Date       // 30 jours par défaut
  settings: ProjectSettings
}

// Commentaire
interface Comment {
  id: string
  project_code: string
  url: string
  screenshot_url: string
  text: string
  priority: 'low' | 'normal' | 'high'
  coordinates: { x: number, y: number, width: number, height: number }
  metadata: {
    user_agent: string
    screen_resolution: string
    timestamp: Date
  }
  status: 'new' | 'in_progress' | 'resolved'
}

// Paramètres projet
interface ProjectSettings {
  max_comments: number   // Limite par projet
  notify_email: boolean
  webhook_url?: string
}
```

#### 3.2.3 Endpoints Détaillés

**POST /api/projects**
```typescript
// Créer un nouveau projet
Body: {
  name: string
  owner_email: string
  settings?: ProjectSettings
}
Response: {
  id: string
  code: string
  expires_at: Date
}
```

**POST /api/comments**
```typescript
// Nouveau commentaire
Body: {
  project_code: string
  url: string
  text: string
  screenshot: string     // Base64
  priority: string
  coordinates: object
  metadata: object
}
Response: {
  id: string
  status: 'success'
}
```

**GET /api/comments/{code}**
```typescript
// Lister commentaires
Response: {
  comments: Comment[]
  total: number
  project: Project
}
```

#### 3.2.4 Stockage et Sécurité
- **Base de données** : SQLite (D1 sur Cloudflare) pour simplicité
- **Stockage images** : R2 (Cloudflare) ou S3 compatible
- **Authentification** : JWT tokens basés sur project_code
- **Rate limiting** : 100 requêtes/minute par code projet
- **Expiration** : Nettoyage automatique après 30 jours

### 3.3 Dashboard Développeur

#### 3.3.1 Interface Web Simple
```html
<!-- Structure de base -->
<div class="dashboard">
  <header>
    <h1>🔥 Feedback Tool</h1>
    <nav>Projets | Aide | Paramètres</nav>
  </header>
  
  <main>
    <section class="projects">
      <h2>Mes Projets</h2>
      <button>+ Nouveau Projet</button>
      <div class="project-list">
        <!-- Liste des projets -->
      </div>
    </section>
    
    <section class="comments">
      <h2>Commentaires Récents</h2>
      <div class="filters">
        <select>Tous | Nouveaux | En cours | Résolus</select>
        <select>Toutes priorités | Élevée | Normale | Faible</select>
      </div>
      <div class="comment-list">
        <!-- Liste des commentaires -->
      </div>
    </section>
  </main>
</div>
```

#### 3.3.2 Fonctionnalités Dashboard
- **Gestion projets** : Créer, modifier, supprimer, générer nouveaux codes
- **Visualisation commentaires** : Liste avec aperçu screenshot, filtres par status/priorité
- **Actions rapides** : Marquer résolu, changer priorité, ajouter notes
- **Export** : JSON, CSV, PDF avec screenshots
- **Notifications** : Email optionnel pour nouveaux commentaires

#### 3.3.3 Vue Détaillée Commentaire
```
┌─────────────────────────────────────────┐
│ 🖼️  Screenshot + Annotation            │
├─────────────────────────────────────────┤
│ 📝 "Le bouton contact ne fonctionne pas"│
│ 🌐 https://example.com/contact          │
│ ⏰ 2025-07-04 14:30:25                  │
│ 📱 Chrome 126.0 - 1920x1080            │
│ 🔥 Priorité: Élevée                     │
├─────────────────────────────────────────┤
│ Status: [Nouveau ▼] [Marquer résolu]    │
│ Notes: [Textarea pour notes internes]   │
│ Actions: [Exporter] [Supprimer]         │
└─────────────────────────────────────────┘
```

---

## 4. Spécifications Techniques

### 4.1 Stack Technologique

#### 4.1.1 Frontend
- **Extension Chrome** : Vanilla JavaScript + Chrome APIs
- **Dashboard** : HTML/CSS/JavaScript vanilla ou React léger
- **UI Framework** : Tailwind CSS pour rapidité développement

#### 4.1.2 Backend
- **Framework** : Hono.js (TypeScript)
- **Runtime** : Cloudflare Workers (edge computing)
- **Base de données** : Cloudflare D1 (SQLite)
- **Stockage** : Cloudflare R2 (images)

#### 4.1.3 Déploiement
- **API** : Cloudflare Workers (gratuit jusqu'à 100k req/jour)
- **Dashboard** : Cloudflare Pages (gratuit)
- **Extension** : Chrome Web Store (25$ one-time)

### 4.2 Architecture Système

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Chrome         │    │  Cloudflare     │    │  Cloudflare     │
│  Extension      │◄──►│  Workers API    │◄──►│  D1 Database    │
│                 │    │  (Hono.js)      │    │  (SQLite)       │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌─────────────────┐
                       │  Cloudflare R2  │
                       │  (Screenshots)  │
                       └─────────────────┘
                                │
                                ▼
                       ┌─────────────────┐
                       │  Web Dashboard  │
                       │  (Pages)        │
                       └─────────────────┘
```

### 4.3 Sécurité et Performance

#### 4.3.1 Sécurité
- **Codes projet** : Génération cryptographique sécurisée
- **Validation** : Sanitisation inputs, validation types
- **CORS** : Headers appropriés pour extension Chrome
- **Rate limiting** : Protection contre abus
- **Expiration** : Nettoyage automatique données

#### 4.3.2 Performance
- **CDN Global** : Cloudflare edge locations
- **Compression** : Images WebP, gzip responses
- **Caching** : Headers cache appropriés
- **Lazy loading** : Chargement différé screenshots dashboard

---

## 5. User Experience (UX)

### 5.1 Parcours Utilisateur - Développeur

```
1. 🌐 Visite dashboard → Inscription simple
2. ➕ Crée nouveau projet → Saisit nom + email
3. 📋 Copie code généré → Partage avec client
4. 📬 Reçoit notifications → Consulte commentaires
5. ✅ Marque résolu → Exporte si besoin
```

### 5.2 Parcours Utilisateur - Client

```
1. 🔧 Installe extension → Chrome Web Store
2. 🔑 Saisit code projet → Validation automatique
3. 👆 Clique zone problème → Sélectionne ou écran entier
4. 💬 Tape commentaire → Choisit priorité
5. 📤 Envoie feedback → Confirmation visuelle
```

### 5.3 Wireframes Clés

#### 5.3.1 Extension - Mode Feedback
```
┌─────────────────────────────────────────┐
│ Site Web Normal                         │
│ ┌─────────────────────────────────────┐ │
│ │ 🔥 Mode Feedback Activé             │ │
│ │ Cliquez sur une zone ou             │ │
│ │ [Capturer l'écran entier]           │ │
│ │ [Annuler]                           │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ [Zone sélectionnable avec overlay]      │
└─────────────────────────────────────────┘
```

#### 5.3.2 Modal Commentaire
```
┌─────────────────────────────────────────┐
│ 💬 Nouveau Commentaire                  │
├─────────────────────────────────────────┤
│ 🖼️ [Aperçu capture - 200x150px]        │
├─────────────────────────────────────────┤
│ Votre commentaire:                      │
│ ┌─────────────────────────────────────┐ │
│ │ Le bouton ne fonctionne pas...      │ │
│ │                                     │ │
│ │                                     │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ Priorité: ○ Faible ●Normale ○ Élevée   │
│                                         │
│ [Annuler]              [Envoyer]        │
└─────────────────────────────────────────┘
```

---

## 6. Roadmap et Développement

### 6.1 Phase 1 - MVP (4-6 semaines)

#### Semaine 1-2 : Backend Foundation
- ✅ Setup Cloudflare Workers + D1
- ✅ API Hono avec endpoints de base
- ✅ Modèle de données et migration
- ✅ Système de génération de codes

#### Semaine 3-4 : Extension Chrome
- ✅ Structure extension + manifest
- ✅ Interface popup de base
- ✅ Capture d'écran (écran entier)
- ✅ Sélection de zone interactive
- ✅ Modal commentaire et envoi

#### Semaine 5-6 : Dashboard Web
- ✅ Interface simple HTML/CSS/JS
- ✅ Gestion projets et commentaires
- ✅ Export données de base
- ✅ Tests et déploiement

### 6.2 Phase 2 - Améliorations (2-4 semaines)

#### Features Supplémentaires
- 🔄 Sync temps réel (WebSockets)
- 📧 Notifications email
- 🔗 Webhooks intégrations
- 📊 Analytics basiques
- 🎨 Thèmes et customisation

#### Optimisations
- ⚡ Performance et caching
- 🔒 Sécurité renforcée
- 📱 Version mobile dashboard
- 🌍 Internationalisation

### 6.3 Phase 3 - Croissance (selon adoption)

#### Fonctionnalités Avancées
- 🤝 Collaboration multi-utilisateurs
- 📝 Templates de commentaires
- 🔍 Recherche et filtres avancés
- 📈 Reporting et métriques
- 🔌 API publique

### 6.4 Risques et Mitigation

#### Risques Techniques
- **Limite Cloudflare Workers** : Migration vers plan payant si nécessaire
- **Quotas Chrome Extension** : Optimisation taille et permissions
- **Performance captures** : Compression et optimisation images

#### Risques Business
- **Adoption lente** : Marketing ciblé freelances/PME
- **Concurrence** : Focus sur simplicité et prix
- **Monétisation** : Freemium avec upgrade naturel

---

## 7. Modèle Économique

### 7.1 Stratégie de Monétisation

#### 7.1.1 Freemium
- **Gratuit** : 2 projets, 50 commentaires/mois, 30 jours rétention
- **Pro** : 39€/mois - projets illimités, commentaires illimités, 1 an rétention
- **Team** : 99€/mois - multi-utilisateurs, webhooks, analytics

#### 7.1.2 Coûts d'Infrastructure
- **Cloudflare Workers** : 0€ (tier gratuit) puis 5$/100k req
- **D1 Database** : 0€ (tier gratuit) puis 5$/million req
- **R2 Storage** : 0€ (tier gratuit) puis 0.015$/GB
- **Estimation** : <10€/mois pour 1000 utilisateurs actifs

### 7.2 Projections Financières

#### Année 1 (Objectifs Conservateurs)
- **Mois 1-3** : 0€ (développement + lancement)
- **Mois 4-6** : 500€/mois (20 utilisateurs Pro)
- **Mois 7-12** : 2000€/mois (100 utilisateurs moyens)

#### Potentiel Marché
- **Freelances web** : 50k+ en France
- **Petites agences** : 10k+ structures
- **Taux conversion** : 2-5% (benchmark SaaS)
- **Potentiel** : 1000-3000 utilisateurs payants

---

## 8. Mesures de Succès

### 8.1 KPIs Produit
- **Adoption** : Téléchargements extension, codes générés
- **Engagement** : Commentaires créés/jour, temps d'utilisation
- **Satisfaction** : NPS, reviews Chrome Store
- **Technique** : Uptime API, temps de réponse

### 8.2 KPIs Business
- **Acquisition** : Nouveaux utilisateurs/mois
- **Rétention** : Taux de churn mensuel
- **Monétisation** : Conversion gratuit→payant
- **Croissance** : MRR (Monthly Recurring Revenue)

### 8.3 Objectifs 6 Mois
- 🎯 **1000 téléchargements** extension
- 🎯 **100 projets créés** par mois
- 🎯 **50 utilisateurs actifs** hebdomadaires
- 🎯 **2000€ MRR** objectif conservateur

---

## 9. Next Steps

### 9.1 Validation Immédiate
1. **Prototype extension** : Version basique en 1 semaine
2. **Test utilisateurs** : 5-10 développeurs beta
3. **Feedback itération** : Ajustements UX/UI
4. **Validation technique** : Performance et limites

### 9.2 Lancement Pilote
1. **Version 0.1** : Fonctionnalités core
2. **Beta fermée** : 20-50 early adopters
3. **Collecte feedback** : Questionnaires et analytics
4. **Itération rapide** : Cycles 2 semaines

### 9.3 Go-to-Market
1. **Landing page** : Site vitrine simple
2. **Chrome Web Store** : Publication extension
3. **Communautés** : Forums développeurs, réseaux sociaux
4. **Content marketing** : Articles techniques, tutorials

---

## Conclusion

Ce PRD définit un produit viable avec une proposition de valeur claire : **simplicité maximale pour la collecte de feedback visuel**. L'approche minimaliste et l'utilisation de technologies modernes (Hono + Cloudflare) permettent un développement rapide et un coût d'infrastructure minimal.

Le marché est validé par l'existence de solutions complexes et chères. Notre différenciation se base sur la simplicité d'usage et l'accessibilité tarifaire, ciblant spécifiquement les freelances et petites équipes négligées par les solutions existantes.

**Prochaine étape recommandée** : Développer le prototype extension en 1 semaine pour validation rapide du concept.