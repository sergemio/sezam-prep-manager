// Remplace a chaque deploiement par le SHA du commit (.github/workflows/pages.yml).
// La valeur "dev" ci-dessous ne sert qu'en local : version.json porte la meme, donc
// version-check.js ne declenche aucun rechargement pendant le developpement.
window.__BUILD__ = 'dev';
