/**
 * Service worker — permet a l'app de DEMARRER sans reseau.
 *
 * LE PROBLEME. Le wifi de la cuisine tombe, ou l'iPad sort de veille avant que la
 * connexion soit revenue. Jusqu'ici ce fichier ne mettait rien en cache : recharger
 * la page dans ces conditions donnait un ecran blanc, et le travail en cours etait
 * perdu. C'est aussi le prealable a la file d'ecritures hors ligne — la rejouer au
 * retour du reseau ne sert a rien si l'app ne peut meme pas se charger.
 *
 * RESEAU D'ABORD, CACHE EN SECOURS — et surtout pas l'inverse.
 * Servir le cache en premier figerait la version installee : build-info.js resterait
 * eternellement perime, et la mise a jour automatique (version-check.js) rechargerait
 * une tablette qui ne changerait jamais de version. Le reseau reste donc la source, le
 * cache n'est qu'un filet quand il ne repond pas.
 *
 * DEUX EXCEPTIONS, chacune pour une raison precise :
 *   - version.json dit quelle version est PUBLIEE. Le servir depuis un cache le ferait
 *     mentir. Il n'est jamais intercepte ; hors ligne son fetch echoue, et
 *     version-check.js sait deja ne rien faire dans ce cas.
 *   - La base Firebase n'est pas un fichier. Ses requetes passent sans etre touchees.
 *
 * PAS DE LISTE DE FICHIERS A PRE-CHARGER. Une liste en dur se perime en silence : on
 * ajoute un script, on oublie la liste, et le mode hors ligne casse sans prevenir. Ici
 * chaque reponse obtenue est rangee au passage — apres une visite normale, tout ce dont
 * la page a besoin est la, y compris le SDK Firebase servi par gstatic (sans lui, les
 * imports du module echouent et l'app ne demarre pas du tout).
 */
const CACHE = 'pm-v1';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
    event.waitUntil(
        // Un changement de strategie laisserait sinon l'ancien cache occuper la place
        // sans que plus rien ne le lise.
        caches.keys()
            .then((noms) => Promise.all(noms.filter((n) => n !== CACHE).map((n) => caches.delete(n))))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const req = event.request;
    if (req.method !== 'GET') return;

    const url = new URL(req.url);
    if (url.pathname.endsWith('/version.json')) return;
    if (/firebasedatabase\.app$|firebaseio\.com$|googleapis\.com$/.test(url.hostname)) return;

    event.respondWith(
        fetch(req).then((res) => {
            if (res.ok) {
                const copie = res.clone();
                // Volontairement SANS event.waitUntil : l'appeler depuis une suite
                // asynchrone est refuse des que l'evenement n'est plus actif, et
                // l'exception ferait echouer la REPONSE — donc le fichier lui-meme.
                // Le rangement est secondaire : rate, il se refera au chargement suivant.
                caches.open(CACHE).then((c) => c.put(req, copie)).catch(() => {});
            }
            return res;
        }).catch(() => caches.match(req).then((trouve) => trouve || Response.error()))
    );
});
