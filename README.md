# StockFacture Pro

> **La gestion commerciale simple, rapide et claire.**
> Application web progressive (PWA) de gestion de stock, facturation, devis et créances pour TPE et commerçants indépendants.

---

## 📖 À propos

**StockFacture Pro** est une application de gestion commerciale conçue pour les petites et moyennes entreprises, boutiques et commerçants indépendants. Elle fonctionne **hors-ligne** et se synchronise automatiquement avec le cloud dès qu'une connexion est disponible.

Elle permet de gérer :
- Produits et stock
- Clients
- Factures et devis
- Paiements et créances
- Retours, avoirs et échanges
- Rapports et analyses

Le tout dans une interface **mobile-first**, installable comme une application native (PWA).

---

## ✨ Fonctionnalités

### 🛒 Gestion commerciale
- **Produits** : catalogue complet (prix d'achat, prix de vente, codes-barres, catégories, seuils d'alerte).
- **Stock** : mouvements d'entrée/sortie, ajustements, valorisation, alertes de stock faible.
- **Ventes rapides** : encaissement immédiat avec paiement partiel ou complet.

### 📄 Facturation & devis
- Factures **conformes** avec numérotation séquentielle (préfixe personnalisable, sans trou).
- Devis convertibles en factures en un clic.
- TVA paramétrable (activée/désactivée, taux personnalisé).
- Remises par ligne et remises globales.
- Brouillons de factures (validation ultérieure).

### 💰 Paiements & créances
- Paiements partiels et acomptes.
- Règlement global des créances client (**FIFO** : plus anciennes factures d'abord).
- Suivi des impayés.
- Multi-devises (FCFA, EUR, USD, GHS, NGN…).

### 🔄 Retours & avoirs
- Retours clients avec réintégration automatique du stock.
- Avoirs (crédit client).
- Échanges d'articles avec calcul automatique de la différence.
- Historique complet des retours.

### 📊 Rapports
- Chiffre d'affaires (jour, semaine, mois, année).
- Marges et bénéfices.
- Top produits vendus.
- Valorisation du stock.

### 📱 Expérience utilisateur
- **Mode hors-ligne complet** (IndexedDB + synchronisation différée).
- **PWA installable** (Android, iOS, desktop).
- **Reçus thermiques** PDF (58 mm / 80 mm) pour imprimantes POS.
- **Scanner de codes-barres** intégré.
- **Verrouillage par code PIN**.
- **Multi-appareils** : synchronisation temps réel via Firebase.
- **Export/restauration** de la base complète.
- **Thème clair** par défaut, thème sombre optionnel.

---

## 🛠 Stack technique

| Composant | Technologie |
|---|---|
| Framework UI | React 19 |
| Langage | TypeScript |
| Build | Vite |
| Style | Tailwind CSS 4 |
| Base de données cloud | Firebase Firestore |
| Auth | Firebase Auth (Google) |
| PWA | vite-plugin-pwa (Workbox) |
| PDF | jsPDF + jspdf-autotable |
| Icônes | lucide-react |
| Persistance locale | IndexedDB (via cache Firestore persistant) |

---

## 🚀 Installation locale

### Prérequis

- **Node.js 20+** ([télécharger](https://nodejs.org/))
- **npm** ou **Bun**
- Un **compte Google** (pour Firebase)

### Étapes

```bash
# 1. Cloner le dépôt
git clone https://github.com/instantafrik-rgb/stockfacture-pro.git
cd stockfacture-pro

# 2. Installer les dépendances
npm install
# ou : bun install

# 3. Configurer Firebase (voir section suivante)

# 4. Lancer le serveur de développement
npm run dev
```

L'application sera accessible sur **http://localhost:3000**.

---

## 🔧 Configuration Firebase (pas à pas)

StockFacture Pro utilise Firebase pour :
- L'**authentification** Google.
- La **synchronisation cloud** des données (Firestore).

### 1. Créer un projet Firebase

1. Rendez-vous sur [console.firebase.google.com](https://console.firebase.google.com/).
2. **Créer un projet** → donnez-lui un nom (ex : `stockfacture-pro`).
3. Désactivez Google Analytics (optionnel) → **Créer**.

### 2. Activer l'authentification Google

1. Dans le menu de gauche → **Authentication** → **Commencer**.
2. Onglet **Sign-in method** → **Google** → Activer.
3. Onglet **Settings** → **Authorized domains** → ajoutez :
   - `localhost` (pour le développement local)
   - Votre domaine de production (ex : `instantafrik-rgb.github.io`)

### 3. Activer Firestore

1. Menu de gauche → **Firestore Database** → **Créer une base de données**.
2. Mode **Production** (les règles de sécurité sont fournies).
3. Choisissez une région proche de vos utilisateurs.

### 4. Récupérer la configuration

1. Menu de gauche → ⚙️ **Paramètres du projet** → onglet **Général**.
2. Section **Vos applications** → cliquez sur **Web** (`</>`).
3. Copiez l'objet `firebaseConfig`.

### 5. Configurer le projet

Créez un fichier `firebase-applet-config.json` à la racine :

```json
{
  "apiKey": "VOTRE_API_KEY",
  "authDomain": "VOTRE_PROJET.firebaseapp.com",
  "projectId": "VOTRE_PROJET_ID",
  "storageBucket": "VOTRE_PROJET.appspot.com",
  "messagingSenderId": "VOTRE_SENDER_ID",
  "appId": "VOTRE_APP_ID"
}
```

### 6. Déployer les règles de sécurité

```bash
# Installer Firebase CLI (une seule fois)
npm install -g firebase-tools
firebase login
firebase init firestore

# Déployer les règles
firebase deploy --only firestore:rules
```

---

## 🚢 Déploiement

### Option A — GitHub Pages (gratuit)

Le projet inclut déjà un workflow GitHub Actions (`.github/workflows/deploy.yml`).

1. Poussez votre code sur la branche `main`.
2. Dans GitHub → **Settings** → **Pages** → Source : **GitHub Actions**.
3. Le déploiement se lance automatiquement à chaque push.

### Option B — Vercel (recommandé pour la production)

```bash
npm install -g vercel
vercel
```

Suivez les instructions. Le déploiement prend moins de 2 minutes.

### Option C — Firebase Hosting

```bash
npm install -g firebase-tools
firebase login
firebase init hosting
npm run build
firebase deploy --only hosting
```

---

## 📁 Structure du projet

```
stockfacture-pro/
├── src/
│   ├── components/       # Composants UI réutilisables
│   │   ├── common/       # Boutons, modales, bannières…
│   │   ├── layout/       # Shell, sidebar, header…
│   │   ├── modals/       # Modales métier (paiement, retour…)
│   │   └── ui/           # Design system (cards, badges…)
│   ├── data/             # Données de démo + état initial
│   ├── hooks/            # Hooks React custom
│   ├── pages/            # Pages principales (Dashboard, Stock…)
│   ├── pdf/              # Génération PDF (factures, reçus, tickets)
│   ├── services/
│   │   ├── data/         # Repository, sync Firestore, transactions
│   │   ├── firebase.ts   # Config Firebase + Auth
│   │   └── ...           # Backup, notifications, storage…
│   ├── store/            # Contextes React (AppContext, AuthContext)
│   ├── types/            # Types TypeScript partagés
│   └── utils/            # Fonctions pures (calculs, formats…)
├── firestore.rules       # Règles de sécurité Firestore
├── firebase-blueprint.json # Modèle de données
├── vite.config.ts        # Config Vite + PWA
└── package.json
```

---

## 🔒 Sécurité

- **Règles Firestore strictes** : chaque utilisateur ne peut accéder qu'à ses propres données.
- **Soft-delete** : les suppressions sont des marquages (`_deleted: true`) — traçabilité et conformité fiscale.
- **Numérotation atomique** : les numéros de facture sont générés dans une transaction Firestore, empêchant les doublons et les trous.
- **Validation côté serveur** : les montants (sous-total, TVA, total) sont vérifiés par les règles Firestore.
- **PIN optionnel** pour verrouiller l'accès à l'application.

---

## 📄 Licence

**Tous droits réservés.** Voir le fichier [LICENSE](./LICENSE) pour les conditions d'utilisation.

Ce logiciel est propriétaire. Toute reproduction, distribution ou utilisation commerciale sans autorisation écrite préalable est interdite.

---

## 📞 Contact

Pour toute question, démonstration ou demande de licence commerciale :

- **Dépôt** : [github.com/instantafrik-rgb/stockfacture-pro](https://github.com/instantafrik-rgb/stockfacture-pro)
- **Démo** : [instantafrik-rgb.github.io/stockfacture-pro](https://instantafrik-rgb.github.io/stockfacture-pro/)

---

## 🙏 Remerciements

Développé avec ❤️ pour les commerçants et entrepreneurs africains.