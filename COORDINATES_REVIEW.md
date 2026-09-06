# Migration en préparation — ne pas déployer.

Le code de cette branche utilise exclusivement les coordonnées du fichier
`data/points.json`. Les 209 coordonnées restent à établir et à vérifier.
Le validateur bloque volontairement les données actuelles, sans coordonnées.
Ne pas fusionner avant que `node scripts/validate-coordinates.cjs` réussisse.

Pour chaque point, conserver les propriétés actuelles et ajouter :

- `lat` et `lon` : nombres WGS84 correspondant au panneau.
- `coordinateStatus` : `verified` après contrôle du placement.
- `coordinateSource` : source précise (plan et repère municipal, ou relevé terrain).

Une adresse géocodée dans Grenoble n’est pas une preuve de placement du panneau.
Le contrôle de commune est nécessaire mais ne remplace pas cette vérification.
Ne pas réutiliser les caches Photon des téléphones pour remplir ces champs.

Sources retrouvées le 6 septembre 2026 :

- Plans et liste municipaux : https://www.grenoble.fr/demarche/606/659-afficher-librement-dans-grenoble.htm
- Limite de Grenoble (code INSEE 38185), enregistrée dans `data/grenoble-boundary.geojson` : https://geo.api.gouv.fr/communes/38185?fields=nom,code,contour&format=geojson&geometry=contour

La récupération directe des PDF municipaux est refusée par leur serveur
(réputation IP). Les versions consultables dans la recherche web ne fournissent
pas de table de coordonnées. Aucun placement n’a été inventé.

La V1 reste strictement Grenoble. Les données Métropole doivent rester dans un
projet séparé. Le stock, le suivi collectif et les identifiants sont préservés.
