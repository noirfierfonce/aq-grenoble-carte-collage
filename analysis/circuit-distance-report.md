# Analyse géographique des circuits A–M

Analyse non destructive basée sur les 209 coordonnées figées de `points.json`.

- Compacité actuelle (somme des distances² aux centroïdes) : **70.98 km²**.
- Compacité après optimisation conservative : **34.81 km²**.
- Gain de compacité : **51.0 %**.
- Points proposés au changement de circuit : **23 / 209**.
- Affectations actuelles nettement plus proches d’un autre centroïde (≥ 350 m) : **9**.

## Tailles des circuits

| Circuit | Actuel | Proposition | Rayon moyen actuel | Rayon moyen proposé | Max actuel | Max proposé |
|---|---:|---:|---:|---:|---:|---:|
| A | 18 | 19 | 0.44 km | 0.40 km | 1.10 km | 0.84 km |
| B | 19 | 19 | 0.42 km | 0.31 km | 2.29 km | 0.53 km |
| C | 18 | 19 | 0.44 km | 0.45 km | 0.91 km | 0.80 km |
| D | 20 | 17 | 0.48 km | 0.38 km | 1.21 km | 0.74 km |
| E | 19 | 19 | 0.32 km | 0.31 km | 0.77 km | 0.75 km |
| F | 18 | 17 | 0.32 km | 0.30 km | 0.71 km | 0.55 km |
| G | 13 | 13 | 0.95 km | 0.37 km | 2.84 km | 0.64 km |
| H | 10 | 13 | 0.56 km | 0.52 km | 1.14 km | 0.67 km |
| I | 17 | 15 | 0.46 km | 0.38 km | 0.99 km | 0.69 km |
| J | 16 | 17 | 0.40 km | 0.38 km | 0.86 km | 0.78 km |
| K | 15 | 15 | 0.30 km | 0.30 km | 0.47 km | 0.47 km |
| L | 13 | 13 | 0.57 km | 0.41 km | 2.14 km | 0.96 km |
| M | 13 | 13 | 0.27 km | 0.27 km | 0.61 km | 0.61 km |

## Changements proposés

| Point | De | Vers | Gain approx. | Adresse |
|---|---:|---:|---:|---|
| G – Point 03 | G | C | 2.37 km | Rue Albert REYNIER N°59 (parc Bachelard), Grenoble, France |
| G – Point 02 | G | D | 2.31 km | Rue Albert REYNIER N°63 (parc Bachelard), Grenoble, France |
| B – Point 03 | B | J | 1.93 km | Rue Henri LE CHATELIER N°13 (centre sportif), Grenoble, France |
| L – Point 09 | L | E | 1.91 km | Rue Aimé PUPIN N°8 (côté sud du tunnel), Grenoble, France |
| H – Point 10 | H | I | 0.74 km | Rue de STALINGRAD parking Clos d'Or, Grenoble, France |
| A – Point 16 | A | B | 0.70 km | Cours BERRIAT N°91, rue Abbé GREGOIRE, Grenoble, France |
| F – Point 10 | F | G | 0.55 km | Cours de la LIBERATION N°32, angle rue des MARRONNIERS, Grenoble, France |
| H – Point 01 | H | J | 0.52 km | Rue Léon JOUHAUX face N°1, boulevard CLEMENCEAU, Grenoble, France |
| D – Point 11 | D | C | 0.41 km | Rue HAUQUELIN N°1, Avenue Maréchal RANDON, Grenoble, France |
| I – Point 05 | I | L | 0.38 km | Avenue Léon BLUM N°82, Grenoble, France |
| D – Point 02 | D | H | 0.37 km | Rue du 4ième REGIMENT du GENIE N°11, Grenoble, France |
| D – Point 18 | D | A | 0.31 km | Route de LYON N°19, Grenoble, France |
| A – Point 13 | A | B | 0.26 km | Esplanade ANDRY-FARCY N°5 (face au Magasin), Grenoble, France |
| I – Point 14 | I | H | 0.23 km | Rue des DEPORTES du 11/11/1943, face rue Paul BOURGET, Grenoble, France |
| C – Point 18 | C | H | 0.21 km | Boulevard Maréchal LYAUTEY N°11, angle rue BECCARIA, Grenoble, France |
| D – Point 01 | D | H | 0.19 km | Place André MALRAUX N°7, Grenoble, France |
| J – Point 03 | J | C | 0.17 km | Rue du 19 MARS 1962, angle Jean PAIN, Grenoble, France |
| I – Point 03 | I | G | 0.11 km | Rue Général MANGIN N°73Ter, Grenoble, France |
| I – Point 04 | I | G | 0.11 km | Rue Général MANGIN N°73Ter, Grenoble, France |
| C – Point 17 | C | H | 0.09 km | Rue du Manège (Cinéma Chavant), Grenoble, France |
| B – Point 01 | B | A | -0.12 km | Place Saint BRUNO N°22, face rue GERIN, Grenoble, France |
| E – Point 18 | E | A | -0.14 km | Rue BILLEREY N°8, angle rue JAY, Grenoble, France |
| G – Point 13 | G | I | -0.25 km | Rue SIDI BRAHIM N°45, Grenoble, France |

## Points à examiner en priorité

Ce tableau ne signifie pas automatiquement « à déplacer » : il repère les affectations actuelles qui paraissent géographiquement atypiques.

| Point | Circuit | Plus proche de | Écart | Adresse |
|---|---:|---:|---:|---|
| G – Point 02 | G | C | 2.30 km | Rue Albert REYNIER N°63 (parc Bachelard), Grenoble, France |
| G – Point 03 | G | C | 2.30 km | Rue Albert REYNIER N°59 (parc Bachelard), Grenoble, France |
| B – Point 03 | B | J | 1.90 km | Rue Henri LE CHATELIER N°13 (centre sportif), Grenoble, France |
| L – Point 09 | L | E | 1.89 km | Rue Aimé PUPIN N°8 (côté sud du tunnel), Grenoble, France |
| A – Point 16 | A | B | 0.73 km | Cours BERRIAT N°91, rue Abbé GREGOIRE, Grenoble, France |
| H – Point 10 | H | I | 0.71 km | Rue de STALINGRAD parking Clos d'Or, Grenoble, France |
| L – Point 01 | L | K | 0.60 km | Avenue MALHERBE N°31, Grenoble, France |
| H – Point 01 | H | J | 0.54 km | Rue Léon JOUHAUX face N°1, boulevard CLEMENCEAU, Grenoble, France |
| I – Point 05 | I | L | 0.37 km | Avenue Léon BLUM N°82, Grenoble, France |

Méthode : distances euclidiennes locales sur latitude/longitude projetées à l’échelle de Grenoble ; ce n’est pas encore un calcul d’itinéraire routier/piéton. Le but est d’identifier les regroupements manifestement perfectibles sans modifier les circuits en production.
