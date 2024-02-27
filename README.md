# Home Assistant Linky Add-on

[![Build Status](https://flat.badgen.net/github/checks/bokub/ha-linky?label=build)](https://github.com/bokub/ha-linky/actions/workflows/run.yml?query=branch%3Amaster)
[![Version](https://flat.badgen.net/github/release/bokub/ha-linky?label=version)](https://github.com/bokub/ha-linky/releases)
[![Code style](https://flat.badgen.net/badge/code%20style/prettier/ff69b4)](https://github.com/bokub/prettier-config)

> A **Home Assistant** add-on to sync Energy dashboards with your **Linky** smart meter

**N.B**: Because this tool is targeted for French users, the documentation is...in French!

---

**HA Linky** est un add-on pour Home Assistant permettant de synchroniser les données votre compteur Linky avec les tableaux de bord d'énergie de Home Assistant.

Il utilise le module [@bokub/linky](https://github.com/bokub/linky) et le service [Conso API](https://conso.boris.sh/) pour communiquer avec Enedis et récupérer votre consommation.

<p align="center">
  <img src="https://github.com/bokub/ha-linky/assets/17952318/ed53a1d5-e0c6-4c50-88ac-576f6542e63b">
</p>

## Prérequis

Pour utiliser cet add-on, il vous faut :

- Un compteur Linky
- Un espace client Enedis
- La collecte de la consommation horaire activée sur votre espace client Enedis ([tutoriel](https://github.com/bokub/ha-linky/wiki/Activer-la-collecte-de-la-consommation-horaire))
- Un token d'accès, à générer sur [Conso API](https://conso.boris.sh/)

## Installation

- Cliquez [ici](https://my.home-assistant.io/redirect/supervisor_add_addon_repository/?repository_url=https%3A%2F%2Fgithub.com%2Fbokub%2Fha-linky) pour ajouter le repository à Home Assistant. Si le lien ne fonctionne pas :
  - Depuis Home Assistant, ouvrez le menu _Paramètres_ / _Settings_, puis _Modules complémentaires_ / _Add-ons_
  - Cliquez sur le bouton _Boutique_ / _Store_ en bas à droite
  - Cliquer sur les trois points en haut à droite, puis _Dépôts_ / _Repositories_
  - Ajoutez `https://github.com/bokub/ha-linky`
- Cliquez sur _Ajouter_ / _Add_ puis fermez la boite de dialogue
- Cherchez _Linky_ dans la liste des add-ons et cliquez dessus (vous pouvez utiliser la barre de recherche)
- Installez l'add-on en cliquant sur le bouton dédié

## Configuration

Une fois l'add-on installé, rendez-vous dans l'onglet _Configuration_.

La configuration YAML de base comporte 2 compteurs :

- Le premier pour mesurer la **consommation** d'énergie
- Le deuxième pour mesurer la **production** d'énergie

Vous pouvez effacer les lignes correspondant à la production si vous ne produisez pas d'électricité, ou rajouter d'autres compteurs si vous en avez besoin.

Pour chaque compteur, remplissez les champs suivants :

- `prm` : Votre numéro de PRM (14 chiffres).
  - Si vous ne le connaissez pas, entrez votre token sur [la page exemples](https://conso.boris.sh/exemples) de Conso API et le PRM s'affichera dans le champ _PRM_
  - Vous pouvez également le trouver sur votre compteur en appuyant sur la touche **+** jusqu’à lire la valeur du _numéro de PRM_.
  - Selon les cas, le PRM de consommation peut être identique ou différent de celui qui gère la production.
  - Les 14 chiffres du PRM doivent être saisis entre guillemets `"`, comme dans l'exemple ci-dessous
- `token` : Votre token **Conso API**
- `name` : Choisissez le nom qui sera affiché dans les tableaux de bord d'énergie. Vous pourrez le changer plus tard si vous le souhaitez.
- `action` : Laissez la valeur par défaut: `sync`
- `production` : Choisissez `true` si le compteur gère la production d'énergie, `false` sinon

> Exemple de configuration pour un seul compteur, en consommation :

```yaml
- prm: '18435095771264'
  token: abcdef.ghijklmnopqrs.tuvwxyz
  name: Consommation Linky
  action: sync
  production: false
```

Appliquez les modifications et démarrez / redémarrez l'add-on si ce n'est pas déjà fait

## Utilisation / fonctionnement

Une fois l'add-on démarré, rendez-vous dans l'onglet _Journal_ / _Log_ pour suivre la progression de la synchronisation.

Au premier lancement, **HA Linky** essaiera de récupérer jusqu'à **1 an** de données historiques (sauf si vous fournissez votre propre export CSV).

Ensuite, il synchronisera les données deux fois par jour tant qu'il n'est pas arrêté :

- Une fois entre 6h et 7h du matin pour récupérer les données de la veille
- Une fois entre 9h et 10h du matin au cas où la première synchronisation a échoué

Vous pourrez vérifier le bon fonctionnement de l'add-on en vous rendant dans l'onglet _Journal_ / _Log_, où toutes les informations utiles seront affichées.

### Tableaux de bord

Pour visualiser les données de **HA Linky** dans vos tableaux de bord d'énergie :

- Cliquez [ici](https://my.home-assistant.io/redirect/config_energy/), ou ouvrez le menu _Paramètres_ / _Settings_, puis _Tableaux de bord_ / _Dashboards_, puis _Énergie_ / _Energy_
- Dans la section _Réseau électrique_ / _Electricity grid_, cliquez sur _Ajouter une consommation_ / _Add consumption_
- Choisissez la statistique correspondant au `name` que vous avez choisi à l'étape de configuration
- Cliquez sur _Enregistrer_ / _Save_

### Bon à savoir

- Les données d’une journée ne sont pas accessibles en temps réel, il faut attendre **le lendemain de leur mesure** pour pouvoir les récupérer, entre 6h et 10h.
- Pour les dates récentes (moins de 7 jours), **HA Linky** essaiera de récupérer en priorité des données par demi-heure
- Pour les dates plus anciennes, **HA Linky** récupèrera seulement des données quotidiennes. Vous verrez alors une seule grande barre entre 0h et 1h du matin sur votre tableau de bord d'énergie si vous affichez le graphique détaillé d'une telle journée.

### Remise à zéro

En cas de problème, il est toujours possible d'effacer toutes les données de consommation ou de production créées par **HA Linky**

Revenez sur l'onglet _Configuration_ de l'add-on et changez la valeur de `action` à `reset` sur le compteur qui vous intéresse, puis appliquez les modifications et redémarrez l'add-on.

Ouvrez ensuite l'onglet _Journal_ / _Log_ pour vérifier que la remise à zéro s'est bien déroulée.

Au prochain démarrage, si `action` est repassé à `sync`, **HA Linky** réimportera à nouveau vos données historiques, soit via Conso API, soit via un fichier CSV si vous en avez fourni un (voir paragraphe suivant).

### Import d'historique CSV

Lors de l'**initialisation**, HA Linky télécharge jusqu'à **1 an** de données **quotidiennes** via Conso API.

Si vous souhaitez un historique **plus long** ainsi qu'une **précision horaire**, vous pouvez importer un fichier CSV à partir duquel HA Linky pourra extraire les données.

La démarche à suivre est la suivante :

- Téléchargez un export de vos données **horaires** depuis votre espace client Enedis ([tutoriel](https://github.com/bokub/ha-linky/wiki/T%C3%A9l%C3%A9charger-son-historique-au-format-CSV))
- Déposez ce fichier dans le dossier `/addon_configs/cf6b56a3_linky` ([tutoriel](https://github.com/bokub/ha-linky/wiki/Importer-un-fichier-CSV-dans-Home-Assistant))
- Si vous avez déjà importé des données dans Home Assistant, faites une remise à zéro en suivant le paragraphe précédent
- Repassez l'action du compteur à `sync` et redémarrez l'add-on
- Si un fichier CSV correspondant à votre PRM est trouvé, HA Linky l'utilisera pour initialiser les données au lieu d'appeler l'API.

## Installation standalone

Si votre installation de Home Assistant ne vous permet pas d'accéder au système d'add-ons, il est également possible de lancer HA Linky en utilisant Docker

> [!NOTE]
> Cette méthode n'est pas recommandée et fait office de solution de **dépannage** pour les personnes ne voulant pas utiliser HAOS et son système d'add-ons.
>
> Vous avez choisi d'installer Home Assistant avec une méthode "avancée", vous devriez donc maitriser vos outils.
> Je ne fournis **pas d'aide** concernant l'utilisation de Docker, Kubernetes, ou tout système autre que HAOS.

### Setup

Construisez une image Docker `ha-linky` adaptée à votre système avec la commande suivante :

```sh
docker build https://github.com/bokub/ha-linky.git -f standalone.Dockerfile -t ha-linky
```

Créez ensuite un fichier nommé `options.json`, au format suivant, puis suivez les instructions du paragraphe "Configuration" ci-dessus pour le remplir.

```json
{
  "meters": [
    {
      "prm": "",
      "token": "",
      "name": "Linky consumption",
      "action": "sync",
      "production": false
    },
    {
      "prm": "",
      "token": "",
      "name": "Linky production",
      "action": "sync",
      "production": true
    }
  ]
}
```

Créez un jeton d'accès longue durée depuis la page de votre profil Home Assistant (accessible en cliquant sur vos initiales en bas du menu latéral)

### Lancement

Vous pouvez désormais lancer l'image Docker de HA Linky avec la commande `docker run` **ou** via Docker compose, selon vos préférences.

Dans les deux cas, remplacez :

- `<options-folder>` par le **dossier** contenant le fichier `options.json`
- `<jeton>` par le jeton d'accès longue durée que vous avez créé juste avant **dans Home Assistant**
- `<ha-ip>` par l'**IP** de votre instance Home assistant (avec le port si nécessaire)

```sh
# docker run
docker run -e SUPERVISOR_TOKEN='<jeton>' -e WS_URL='ws://<ha-ip>/api/websocket' -v <options-folder>:/data ha-linky
```

```yml
# docker-compose.yml
services:
  ha-linky:
    image: ha-linky
    environment:
      - SUPERVISOR_TOKEN=<jeton>
      - WS_URL=ws://<ha-ip>/api/websocket
    volumes:
      - <options-folder>:/data
```
