# Analyse finale de regroupement des circuits A–M

Base : **209 points**, tous enregistrés avec citycode **38185 (Grenoble)**.

## Résumé

- Changements proposés : **20**.
- Compacité (somme des distances² aux centres) : **39.89 → 32.76 km²**, amélioration **17.9 %**.
- Tournées terrain approximatives (plus proche voisin, sans retour au départ) : **37.7 → 35.7 km**, variation **5.3 %**.
- Rayon maximal d’un circuit : **1.14 → 0.84 km**.

## Par circuit

|Circuit|Points actuels|Points proposés|Distance moy. actuelle|Distance moy. proposée|Rayon max actuel|Rayon max proposé|Tournée actuelle|Tournée proposée|
|---|---:|---:|---:|---:|---:|---:|---:|---:|
|A|18|19|0.40 km|0.40 km|0.85 km|0.83 km|3.08 km|3.71 km|
|B|19|19|0.29 km|0.30 km|0.49 km|0.53 km|2.87 km|3.35 km|
|C|18|18|0.44 km|0.41 km|0.91 km|0.84 km|3.48 km|3.14 km|
|D|20|19|0.44 km|0.39 km|0.94 km|0.76 km|4.28 km|3.74 km|
|E|19|19|0.33 km|0.33 km|0.77 km|0.75 km|2.92 km|3.00 km|
|F|18|17|0.32 km|0.30 km|0.71 km|0.55 km|2.13 km|1.68 km|
|G|13|13|0.44 km|0.39 km|0.93 km|0.51 km|2.84 km|2.09 km|
|H|10|13|0.56 km|0.48 km|1.14 km|0.78 km|3.16 km|3.29 km|
|I|17|14|0.47 km|0.37 km|0.99 km|0.52 km|3.47 km|2.28 km|
|J|16|16|0.40 km|0.38 km|0.86 km|0.76 km|2.83 km|2.63 km|
|K|15|16|0.30 km|0.29 km|0.47 km|0.48 km|2.09 km|2.09 km|
|L|13|13|0.39 km|0.36 km|0.95 km|0.69 km|2.66 km|2.81 km|
|M|13|13|0.27 km|0.27 km|0.61 km|0.61 km|1.86 km|1.86 km|

## Réaffectations proposées

|Point|De|Vers|Gain de proximité au centre|Adresse|
|---|---:|---:|---:|---|
|L – Point 01|L|K|0.72 km|Avenue MALHERBE N°31, Grenoble, France|
|H – Point 10|H|I|0.59 km|Rue de STALINGRAD parking Clos d'Or, Grenoble, France|
|H – Point 01|H|J|0.52 km|Rue Léon JOUHAUX face N°1, boulevard CLEMENCEAU, Grenoble, France|
|I – Point 05|I|L|0.43 km|Avenue Léon BLUM N°82, Grenoble, France|
|G – Point 13|G|I|0.41 km|Rue SIDI BRAHIM N°45, Grenoble, France|
|F – Point 10|F|G|0.39 km|Cours de la LIBERATION N°32, angle rue des MARRONNIERS, Grenoble, France|
|I – Point 14|I|H|0.37 km|Rue des DEPORTES du 11/11/1943, face rue Paul BOURGET, Grenoble, France|
|I – Point 15|I|H|0.31 km|Rue Paul BOURGET N°5 (groupe scolaire Ferdinand Buisson), Grenoble, France|
|A – Point 13|A|B|0.29 km|Esplanade ANDRY-FARCY N°5 (face au Magasin), Grenoble, France|
|D – Point 18|D|A|0.28 km|Route de LYON N°19, Grenoble, France|
|D – Point 01|D|E|0.28 km|Place André MALRAUX N°7, Grenoble, France|
|J – Point 03|J|C|0.21 km|Rue du 19 MARS 1962, angle Jean PAIN, Grenoble, France|
|D – Point 02|D|H|0.20 km|Rue du 4ième REGIMENT du GENIE N°11, Grenoble, France|
|D – Point 12|D|C|0.19 km|Place Edmond ARNAUD (sous les arcades), Grenoble, France|
|I – Point 12|I|H|0.19 km|Rue Edouard VAILLANT N°33, rue des DEPORTES du 11/11/1943, Grenoble, France|
|E – Point 01|E|D|0.18 km|Avenue Félix POULAT N°4 (derrière WC public), Grenoble, France|
|C – Point 18|C|D|0.13 km|Boulevard Maréchal LYAUTEY N°11, angle rue BECCARIA, Grenoble, France|
|C – Point 17|C|D|0.03 km|Rue du Manège (Cinéma Chavant), Grenoble, France|
|I – Point 17|I|H|-0.01 km|Boulevard Maréchal FOCH N°51, Grenoble, France|
|B – Point 01|B|A|-0.10 km|Place Saint BRUNO N°22, face rue GERIN, Grenoble, France|

## Points atypiques dans l’organisation actuelle

|Point|Circuit actuel|Circuit géographiquement plus proche|Écart|Adresse|
|---|---:|---:|---:|---|
|L – Point 01|L|K|0.70 km|Avenue MALHERBE N°31, Grenoble, France|
|H – Point 10|H|I|0.69 km|Rue de STALINGRAD parking Clos d'Or, Grenoble, France|
|H – Point 01|H|J|0.54 km|Rue Léon JOUHAUX face N°1, boulevard CLEMENCEAU, Grenoble, France|
|F – Point 10|F|G|0.43 km|Cours de la LIBERATION N°32, angle rue des MARRONNIERS, Grenoble, France|
|G – Point 13|G|I|0.38 km|Rue SIDI BRAHIM N°45, Grenoble, France|
|I – Point 05|I|L|0.34 km|Avenue Léon BLUM N°82, Grenoble, France|

## Méthode

Optimisation géographique conservatrice sur coordonnées fixes : centroïdes locaux, contrainte de 13 à 19 points par circuit, pénalité pour limiter les changements, puis contrôle par longueur de tournée approximative. **Ce rapport ne modifie aucune affectation de circuit.**
