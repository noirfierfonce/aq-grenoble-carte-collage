# Backend de synchronisation

Ce dossier contient le backend Google Apps Script de l’application terrain.

Le code public ne contient ni identifiant de tableur ni code d’accès. Ces deux valeurs doivent être enregistrées dans les propriétés du script au moment du déploiement.

1. Créer ou ouvrir un projet Apps Script lié au compte qui possède le tableur.
2. Coller `Code.gs`.
3. Exécuter une fois `setupBackend("ID_DU_TABLEUR", "CODE_D_ACCES")` depuis l’éditeur.
4. Déployer en tant qu’application Web, exécutée par le propriétaire, accessible à toute personne disposant du lien.
5. Copier l’URL `/exec` du déploiement dans `config.js` comme valeur de `apiUrl`.

Le backend crée automatiquement un onglet masqué `APP-SYNC`, conserve les états détaillés de l’application et répercute les états effectifs dans les onglets Circuit A–M. Les capacités 1–4 sont aussi renvoyées vers `1ER PASSAGE`.
