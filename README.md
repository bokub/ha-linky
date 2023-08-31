# Home Assistant Linky Add-on

[![Build Status](https://flat.badgen.net/github/checks/bokub/ha-linky?label=build)](https://github.com/bokub/ha-linky/actions/workflows/run.yml?query=branch%3Amaster)
[![Version](https://flat.badgen.net/github/release/bokub/ha-linky?label=version)](https://github.com/bokub/ha-linky/releases)
[![Code style](https://flat.badgen.net/badge/code%20style/prettier/ff69b4)](https://github.com/bokub/prettier-config)

> A **Home Assistant** add-on to sync Energy dashboards with your **Linky** smart meter

**N.B**: Because this tool is targeted for French people, the documentation is...in French!

---

**HA Linky** est un add-on pour Home Assistant permettant de synchroniser les données votre compteur Linky avec les tableaux de bord d'énergie de Home Assistant.

Il utilise le module [@bokub/linky](https://github.com/bokub/linky) et le service [Conso API](https://conso.boris.sh/) pour communiquer avec Enedis et récupérer votre consommation.

![Energy](https://github.com/bokub/ha-linky/assets/17952318/36e7be04-953c-4c2c-9cff-f45016893002)

## Prérequis

Pour utiliser cet add-on, il vous faut :

- Un compteur Linky
- Un espace client Enedis
- Un token d'accès, à générer sur [Conso API](https://conso.boris.sh/)

## Installation

- Cliquez [ici](https://my.home-assistant.io/redirect/supervisor_add_addon_repository/?repository_url=https%3A%2F%2Fgithub.com%2Fbokub%2Fha-linky) pour ajouter le repository à Home Assistant. Si le lien ne fonctionne pas :
  - Depuis Home Assistant, ouvrez le menu "_Paramètres_" / "_Settings_", puis "_Modules complémentaires_" / "_Add-ons_"
  - Cliquez sur le bouton "_Boutique_" / "_Store_" en bas à droite
  - Cliquer sur les trois points en haut à droite, puis "_Dépôts_" / "_Repositories_"
  - Ajoutez `https://github.com/bokub/ha-linky`
- Cliquez sur "_Ajouter_" / "_Add_" puis fermez la boite de dialogue
- Cherchez "_Linky_" dans la liste des add-ons et cliquez dessus (vous pouvez utiliser la barre de recherche)
- Installez l'add-on en cliquant sur le bouton dédié

## Configuration

Une fois l'add-on installé, rendez-vous dans l'onglet "_Configuration_" et remplissez les champs vides :

- `consumption PRM` : Votre numéro de PRM (14 chiffres).
  - Si vous ne le connaissez pas, entrez votre token sur [la page exemples](https://conso.boris.sh/exemples) de Conso API et le PRM s'affichera dans le champ "_PRM_"
  - Vous pouvez également le trouver sur votre compteur en appuyant sur la touche **+** jusqu’à lire la valeur du "_numéro de PRM_".
- `consumption token` : Votre token _Conso API_
- `consumption action` : Laissez la valeur par défaut, `sync`

Appliquez les modifications et démarrez / redémarrez l'add-on si ce n'est pas déjà fait

## Utilisation / fonctionnement

Une fois l'add-on démarré, rendez-vous dans l'onglet "_Journal_" / "_Log_" pour suivre la progression de la synchronisation.

Au premier lancement, **HA Linky** essaiera de récupérer toutes les données de consommation depuis la date d'installation de votre compteur Linky.

Ensuite, il synchronisera les données deux fois par jour tant qu'il n'est pas arrêté :

- Une fois entre 6h et 7h du matin pour récupérer les données de la veille
- Une fois entre 9h et 10h du matin au cas où la première synchronisation a échoué

Vous pourrez vérifier le bon fonctionnement de l'add-on en vous rendant dans l'onglet "_Journal_" / "_Log_", où toutes les informations utiles seront affichées.

### Bon à savoir

- Les données d’une journée ne sont pas accessibles en temps réel, il faut attendre le lendemain de leur mesure pour pouvoir les récupérer, entre 6h et 10h.
- Pour les dates récentes (moins de 7 jours), **HA Linky** essaiera de récupérer en priorité des données par demi-heure
- Pour les dates plus anciennes, **HA Linky** se contentera des données quotidiennes. Vous verrez alors une seule grande barre entre 0h et 1h du matin sur votre tableau de bord d'énergie si vous affichez le graphique détaillé d'une telle journée.

### Tableaux de bord

Pour visualiser les données de **HA Linky** dans vos tableaux de bord d'énergie :

- Ouvrez le menu "_Paramètres_" / "_Settings_", puis "_Tableaux de bord_" / "_Dashboards_", puis "_Énergie_" / "_Energy_"
- Dans la section "_Réseau électrique_" / "_Electricity grid_", cliquez sur "_Ajouter une consommation_" / "_Add consumption_"
- Choisissez la statistique `linky:<PRM>` (où `<PRM>` est votre numéro de PRM)
- Cliquez sur "_Enregistrer_" / "_Save_"

### Remise à zéro

En cas de problème, il est toujours possible d'effacer toutes les données créées par **HA Linky**

Revenez sur l'onglet "_Configuration_" de l'add-on et changez la valeur de `consumption action` à `reset`, puis appliquez les modifications et redémarrez l'add-on.

Ouvrez ensuite l'onglet "_Journal_" / "_Log_" pour vérifier que la remise à zéro s'est bien déroulée.

Au prochain démarrage, si `consumption action` est repassé à `sync`, **HA Linky** réimportera à nouveau toutes vos données. Cette manipulation peut surcharger le serveur de **Conso API**, ne l'utilisez donc que si nécessaire pour ne pas risquer un ban !
