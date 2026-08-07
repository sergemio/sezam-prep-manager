/**
 * Auto-update — garde les tablettes de la cuisine sur la derniere version publiee.
 *
 * LE PROBLEME. Un iPad garde son onglet ouvert pendant des jours : la page n'est jamais
 * rechargee, donc l'app tourne indefiniment sur le code telecharge le premier jour. Le
 * 05/08/2026 une livraison a ete saisie depuis une version anterieure a l'ecran
 * Commande/Reception — l'app ne proposait tout simplement pas la fonctionnalite. Un hard
 * refresh sur iPad n'est pas une manip qu'on demande a une equipe en plein service.
 *
 * LE MECANISME. Deux fichiers sont produits a chaque deploiement (.github/workflows/pages.yml)
 * a partir du SHA du commit, donc impossibles a oublier :
 *   - build-info.js  -> window.__BUILD__, mis en cache AVEC les autres scripts : il dit
 *                       quelle version le navigateur EXECUTE reellement.
 *   - version.json   -> lu avec cache:'no-store', toujours frais : il dit quelle version
 *                       est PUBLIEE.
 * Les deux different => le code en memoire est perime => on recharge.
 *
 * DEUX PRECAUTIONS, chacune pour une bonne raison :
 *
 * 1. Jamais sous les doigts de quelqu'un. Recharger pendant un comptage ou une saisie
 *    ferait perdre le travail en cours. Le rechargement est reporte jusqu'a ce que l'ecran
 *    soit calme (voir isBusy), puis applique.
 *
 * 2. Jamais en boucle. GitHub Pages sert les scripts en max-age=600 : dans les dix minutes
 *    qui suivent une publication, un rechargement peut TRES BIEN reservir l'ancien JS
 *    depuis le cache. build-info.js serait alors toujours perime, on rechargerait encore,
 *    et ainsi de suite — une tablette bloquee en boucle de rechargement pendant le service.
 *    On memorise donc la tentative : si elle n'a pas pris, on attend l'expiration du cache
 *    avant de reessayer.
 */
(function () {
    'use strict';

    // Le service worker (repli hors ligne) s'enregistre ici parce que ce fichier est le
    // seul charge par les TROIS pages. La ligne vivait dans index.html : une tablette
    // ouverte sur l'inventaire ne l'installait donc jamais, et rechargeait sur un ecran
    // blanc des que le wifi tombait. Meme sujet que la mise a jour ci-dessous : garder
    // l'app installee dans un etat correct.
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js').catch(function () {
            /* un enregistrement refuse (page non securisee, mode prive) ne doit pas
               empecher la verification de version de fonctionner */
        });
    }

    var CHECK_INTERVAL_MS = 15 * 60 * 1000;  // verification periodique
    var CACHE_WINDOW_MS = 11 * 60 * 1000;    // > max-age=600 de GitHub Pages
    var TRIED_BUILD_KEY = 'pmUpdateTriedBuild';
    var TRIED_AT_KEY = 'pmUpdateTriedAt';

    var pendingBuild = null;  // version publiee en attente d'un moment calme
    var checking = false;

    function store(key, value) {
        try { localStorage.setItem(key, value); } catch (e) { /* mode prive */ }
    }
    function read(key) {
        try { return localStorage.getItem(key); } catch (e) { return null; }
    }

    // Vrai des que quelqu'un est en train de faire quelque chose. Dans le doute, on
    // considere l'app occupee : reporter une mise a jour ne coute rien, interrompre une
    // saisie coute le travail de quelqu'un.
    function isBusy() {
        if (document.querySelector('.modal-backdrop')) return true;

        var el = document.activeElement;
        if (el && /^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName)) return true;

        // Les deux ecrans de saisie longue : Full Count (I&C) et Prep Check (PM).
        var screens = ['count-interface', 'prep-check-interface'];
        for (var i = 0; i < screens.length; i++) {
            var node = document.getElementById(screens[i]);
            if (node && node.offsetParent !== null) return true;
        }
        return false;
    }

    function applyUpdate(build) {
        store(TRIED_BUILD_KEY, build);
        store(TRIED_AT_KEY, String(Date.now()));
        // replace() plutot que reload() : pas d'entree ajoutee dans l'historique, donc le
        // bouton "retour" ne ramene pas sur une page morte.
        window.location.replace(window.location.pathname + window.location.search);
    }

    // Une tentative pour ce meme build vient d'avoir lieu et n'a manifestement rien
    // change : les scripts sortent encore du cache navigateur. Inutile d'insister avant
    // son expiration, sinon la tablette recharge en boucle.
    function recentlyTried(build) {
        if (read(TRIED_BUILD_KEY) !== build) return false;
        var at = parseInt(read(TRIED_AT_KEY), 10);
        if (!at) return false;
        return (Date.now() - at) < CACHE_WINDOW_MS;
    }

    function check() {
        if (checking) return;
        var running = window.__BUILD__;
        // Pas de build embarque (developpement local, ou build-info.js pas encore
        // deploye) : rien a comparer, on ne fait rien plutot que de deviner.
        if (typeof running !== 'string' || !running) return;

        checking = true;
        fetch('version.json', { cache: 'no-store' })
            .then(function (r) { return r.ok ? r.json() : null; })
            .then(function (data) {
                var published = data && data.build;
                if (!published || published === running) {
                    pendingBuild = null;
                    return;
                }
                if (recentlyTried(published)) return;

                pendingBuild = published;
                if (!isBusy()) applyUpdate(published);
            })
            .catch(function () { /* hors ligne : on reessaiera */ })
            .then(function () { checking = false; });
    }

    // Une mise a jour reportee s'applique des que l'ecran redevient calme, sans attendre
    // la prochaine verification : c'est le cas frequent — quelqu'un finit son comptage.
    function applyIfNowIdle() {
        if (pendingBuild && !isBusy() && !recentlyTried(pendingBuild)) {
            applyUpdate(pendingBuild);
        }
    }

    // Au demarrage, au retour de veille (le cas de l'iPad qu'on reprend le matin), et
    // periodiquement pour la tablette qui reste allumee toute la journee.
    window.addEventListener('load', check);
    document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'visible') check();
    });
    window.addEventListener('pageshow', function (e) { if (e.persisted) check(); });
    setInterval(check, CHECK_INTERVAL_MS);

    // Sondage leger : detecte la fin d'un comptage ou la fermeture d'un modal.
    setInterval(applyIfNowIdle, 20 * 1000);

    // Exposé pour les tests et pour un declenchement manuel depuis la console.
    window.__checkForUpdate = check;
    window.__updateIsBusy = isBusy;
})();
