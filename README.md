# PassForge – Générateur de mots de passe

Application pour générer, enregistrer et consulter des mots de passe, **100 % en local** (aucun compte, aucun serveur).

- **Branche `android`** : application Android (Capacitor). Chaque push construit un APK : <https://github.com/AyBad/passforge/releases/latest/download/PassForge.apk>
- **Branche `ios`** : application web installable sur iPhone (Safari → Partager → « Sur l'écran d'accueil ») : <https://aybad.github.io/passforge/>

## Fonctions
- Niveaux Faible / Moyen / Fort / Personnalisé : longueur (4–64), minuscules, majuscules, chiffres, caractères spéciaux (liste choisie), sans caractères ambigus, lettres de la langue (option)
- Mode **phrase de passe** : 3 à 10 mots (anglais, français, espagnol, italien, portugais – listes BIP-39 sans accents), séparateur, majuscules, nombre, caractère spécial
- Génération de 1 à 5 mots de passe, regénération, modification manuelle avant enregistrement, copie (presse-papiers effacé automatiquement)
- Liste des mots de passe protégée par code PIN (4–6 chiffres) ou empreinte / visage (Android, biométrie forte), demandés à chaque ouverture de la liste, recherche, affichage, copie, modification (manuelle ou par génération), suppression
- Export chiffré (sélection) et import des fichiers `.pfg`
- Profil (prénom, nom), écrans de bienvenue, tutoriel, 8 langues (FR, EN, AR, ES, DE, IT, PT, ZH), thème clair/sombre/système
- Publicités AdMob (formulaire de consentement RGPD de Google) et mode Pro (achat Google Play) qui les supprime

## Sécurité
- Génération : `crypto.getRandomValues` (sans biais de modulo)
- Chaque mot de passe est chiffré en AES-256-GCM ; la clé est chiffrée en RSA-OAEP 2048. La clé privée est chiffrée avec une clé dérivée du PIN (PBKDF2-SHA256, 250 000 itérations) : on peut enregistrer sans PIN, mais lire exige le PIN.
- Export : AES-256-GCM, clé dérivée du mot de passe du fichier (PBKDF2, 300 000 itérations)
- Empreinte / visage : le PIN est chiffré par une clé du Keystore Android utilisable seulement après authentification biométrique forte ; elle est détruite si une nouvelle empreinte est ajoutée
- Android : captures d'écran bloquées (FLAG_SECURE), sauvegarde cloud désactivée, verrouillage dès que l'application passe en arrière-plan et après 3 min d'inactivité
- Essais de PIN limités (attente croissante après 5 erreurs)

## Publication (Google Play)
Tout se règle dans GitHub, sans modifier le code : **Settings → Secrets and variables → Actions**.

| Type | Nom | Valeur |
|---|---|---|
| Variable | `ADMOB_APP_ID` | ID de l'application AdMob (`ca-app-pub-…~…`) |
| Variable | `ADMOB_BANNER_ID` | ID du bloc d'annonces bannière (`ca-app-pub-…/…`) |
| Variable | `ADMOB_INTERSTITIAL_ID` | ID du bloc d'annonces interstitiel |
| Variable | `PRO_PRODUCT_ID` | ID du produit intégré Google Play (par défaut `passforge_pro`) |
| Secret | `KEYSTORE_BASE64` | clé d'importation (`base64 -w0 upload.keystore`) |
| Secret | `KEYSTORE_PASSWORD`, `KEY_ALIAS`, `KEY_PASSWORD` | mots de passe et alias de cette clé |

Sans ces valeurs : annonces de test Google, achat Pro simulé, clé de signature de test.
Le paiement réel ne fonctionne que si l'application est installée depuis Google Play (piste de test interne ou production).

## Développement
```
npm install
npm run dev      # navigateur
npm run build
```
