# Changelog

## 1.6.1 - 28 octobre 2025

- Ajout de logs pour mieux comprendre les problèmes de calcul des coûts

## 1.6.0 - 15 octobre 2025

- Ajout du calcul des coûts pour les PRM en production
- Prise en compte des demi-heures dans le calcul des coûts
- Modification du format du fichier CSV pour l'import d'historique (compatible avec [Conso Downloader](https://github.com/bokub/conso-downloader/tree/master?tab=readme-ov-file#conso-downloader))

## 1.5.0 - 23 juillet 2024

- Ajout du calcul des coûts

## 1.4.0 - 27 février 2024

- Ajout de l'import de données historiques via un fichier CSV

## 1.3.1 - 25 février 2024

- Correction de la synchronisation quotidienne qui ne se lançait pas correctement

## 1.3.0 - 22 février 2024

- Nouveau format de configuration
  - **N.B**: Votre ancienne migration sera **automatiquement** convertie au nouveau format au premier démarrage de l'add-on. Vous devrez peut-être rafraîchir la page pour voir les changements apparaître dans l'onglet configuration.
- Ajout de la possibilité de gérer plusieurs compteurs (#22)
- Correctif d'un bug qui survenait lors d'un trou de données de 7 jours exactement (#16)

## 1.2.0 - 15 novembre 2023

- Ajout de la synchronisation de la production d'énergie - merci à @cddu33 pour son aide !
