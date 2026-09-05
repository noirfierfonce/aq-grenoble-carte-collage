# Carte de collage · AQ Grenoble.

Carte terrain publique pour les circuits de collage A à M à Grenoble.

## Ce qui est public.

Le dépôt contient uniquement les informations nécessaires à la carte terrain : nom du point, adresse publique, circuit, zone et recommandation couleur / noir et blanc. Il ne contient aucun nom d’équipe, numéro de téléphone, adresse mail, note interne, statut de passage ni lien vers le tableau de suivi.

## Fonctionnement.

- Une seule carte web.
- Sélecteur de circuits A à M.
- Lien direct par circuit avec `?c=A`, `?c=B`, etc.
- Repères cartographiques calculés dans le navigateur à partir des adresses publiques.
- Bouton d’itinéraire vers Google Maps pour chaque point.
- Géolocalisation facultative du téléphone.
- Aucun compte nécessaire pour consulter la carte.
- Aucun outil d’analytics intégré.

Le tableau Google Sheets opérationnel reste séparé de la carte publique et n’est pas lié depuis ce site.

## Confidentialité et sécurité.

Le site est statique. Il ne contient aucune clé API ni secret. Les coordonnées mises en cache par le navigateur restent localement sur l’appareil. Le fichier `robots.txt` et la balise `noindex` demandent aux moteurs de recherche de ne pas indexer le site, mais le dépôt et le site restent publics par nature.

Le navigateur charge toutefois des ressources externes nécessaires au fonctionnement de la carte, notamment OpenStreetMap, Photon et la bibliothèque Leaflet distribuée via unpkg.

## Données cartographiques.

Fond de carte © OpenStreetMap contributors. Géocodage des adresses via Photon. Les adresses officielles restent la référence et le bouton « Itinéraire » ouvre Google Maps avec l’adresse complète.
