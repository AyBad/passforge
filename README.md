# PassForge – Générateur de mots de passe

Application pour générer, enregistrer et consulter des mots de passe, **100 % en local** (aucun compte, aucun serveur).

- **Branche `android`** : application Android (Capacitor). Chaque push construit un APK : <https://github.com/AyBad/passforge/releases/latest/download/PassForge.apk>
- **Branche `ios`** : application web installable sur iPhone (Safari → Partager → « Sur l'écran d'accueil ») : <https://aybad.github.io/passforge/>

## Fonctions
- Niveaux Faible / Moyen / Fort / Personnalisé : longueur (4–64), minuscules, majuscules, chiffres, caractères spéciaux (liste choisie), sans caractères ambigus, lettres de la langue (option)
- Génération de 1 à 5 mots de passe, regénération, modification manuelle avant enregistrement, copie (presse-papiers effacé automatiquement)
- Liste des mots de passe protégée par code PIN (4–6 chiffres), recherche, affichage, copie, modification (manuelle ou par génération), suppression
- Export chiffré (sélection) et import des fichiers `.pfg`
- Profil (prénom, nom), écrans de bienvenue, tutoriel, 8 langues (FR, EN, AR, ES, DE, IT, PT, ZH), thème clair/sombre/système
- Publicités de test (AdMob) et mode Pro (achat simulé) qui les supprime

## Sécurité
- Génération : `crypto.getRandomValues` (sans biais de modulo)
- Chaque mot de passe est chiffré en AES-256-GCM ; la clé est chiffrée en RSA-OAEP 2048. La clé privée est chiffrée avec une clé dérivée du PIN (PBKDF2-SHA256, 250 000 itérations) : on peut enregistrer sans PIN, mais lire exige le PIN.
- Export : AES-256-GCM, clé dérivée du mot de passe du fichier (PBKDF2, 300 000 itérations)
- Android : captures d'écran bloquées (FLAG_SECURE), sauvegarde cloud désactivée, verrouillage dès que l'application passe en arrière-plan et après 3 min d'inactivité
- Essais de PIN limités (attente croissante après 5 erreurs)

## Avant publication
- Remplacer les identifiants AdMob de test (`src/ads.js`, `AndroidManifest.xml`)
- Brancher Google Play Billing pour le mode Pro
- Remplacer la clé de signature de test (`android/app/passforge-test.keystore`)

## Développement
```
npm install
npm run dev      # navigateur
npm run build
```
