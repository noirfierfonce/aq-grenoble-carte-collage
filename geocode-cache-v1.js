(() => {
  "use strict";
  const KEY = "aq-grenoble-geocode-v2";
  const RESET = "aq-geocode-guard-v2-reset";
  const FIXED = {
  "Rue Henri TARZE, rue Roger JOSSERAND, Grenoble, France": {
    "lat": 45.198809,
    "lon": 5.712799,
    "approx": false,
    "fixed": true
  },
  "Rue du VILLARD DE LANS N°8, Grenoble, France": {
    "lat": 45.197612,
    "lon": 5.713034,
    "approx": false,
    "fixed": true
  },
  "Quai de la GRAILLE N°17, Grenoble, France": {
    "lat": 45.196586,
    "lon": 5.714371,
    "approx": false,
    "fixed": true
  },
  "Rue ARAGO N°15, angle rue Emile GUEYMARD, Grenoble, France": {
    "lat": 45.193145,
    "lon": 5.714607,
    "approx": false,
    "fixed": true
  },
  "Rue Emile GUEYMARD N°22, Grenoble, France": {
    "lat": 45.193145,
    "lon": 5.714607,
    "approx": false,
    "fixed": true
  },
  "Place Doyen GOSSE, Grenoble, France": {
    "lat": 45.191789,
    "lon": 5.716645,
    "approx": false,
    "fixed": true
  },
  "Rue d'ARSONVAL N°6, Grenoble, France": {
    "lat": 45.192206,
    "lon": 5.71759,
    "approx": false,
    "fixed": true
  },
  "Place de la GARE, Grenoble, France": {
    "lat": 45.190993,
    "lon": 5.715253,
    "approx": false,
    "fixed": true
  },
  "Place de la Gare, face rue André REAL, Grenoble, France": {
    "lat": 45.189737,
    "lon": 5.716202,
    "approx": false,
    "fixed": true
  },
  "Avenue Alsace LORRAINE N°37, avenue Jean JAURES, Grenoble, France": {
    "lat": 45.189371,
    "lon": 5.719109,
    "approx": false,
    "fixed": true
  },
  "Place Firmin GAUTIER, Grenoble, France": {
    "lat": 45.190686,
    "lon": 5.711659,
    "approx": false,
    "fixed": true
  },
  "Cours BERRIAT N°163, Grenoble, France": {
    "lat": 45.188412,
    "lon": 5.712687,
    "approx": false,
    "fixed": true
  },
  "Esplanade ANDRY-FARCY N°5 (face au Magasin), Grenoble, France": {
    "lat": 45.187362,
    "lon": 5.704703,
    "approx": false,
    "fixed": true
  },
  "Cours BERRIAT N°129, angle rue du DRAC, Grenoble, France": {
    "lat": 45.188565,
    "lon": 5.707943,
    "approx": false,
    "fixed": true
  },
  "Cours BERRIAT N°106-108, Grenoble, France": {
    "lat": 45.188412,
    "lon": 5.712687,
    "approx": false,
    "fixed": true
  },
  "Cours BERRIAT N°91, rue Abbé GREGOIRE, Grenoble, France": {
    "lat": 45.188278,
    "lon": 5.712866,
    "approx": false,
    "fixed": true
  },
  "Trémie BERRIAT-GARE, Grenoble, France": {
    "lat": 45.188412,
    "lon": 5.712687,
    "approx": false,
    "fixed": true
  },
  "Passage du MARCHE, Grenoble, France": {
    "lat": 45.187908,
    "lon": 5.713477,
    "approx": false,
    "fixed": true
  },
  "Place Saint BRUNO N°22, face rue GERIN, Grenoble, France": {
    "lat": 45.187138,
    "lon": 5.713734,
    "approx": false,
    "fixed": true
  },
  "Rue Henri LE CHATELIER N°3BIS, Grenoble, France": {
    "lat": 45.186547,
    "lon": 5.711608,
    "approx": false,
    "fixed": true
  },
  "Rue Henri LE CHATELIER N°13 (centre sportif), Grenoble, France": {
    "lat": 45.186272,
    "lon": 5.711651,
    "approx": false,
    "fixed": true
  },
  "Rue Marx DORMOY N°41, parc Marliave, Grenoble, France": {
    "lat": 45.186936,
    "lon": 5.709037,
    "approx": false,
    "fixed": true
  },
  "Rue CUVIER N°2, angle rue MOZART, Grenoble, France": {
    "lat": 45.185768,
    "lon": 5.709334,
    "approx": false,
    "fixed": true
  },
  "Rue MOZART N°4BIS, angle rue CUVIER, Grenoble, France": {
    "lat": 45.185768,
    "lon": 5.709334,
    "approx": false,
    "fixed": true
  },
  "Rue Victor LASTELLA N°22, Grenoble, France": {
    "lat": 45.18433,
    "lon": 5.704698,
    "approx": false,
    "fixed": true
  },
  "Rue des ARTS et METIERS N°15 (salle rouge), Grenoble, France": {
    "lat": 45.184894,
    "lon": 5.704552,
    "approx": false,
    "fixed": true
  },
  "Place Saint BRUNO N°17, angle rue Nicolas CHORIER (lycée), Grenoble, France": {
    "lat": 45.184577,
    "lon": 5.710819,
    "approx": false,
    "fixed": true
  },
  "Avenue de VIZILLE N°23, rue Nicolas CHORIER, Grenoble, France": {
    "lat": 45.186112,
    "lon": 5.716323,
    "approx": false,
    "fixed": true
  },
  "Rue Alphonse TERRAY N°14, Grenoble, France": {
    "lat": 45.184934,
    "lon": 5.713323,
    "approx": false,
    "fixed": true
  },
  "Rue de NEW YORK N°23, parc Paul Perrin (entrée), Grenoble, France": {
    "lat": 45.1834,
    "lon": 5.713941,
    "approx": false,
    "fixed": true
  },
  "Rue d'ALEMBERT N°102, Grenoble, France": {
    "lat": 45.1859,
    "lon": 5.710844,
    "approx": false,
    "fixed": true
  },
  "Rue Nicolas CHORIER N°42, Grenoble, France": {
    "lat": 45.184577,
    "lon": 5.710819,
    "approx": false,
    "fixed": true
  },
  "Rue du DRAC N°72 (école Ampère), Grenoble, France": {
    "lat": 45.185838,
    "lon": 5.707196,
    "approx": false,
    "fixed": true
  },
  "Rue AMPERE N°77, angle rue Docteur HERMITE, Grenoble, France": {
    "lat": 45.181713,
    "lon": 5.710437,
    "approx": false,
    "fixed": true
  },
  "Rue Docteur CALMETTE, angle rue Léon DRIVIER, Grenoble, France": {
    "lat": 45.180625,
    "lon": 5.710203,
    "approx": false,
    "fixed": true
  },
  "Rue Docteur CALMETTE N°6, angle rue Abbé GREGOIRE, Grenoble, France": {
    "lat": 45.180898,
    "lon": 5.708859,
    "approx": false,
    "fixed": true
  },
  "Rue IRVOY N°26, boulevard Joseph Vallier, Grenoble, France": {
    "lat": 45.180326,
    "lon": 5.711529,
    "approx": false,
    "fixed": true
  },
  "Rue FARCONNET N°10, Grenoble, France": {
    "lat": 45.19939,
    "lon": 5.740483,
    "approx": false,
    "fixed": true
  },
  "Avenue Maréchal RANDON N°10 (place du GRESIVAUDAN), Grenoble, France": {
    "lat": 45.198621,
    "lon": 5.738573,
    "approx": false,
    "fixed": true
  },
  "Place Docteur GIRARD, Grenoble, France": {
    "lat": 45.197174,
    "lon": 5.736663,
    "approx": false,
    "fixed": true
  },
  "Rue Aimon de CHISSE N°6, Grenoble, France": {
    "lat": 45.19623,
    "lon": 5.736864,
    "approx": false,
    "fixed": true
  },
  "Avenue Maréchal RANDON, bd Maréchal LECLERC (parc Ile Verte), Grenoble, France": {
    "lat": 45.194881,
    "lon": 5.73587,
    "approx": false,
    "fixed": true
  },
  "Boulevard Maréchal LECLERC N°19 (tour Mont Blanc), Grenoble, France": {
    "lat": 45.193756,
    "lon": 5.735969,
    "approx": false,
    "fixed": true
  },
  "18 Avenue Saint-Roch, 38000 Grenoble, France": {
    "lat": 45.191558,
    "lon": 5.738768,
    "approx": false,
    "fixed": true
  },
  "Rue du 19 MARS 1962, angle Jean PAIN, Grenoble, France": {
    "lat": 45.188736,
    "lon": 5.744052,
    "approx": false,
    "fixed": true
  },
  "Rue Joseph CHANRION N°18, angle boulevard Jean PAIN, Grenoble, France": {
    "lat": 45.189675,
    "lon": 5.736685,
    "approx": false,
    "fixed": true
  },
  "Rue Joseph CHANRION N°35, vers Centre Social, Grenoble, France": {
    "lat": 45.189675,
    "lon": 5.736685,
    "approx": false,
    "fixed": true
  },
  "Rue HEBERT, angle boulevard des ADIEUX, Grenoble, France": {
    "lat": 45.190008,
    "lon": 5.738726,
    "approx": false,
    "fixed": true
  },
  "Rue HEBERT N°3, rue Joseph CHANRION, Grenoble, France": {
    "lat": 45.191378,
    "lon": 5.735412,
    "approx": false,
    "fixed": true
  },
  "Rue HEBERT N°12, Grenoble, France": {
    "lat": 45.189995,
    "lon": 5.735287,
    "approx": false,
    "fixed": true
  },
  "Rue Cornélie GEMOND N°7, Grenoble, France": {
    "lat": 45.190171,
    "lon": 5.734111,
    "approx": false,
    "fixed": true
  },
  "Rue Cornélie GEMOND N°14 (école maternelle), Grenoble, France": {
    "lat": 45.190171,
    "lon": 5.734111,
    "approx": false,
    "fixed": true
  },
  "Boulevard Jean PAIN N°12, Grenoble, France": {
    "lat": 45.186849,
    "lon": 5.735706,
    "approx": false,
    "fixed": true
  },
  "Rue du Manège (Cinéma Chavant), Grenoble, France": {
    "lat": 45.185964,
    "lon": 5.732375,
    "approx": false,
    "fixed": true
  },
  "Boulevard Maréchal LYAUTEY N°11, angle rue BECCARIA, Grenoble, France": {
    "lat": 45.185587,
    "lon": 5.730701,
    "approx": false,
    "fixed": true
  },
  "Place André MALRAUX N°7, Grenoble, France": {
    "lat": 45.185082,
    "lon": 5.729161,
    "approx": false,
    "fixed": true
  },
  "Rue du 4ième REGIMENT du GENIE N°11, Grenoble, France": {
    "lat": 45.18444,
    "lon": 5.730333,
    "approx": false,
    "fixed": true
  },
  "Place de METZ, Grenoble, France": {
    "lat": 45.187381,
    "lon": 5.730512,
    "approx": false,
    "fixed": true
  },
  "Place VAUCANSON (au centre), Grenoble, France": {
    "lat": 45.188347,
    "lon": 5.72846,
    "approx": false,
    "fixed": true
  },
  "Place Jean ACHARD N°1ter, Grenoble, France": {
    "lat": 45.189319,
    "lon": 5.729486,
    "approx": false,
    "fixed": true
  },
  "Passage du LYCEE N°3, Grenoble, France": {
    "lat": 45.189726,
    "lon": 5.729664,
    "approx": false,
    "fixed": true
  },
  "Rue de la REPUBLIQUE N°14 (Office du Tourisme), Grenoble, France": {
    "lat": 45.190663,
    "lon": 5.729072,
    "approx": false,
    "fixed": true
  },
  "Rue MADELEINE N°1, rue de LIONNE, Grenoble, France": {
    "lat": 45.193813,
    "lon": 5.729793,
    "approx": false,
    "fixed": true
  },
  "Place NOTRE DAME N°2bis (arrêt de tram), Grenoble, France": {
    "lat": 45.192817,
    "lon": 5.731398,
    "approx": false,
    "fixed": true
  },
  "Rue du VIEUX TEMPLE N°10, rue TRES CLOITRES, Grenoble, France": {
    "lat": 45.192462,
    "lon": 5.733544,
    "approx": false,
    "fixed": true
  },
  "Rue HAUQUELIN N°1, Avenue Maréchal RANDON, Grenoble, France": {
    "lat": 45.193696,
    "lon": 5.732564,
    "approx": false,
    "fixed": true
  },
  "Place Edmond ARNAUD (sous les arcades), Grenoble, France": {
    "lat": 45.192508,
    "lon": 5.734222,
    "approx": false,
    "fixed": true
  },
  "Place Saint LAURENT, Grenoble, France": {
    "lat": 45.197736,
    "lon": 5.731943,
    "approx": false,
    "fixed": true
  },
  "Rue SAINT LAURENT N°77, Grenoble, France": {
    "lat": 45.196219,
    "lon": 5.730313,
    "approx": false,
    "fixed": true
  },
  "Quai PERRIERE face N°16, Grenoble, France": {
    "lat": 45.194195,
    "lon": 5.726389,
    "approx": false,
    "fixed": true
  },
  "Quai PERRIERE N°66, Grenoble, France": {
    "lat": 45.194195,
    "lon": 5.726389,
    "approx": false,
    "fixed": true
  },
  "Quai de France N°50 (Jardin des Dauphins), Grenoble, France": {
    "lat": 45.193966,
    "lon": 5.719946,
    "approx": false,
    "fixed": true
  },
  "Route de LYON N°19, Grenoble, France": {
    "lat": 45.196512,
    "lon": 5.718652,
    "approx": false,
    "fixed": true
  },
  "Rue de BELGRADE N°5 (square Vallois), Grenoble, France": {
    "lat": 45.191567,
    "lon": 5.725436,
    "approx": false,
    "fixed": true
  },
  "Jardin de VILLE N°5 (école), Grenoble, France": {
    "lat": 45.192043,
    "lon": 5.726489,
    "approx": false,
    "fixed": true
  },
  "Avenue Félix POULAT N°4 (derrière WC public), Grenoble, France": {
    "lat": 45.190142,
    "lon": 5.726227,
    "approx": false,
    "fixed": true
  },
  "Boulevard Agutte SEMBAT N°9, angle rue MILLET, Grenoble, France": {
    "lat": 45.187356,
    "lon": 5.727291,
    "approx": false,
    "fixed": true
  },
  "Place Victor HUGO, face N°12, Grenoble, France": {
    "lat": 45.188812,
    "lon": 5.724569,
    "approx": false,
    "fixed": true
  },
  "Place Victor HUGO, face N°8, Grenoble, France": {
    "lat": 45.188812,
    "lon": 5.724569,
    "approx": false,
    "fixed": true
  },
  "Place Victor HUGO, côté Agutte Sembat, Grenoble, France": {
    "lat": 45.188812,
    "lon": 5.724569,
    "approx": false,
    "fixed": true
  },
  "Place Victor HUGO N°9, côté Agutte Sembat, Grenoble, France": {
    "lat": 45.188207,
    "lon": 5.726465,
    "approx": false,
    "fixed": true
  },
  "Boulevard GAMBETTA N°33, angle cours LAFONTAINE, Grenoble, France": {
    "lat": 45.186756,
    "lon": 5.724237,
    "approx": false,
    "fixed": true
  },
  "Rue LESDIGUIERES N°30, Grenoble, France": {
    "lat": 45.186854,
    "lon": 5.726705,
    "approx": false,
    "fixed": true
  },
  "Rue LESDIGUIERES N°26, Grenoble, France": {
    "lat": 45.186854,
    "lon": 5.726705,
    "approx": false,
    "fixed": true
  },
  "Rue Berthe de BOISSIEUX N°6 (square Silvestri), Grenoble, France": {
    "lat": 45.18487,
    "lon": 5.725172,
    "approx": false,
    "fixed": true
  },
  "Rue MARCEAU N°30, angle rue Colonel DUMONT, Grenoble, France": {
    "lat": 45.181372,
    "lon": 5.721077,
    "approx": false,
    "fixed": true
  },
  "Square Charles MICHEL N°2, Grenoble, France": {
    "lat": 45.181054,
    "lon": 5.717639,
    "approx": false,
    "fixed": true
  },
  "Place Jacqueline MARVAL N°3, Grenoble, France": {
    "lat": 45.184689,
    "lon": 5.720761,
    "approx": false,
    "fixed": true
  },
  "Place Jacqueline MARVAL N°2, Grenoble, France": {
    "lat": 45.184689,
    "lon": 5.720761,
    "approx": false,
    "fixed": true
  },
  "Place CHAMPIONNET N°8, Grenoble, France": {
    "lat": 45.185438,
    "lon": 5.722517,
    "approx": false,
    "fixed": true
  },
  "Place CONDORCET, Grenoble, France": {
    "lat": 45.185248,
    "lon": 5.72059,
    "approx": false,
    "fixed": true
  },
  "Cours Jean JAURES N°25, cours BERRIAT, Grenoble, France": {
    "lat": 45.188359,
    "lon": 5.719511,
    "approx": false,
    "fixed": true
  },
  "Rue BILLEREY N°8, angle rue JAY, Grenoble, France": {
    "lat": 45.18981,
    "lon": 5.721205,
    "approx": false,
    "fixed": true
  },
  "Rue JAY N°2, angle rue BILLEREY, Grenoble, France": {
    "lat": 45.18981,
    "lon": 5.721205,
    "approx": false,
    "fixed": true
  },
  "CATANE, avenue RHIN et DANUBE, Grenoble, France": {
    "lat": 45.175001,
    "lon": 5.705149,
    "approx": false,
    "fixed": true
  },
  "Avenue RHIN et DANUBE N°1, Grenoble, France": {
    "lat": 45.175001,
    "lon": 5.705149,
    "approx": false,
    "fixed": true
  },
  "Boulevard Joseph VALLIER N°57, Grenoble, France": {
    "lat": 45.180154,
    "lon": 5.710026,
    "approx": false,
    "fixed": true
  },
  "Avenue Joseph VALLIER N°35, Grenoble, France": {
    "lat": 45.180154,
    "lon": 5.710026,
    "approx": false,
    "fixed": true
  },
  "Rue Louis Le CARDONNEL N°2bis, bd Joseph VALLIER, Grenoble, France": {
    "lat": 45.180154,
    "lon": 5.710026,
    "approx": false,
    "fixed": true
  },
  "Rue Charles PEGUY N°23, face rue DUNKERQUE, Grenoble, France": {
    "lat": 45.178771,
    "lon": 5.714295,
    "approx": false,
    "fixed": true
  },
  "Rue des EAUX CLAIRES N°1, Grenoble, France": {
    "lat": 45.176159,
    "lon": 5.708927,
    "approx": false,
    "fixed": true
  },
  "Rue des EAUX CLAIRES N°27, Grenoble, France": {
    "lat": 45.176159,
    "lon": 5.708927,
    "approx": false,
    "fixed": true
  },
  "Rue Joseph BOUCHAYER N°31, Grenoble, France": {
    "lat": 45.177195,
    "lon": 5.710236,
    "approx": false,
    "fixed": true
  },
  "Cours de la LIBERATION N°32, angle rue des MARRONNIERS, Grenoble, France": {
    "lat": 45.17098,
    "lon": 5.71332,
    "approx": false,
    "fixed": true
  },
  "Rue des EAUX CLAIRES N°55, bd Roger SALENGRO, Grenoble, France": {
    "lat": 45.175024,
    "lon": 5.712646,
    "approx": false,
    "fixed": true
  },
  "Rue MARBEUF N°16, rue des CHAMPS ELYSEES, Grenoble, France": {
    "lat": 45.178693,
    "lon": 5.708728,
    "approx": false,
    "fixed": true
  },
  "Avenue RHIN et DANUBE, face Hôtel des Impôts, Grenoble, France": {
    "lat": 45.175001,
    "lon": 5.705149,
    "approx": false,
    "fixed": true
  },
  "Avenue RHIN et DANUBE N°48, angle rue SIBELLAS, Grenoble, France": {
    "lat": 45.175001,
    "lon": 5.705149,
    "approx": false,
    "fixed": true
  },
  "Rue ANATOLE FRANCE N°35, angle avenue RHIN et DANUBE, Grenoble, France": {
    "lat": 45.175001,
    "lon": 5.705149,
    "approx": false,
    "fixed": true
  },
  "Avenue RHIN et DANUBE N°70, Grenoble, France": {
    "lat": 45.175001,
    "lon": 5.705149,
    "approx": false,
    "fixed": true
  },
  "Avenue RHIN et DANUBE N°84, rue Paul STRAUSS, Grenoble, France": {
    "lat": 45.168762,
    "lon": 5.703613,
    "approx": false,
    "fixed": true
  },
  "Rue Albert REYNIER N°63 (parc Bachelard), Grenoble, France": {
    "lat": 45.166812,
    "lon": 5.705082,
    "approx": false,
    "fixed": true
  },
  "Rue Albert REYNIER N°59 (parc Bachelard), Grenoble, France": {
    "lat": 45.16683,
    "lon": 5.705064,
    "approx": false,
    "fixed": true
  },
  "Cours de la LIBERATION N°176, sous le pont rue Albert REYNIER, Grenoble, France": {
    "lat": 45.166473,
    "lon": 5.70699,
    "approx": false,
    "fixed": true
  },
  "Cours de la LIBERATION N°198, Grenoble, France": {
    "lat": 45.17098,
    "lon": 5.71332,
    "approx": false,
    "fixed": true
  },
  "Rue André ABRY N°18, Grenoble, France": {
    "lat": 45.168492,
    "lon": 5.713652,
    "approx": false,
    "fixed": true
  },
  "Cours de la LIBERATION N°106, Grenoble, France": {
    "lat": 45.17098,
    "lon": 5.71332,
    "approx": false,
    "fixed": true
  },
  "Rue Louise MICHEL N°24 (lycée), Grenoble, France": {
    "lat": 45.168803,
    "lon": 5.708401,
    "approx": false,
    "fixed": true
  },
  "Chemin MENEY, N°19, Grenoble, France": {
    "lat": 45.172291,
    "lon": 5.714796,
    "approx": false,
    "fixed": true
  },
  "Rue Capitaine CAMINE, face N°5, Grenoble, France": {
    "lat": 45.173545,
    "lon": 5.712938,
    "approx": false,
    "fixed": true
  },
  "Rue Anatole France N° 28, Grenoble, France": {
    "lat": 45.173112,
    "lon": 5.708817,
    "approx": false,
    "fixed": true
  },
  "Rue SIDI BRAHIM N°45, Grenoble, France": {
    "lat": 45.176885,
    "lon": 5.716762,
    "approx": false,
    "fixed": true
  },
  "Rue Léon JOUHAUX face N°1, boulevard CLEMENCEAU, Grenoble, France": {
    "lat": 45.186385,
    "lon": 5.743884,
    "approx": false,
    "fixed": true
  },
  "Rue Roger Louis LACHAT N°5, Grenoble, France": {
    "lat": 45.182958,
    "lon": 5.739051,
    "approx": false,
    "fixed": true
  },
  "Rue Colonel DRIANT N°2 (école maternelle), Grenoble, France": {
    "lat": 45.182934,
    "lon": 5.734821,
    "approx": false,
    "fixed": true
  },
  "Avenue Jean PERROT N°11, Grenoble, France": {
    "lat": 45.175418,
    "lon": 5.73754,
    "approx": false,
    "fixed": true
  },
  "Avenue Jean PERROT N°79, Grenoble, France": {
    "lat": 45.175418,
    "lon": 5.73754,
    "approx": false,
    "fixed": true
  },
  "Avenue Albert 1ier de BELGIQUE N°23, Grenoble, France": {
    "lat": 45.18194,
    "lon": 5.731257,
    "approx": false,
    "fixed": true
  },
  "Avenue Marcellin BERTHELOT N°4 (lycée Mounier), Grenoble, France": {
    "lat": 45.175507,
    "lon": 5.731884,
    "approx": false,
    "fixed": true
  },
  "Avenue Marcellin BERTHELOT N°38, face à la MC2, Grenoble, France": {
    "lat": 45.175507,
    "lon": 5.731884,
    "approx": false,
    "fixed": true
  },
  "Avenue Marcellin BERTHELOT N°56, Grenoble, France": {
    "lat": 45.175507,
    "lon": 5.731884,
    "approx": false,
    "fixed": true
  },
  "Rue de STALINGRAD parking Clos d'Or, Grenoble, France": {
    "lat": 45.174181,
    "lon": 5.72508,
    "approx": false,
    "fixed": true
  },
  "Rue des ALLIES N°101, angle rue Amable MATUSSIERE, Grenoble, France": {
    "lat": 45.170895,
    "lon": 5.720816,
    "approx": false,
    "fixed": true
  },
  "Rue des ALLIES N°117, angle rue MARQUIAN, Grenoble, France": {
    "lat": 45.17304,
    "lon": 5.717551,
    "approx": false,
    "fixed": true
  },
  "Rue Général MANGIN N°73Ter, Grenoble, France": {
    "lat": 45.172013,
    "lon": 5.716547,
    "approx": false,
    "fixed": true
  },
  "Avenue Léon BLUM N°82, Grenoble, France": {
    "lat": 45.165506,
    "lon": 5.719055,
    "approx": false,
    "fixed": true
  },
  "Rue René LESAGE N°6, Grenoble, France": {
    "lat": 45.169494,
    "lon": 5.720279,
    "approx": false,
    "fixed": true
  },
  "Rue René LESAGE N°16 (groupe scolaire), Grenoble, France": {
    "lat": 45.169494,
    "lon": 5.720279,
    "approx": false,
    "fixed": true
  },
  "Rue de STALINGRAD N°86, Grenoble, France": {
    "lat": 45.174181,
    "lon": 5.72508,
    "approx": false,
    "fixed": true
  },
  "Rue JACQUARD N°1, angle rue Honoré de BALZAC, Grenoble, France": {
    "lat": 45.175238,
    "lon": 5.721293,
    "approx": false,
    "fixed": true
  },
  "Rue Pierre BONNARD N°4, place Docteur GALLIMARD, Grenoble, France": {
    "lat": 45.175476,
    "lon": 5.726299,
    "approx": false,
    "fixed": true
  },
  "Rue Pierre BONNARD N°2, place Docteur GALLIMARD, Grenoble, France": {
    "lat": 45.175476,
    "lon": 5.726299,
    "approx": false,
    "fixed": true
  },
  "Rue Edouard VAILLANT N°33, rue des DEPORTES du 11/11/1943, Grenoble, France": {
    "lat": 45.17764,
    "lon": 5.727404,
    "approx": false,
    "fixed": true
  },
  "Rue de STALINGRAD N°58, Grenoble, France": {
    "lat": 45.174181,
    "lon": 5.72508,
    "approx": false,
    "fixed": true
  },
  "Rue des DEPORTES du 11/11/1943, face rue Paul BOURGET, Grenoble, France": {
    "lat": 45.178722,
    "lon": 5.727894,
    "approx": false,
    "fixed": true
  },
  "Rue Paul BOURGET N°5 (groupe scolaire Ferdinand Buisson), Grenoble, France": {
    "lat": 45.177777,
    "lon": 5.72822,
    "approx": false,
    "fixed": true
  },
  "Rue LEBRIX N°29, rue Léo LAGRANGE, Grenoble, France": {
    "lat": 45.177109,
    "lon": 5.722697,
    "approx": false,
    "fixed": true
  },
  "Boulevard Maréchal FOCH N°51, Grenoble, France": {
    "lat": 45.180931,
    "lon": 5.722246,
    "approx": false,
    "fixed": true
  },
  "Boulevard CLEMENCEAU N°42, Grenoble, France": {
    "lat": 45.184289,
    "lon": 5.739892,
    "approx": false,
    "fixed": true
  },
  "Boulevard CLEMENCEAU N°12, face rue du MONT FROID, Grenoble, France": {
    "lat": 45.184664,
    "lon": 5.742449,
    "approx": false,
    "fixed": true
  },
  "Rue Jules FLANDRIN N°3, Grenoble, France": {
    "lat": 45.187611,
    "lon": 5.746094,
    "approx": false,
    "fixed": true
  },
  "Avenue Jeanne d'ARC, rue Commandant PERREAU N°20, Grenoble, France": {
    "lat": 45.182876,
    "lon": 5.743908,
    "approx": false,
    "fixed": true
  },
  "Rue Claude GENIN N°57, Grenoble, France": {
    "lat": 45.181594,
    "lon": 5.744767,
    "approx": false,
    "fixed": true
  },
  "Rue CONDE, Grenoble, France": {
    "lat": 45.17944,
    "lon": 5.743813,
    "approx": false,
    "fixed": true
  },
  "Avenue Jeanne d'ARC N°84, Grenoble, France": {
    "lat": 45.182852,
    "lon": 5.744151,
    "approx": false,
    "fixed": true
  },
  "Place Joseph RIBOUD N°7, Grenoble, France": {
    "lat": 45.180018,
    "lon": 5.745614,
    "approx": false,
    "fixed": true
  },
  "Rue Henri POINCARE N°1(école), Grenoble, France": {
    "lat": 45.178552,
    "lon": 5.748254,
    "approx": false,
    "fixed": true
  },
  "Rue Marius BLANCHET, av du GRAND CHATELET, Grenoble, France": {
    "lat": 45.178612,
    "lon": 5.750463,
    "approx": false,
    "fixed": true
  },
  "Place de la COMMUNE, angle rue André ARGOUGES, Grenoble, France": {
    "lat": 45.177827,
    "lon": 5.744127,
    "approx": false,
    "fixed": true
  },
  "Rue André ARGOUGES N°14, Grenoble, France": {
    "lat": 45.177827,
    "lon": 5.744127,
    "approx": false,
    "fixed": true
  },
  "Rue Jean BART face N°33, Grenoble, France": {
    "lat": 45.176958,
    "lon": 5.74164,
    "approx": false,
    "fixed": true
  },
  "Rue Léon JOUHAUX N°59 Bis (entrée collège), Grenoble, France": {
    "lat": 45.17722,
    "lon": 5.742969,
    "approx": false,
    "fixed": true
  },
  "Rue Léon JOUHAUX N°61, Grenoble, France": {
    "lat": 45.17722,
    "lon": 5.742969,
    "approx": false,
    "fixed": true
  },
  "Rue Georges de MANTEYER N°15, Grenoble, France": {
    "lat": 45.172911,
    "lon": 5.742326,
    "approx": false,
    "fixed": true
  },
  "Rue Georges de MANTEYER N°33, Grenoble, France": {
    "lat": 45.172911,
    "lon": 5.742326,
    "approx": false,
    "fixed": true
  },
  "Rue LETONNELIER N°4, Grenoble, France": {
    "lat": 45.170274,
    "lon": 5.743086,
    "approx": false,
    "fixed": true
  },
  "Avenue TEISSEIRE N°22 (Groupe scolaire), Grenoble, France": {
    "lat": 45.169477,
    "lon": 5.742014,
    "approx": false,
    "fixed": true
  },
  "Avenue Jean PERROT, avenue Paul COCAT N°31, Grenoble, France": {
    "lat": 45.175418,
    "lon": 5.73754,
    "approx": false,
    "fixed": true
  },
  "Place Salvador ALLENDE N°4, Grenoble, France": {
    "lat": 45.171395,
    "lon": 5.739774,
    "approx": false,
    "fixed": true
  },
  "Rue Ninon VALLIN N°2, Grenoble, France": {
    "lat": 45.171346,
    "lon": 5.7385,
    "approx": false,
    "fixed": true
  },
  "Avenue Jean PERROT N°107, Grenoble, France": {
    "lat": 45.175418,
    "lon": 5.73754,
    "approx": false,
    "fixed": true
  },
  "MC2 (parking), rue Paul CLAUDEL, Grenoble, France": {
    "lat": 45.172013,
    "lon": 5.73487,
    "approx": false,
    "fixed": true
  },
  "Rue Gérard PHILIPPE, avenue MALHERBE N°28, Grenoble, France": {
    "lat": 45.170314,
    "lon": 5.733918,
    "approx": false,
    "fixed": true
  },
  "Avenue MALHERBE N°25 (groupe scolaire), Grenoble, France": {
    "lat": 45.169739,
    "lon": 5.736369,
    "approx": false,
    "fixed": true
  },
  "Avenue MALHERBE N°13, Grenoble, France": {
    "lat": 45.169739,
    "lon": 5.736369,
    "approx": false,
    "fixed": true
  },
  "Rue TURGOT N°2, sous la voûte, Grenoble, France": {
    "lat": 45.168637,
    "lon": 5.737634,
    "approx": false,
    "fixed": true
  },
  "Avenue MALHERBE N°31, Grenoble, France": {
    "lat": 45.169739,
    "lon": 5.736369,
    "approx": false,
    "fixed": true
  },
  "Rue des Alliés N°1, avenue Marie REYNOARD, Grenoble, France": {
    "lat": 45.16851,
    "lon": 5.731581,
    "approx": false,
    "fixed": true
  },
  "Rue Guy MOQUET N°1, Grenoble, France": {
    "lat": 45.168221,
    "lon": 5.726101,
    "approx": false,
    "fixed": true
  },
  "Avenue Marie REYNOARD N°10, Grenoble, France": {
    "lat": 45.163711,
    "lon": 5.728776,
    "approx": false,
    "fixed": true
  },
  "Allée des Deux MONDES N°50, Grenoble, France": {
    "lat": 45.16647,
    "lon": 5.726748,
    "approx": false,
    "fixed": true
  },
  "Rue Alfred de MUSSET N°1Ter, Grenoble, France": {
    "lat": 45.16466,
    "lon": 5.72647,
    "approx": false,
    "fixed": true
  },
  "Placette PREMOL, rue du VILLAGE face N°2, Grenoble, France": {
    "lat": 45.163814,
    "lon": 5.727883,
    "approx": false,
    "fixed": true
  },
  "Rue Aimé PUPIN, rue Roger FRANCOIS, Grenoble, France": {
    "lat": 45.161512,
    "lon": 5.724048,
    "approx": false,
    "fixed": true
  },
  "Rue Aimé PUPIN N°8 (côté sud du tunnel), Grenoble, France": {
    "lat": 45.161978,
    "lon": 5.723691,
    "approx": false,
    "fixed": true
  },
  "Rue Claude KOGAN, angle rue Christophe TURC, Grenoble, France": {
    "lat": 45.161753,
    "lon": 5.725234,
    "approx": false,
    "fixed": true
  },
  "Rue Gusto GERVASOTI, angle rue Christophe TURC, Grenoble, France": {
    "lat": 45.161753,
    "lon": 5.725234,
    "approx": false,
    "fixed": true
  },
  "Avenue Edmond ESMONIN N°12 (piscine des Dauphins), Grenoble, France": {
    "lat": 45.160629,
    "lon": 5.719773,
    "approx": false,
    "fixed": true
  },
  "Avenue de l'EUROPE, face rue Maurice DODERO N°43, Grenoble, France": {
    "lat": 45.161563,
    "lon": 5.730725,
    "approx": false,
    "fixed": true
  },
  "Arrêt de tram ARLEQUIN, rue Maurice DODERO, Grenoble, France": {
    "lat": 45.161563,
    "lon": 5.730725,
    "approx": false,
    "fixed": true
  },
  "Galerie de l'ARLEQUIN N°110, Grenoble, France": {
    "lat": 45.163716,
    "lon": 5.732379,
    "approx": false,
    "fixed": true
  },
  "Galerie de l'ARLEQUIN N°70, Grenoble, France": {
    "lat": 45.163716,
    "lon": 5.732379,
    "approx": false,
    "fixed": true
  },
  "Galerie de l'ARLEQUIN N°60, Grenoble, France": {
    "lat": 45.163716,
    "lon": 5.732379,
    "approx": false,
    "fixed": true
  },
  "Galerie de l'ARLEQUIN N°30, Grenoble, France": {
    "lat": 45.163716,
    "lon": 5.732379,
    "approx": false,
    "fixed": true
  },
  "Galerie de l'ARLEQUIN N°150, Grenoble, France": {
    "lat": 45.163716,
    "lon": 5.732379,
    "approx": false,
    "fixed": true
  },
  "Galerie de l'ARLEQUIN N°170, Grenoble, France": {
    "lat": 45.163716,
    "lon": 5.732379,
    "approx": false,
    "fixed": true
  },
  "Allée des Genêts N°7 (école), Grenoble, France": {
    "lat": 45.161068,
    "lon": 5.734429,
    "approx": false,
    "fixed": true
  },
  "Avenue de CONSTANTINE N°22, Grenoble, France": {
    "lat": 45.160231,
    "lon": 5.734289,
    "approx": false,
    "fixed": true
  },
  "Place des GEANTS N°40, Grenoble, France": {
    "lat": 45.158108,
    "lon": 5.732145,
    "approx": false,
    "fixed": true
  },
  "Rue Paul HELBRONNER N°16Bis (école), Grenoble, France": {
    "lat": 45.165817,
    "lon": 5.739575,
    "approx": false,
    "fixed": true
  },
  "Avenue La BRUYERE, face N°30 (école), Grenoble, France": {
    "lat": 45.166673,
    "lon": 5.732235,
    "approx": false,
    "fixed": true
  },
  "Avenue de l'EUROPE N°34 (bourse du travail), Grenoble, France": {
    "lat": 45.159264,
    "lon": 5.733502,
    "approx": false,
    "fixed": true
  }
};
  try { localStorage.setItem(KEY, JSON.stringify(FIXED)); localStorage.setItem(RESET, "1"); } catch (_) {}
})();
