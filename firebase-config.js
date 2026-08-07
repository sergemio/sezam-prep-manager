// Firebase Configuration & Database Wrapper
// Single source of truth — loaded by all pages
// Formes des données (prepItem / icItem / task / log) documentées dans ARCHITECTURE.md

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, set, onValue, get, update, remove, query, orderByKey, startAt, endBefore, runTransaction } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyDhp7efZHDj2fw3qx9XOW41YcaR3pWu3Hs",
    authDomain: "sezam-prep-manager.firebaseapp.com",
    projectId: "sezam-prep-manager",
    storageBucket: "sezam-prep-manager.appspot.com",
    messagingSenderId: "79982392454",
    appId: "1:79982392454:web:326e2e83a3dde894810d07",
    databaseURL: "https://sezam-prep-manager-default-rtdb.europe-west1.firebasedatabase.app"
};

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

// Firebase set()/update() throw SYNCHRONOUSLY on any undefined value. A synchronous
// throw means the caller's .catch() is never even attached: the exception escapes the
// click handler and aborts everything after it — a count screen freezes on the item,
// a modal stays open, and nothing is shown to the user. Stripping is the only way to
// guarantee a write can always be caught.
function stripUndefined(obj) {
    const clean = {};
    Object.keys(obj).forEach(k => { if (obj[k] !== undefined) clean[k] = obj[k]; });
    return clean;
}

// ---------------------------------------------------------------------------
// File d'attente hors ligne
//
// LE PROBLEME. Le SDK Firebase garde les ecritures en attente EN MEMOIRE et les rejoue
// tout seul au retour du reseau — tant que l'onglet reste ouvert. Un iPad qui s'endort,
// un Safari qui recupere de la memoire, une page rechargee : la file disparait sans un
// mot, et le comptage de quelqu'un avec elle. Hors ligne, l'ecriture ne rejette meme
// pas : elle reste en attente indefiniment. Il n'y a donc rien a rattraper dans un
// .catch — c'est AVANT la tentative qu'il faut inscrire ce qu'on veut ecrire.
//
// CE QU'ON N'INSCRIT PAS, DELIBEREMENT :
//   - les ecritures de TOUT le tableau (saveAll) : rejouees des heures plus tard, elles
//     ecraseraient le travail des autres avec une photo perimee ;
//   - les creations transactionnelles : elles allouent un identifiant, un rejeu creerait
//     un second article.
// Ce qui compte pour la cuisine — un comptage, une reception, une ligne d'historique —
// est inscrit.
const FILE_KEY = 'pmPendingWrites';
const FILE_ABANDON_KEY = 'pmAbandonedWrites';
const FILE_MAX_AGE_MS = 24 * 60 * 60 * 1000;
let ticketSeq = 0;

function fileLire() {
    try { return JSON.parse(localStorage.getItem(FILE_KEY) || '[]'); } catch (e) { return []; }
}
function fileEcrire(file) {
    try { localStorage.setItem(FILE_KEY, JSON.stringify(file)); } catch (e) { /* quota */ }
}

// L'heure retenue est celle de MAINTENANT, c'est-a-dire du geste de l'utilisateur —
// pas celle du rejeu. Compter les tomates a 14h et retrouver "18h" dans l'historique
// parce que le wifi est revenu a 18h serait un mensonge sur le travail fait.
function fileInscrire(op) {
    if (!op) return null;
    const ticket = String(Date.now()) + '_' + (++ticketSeq);
    const file = fileLire();
    file.push({ ticket: ticket, queuedAt: new Date().toISOString(), op: op });
    fileEcrire(file);
    return ticket;
}

// Retire aussi bien apres un succes qu'apres un ECHEC : hors ligne une ecriture ne
// rejette pas, donc un rejet signale une vraie erreur (regle refusee, donnee invalide)
// que rejouer indefiniment ne reglerait pas. Seules restent les ecritures dont on n'a
// jamais eu de nouvelles — exactement celles qu'il faut reprendre.
function fileRetirer(ticket) {
    if (!ticket) return;
    fileEcrire(fileLire().filter(function (e) { return e.ticket !== ticket; }));
}

// EVERY write goes through here. A failed write that nobody notices is the worst
// outcome in this app: the screen shows the new value, the database keeps the old one,
// and the two only diverge further. Callers should still add their own .catch to roll
// back their local state — this is the net beneath them, not a replacement. It fires a
// `db-write-failed` event (ui-helpers turns it into a toast) and re-throws so existing
// .catch blocks keep working.
//
// `op` decrit quoi rejouer si l'ecriture n'aboutit jamais : {method, path, value}.
// Sans lui, guard ne voit qu'une promesse et une etiquette — de quoi signaler un echec,
// pas de quoi le reparer.
function guard(promise, label, op) {
    const ticket = fileInscrire(op);
    return promise.then(function (res) {
        fileRetirer(ticket);
        return res;
    }).catch(function (err) {
        fileRetirer(ticket);
        // Marque l'erreur comme deja signalee : une dizaine d'appels historiques n'ont
        // pas de .catch, et le re-throw ci-dessous en ferait autant de "unhandled
        // rejection" bruyantes. ui-helpers les laisse passer en silence — elles ont
        // deja produit un log ET un toast, les signaler deux fois n'apporte rien.
        try { err.__dbReported = true; } catch (e) { /* err peut etre gele */ }
        console.error('Firebase write failed [' + label + ']:', err);
        try {
            window.dispatchEvent(new CustomEvent('db-write-failed', {
                detail: { label: label, error: err }
            }));
        } catch (e) { /* jamais laisser la notification masquer l'erreur d'origine */ }
        throw err;
    });
}

// LA regle qui peut detruire du travail, isolee pour etre mise a l'epreuve seule.
//
// Une saisie faite hors ligne a 14h ne doit pas ecraser, a 18h, un comptage que
// quelqu'un d'autre a fait a 16h. L'arbitre est `lastCheckedTime`, l'heure du GESTE :
// on n'ecrit que si la base ne porte rien de plus recent que nous. Une egalite passe —
// c'est notre propre ecriture deja arrivee, la reecrire ne change rien.
//
// Si notre valeur n'a pas d'heure (ligne d'historique, reglage), il n'y a pas de
// conflit possible : le chemin est unique ou la donnee n'est pas un comptage.
function fileDoitEcraser(valeur, actuel) {
    if (!valeur || !valeur.lastCheckedTime) return true;
    if (!actuel || !actuel.lastCheckedTime) return true;
    return actuel.lastCheckedTime <= valeur.lastCheckedTime;
}

// Rejoue une ecriture restee en attente. Trois cas, trois raisons.
function fileRejouerUne(entree) {
    const op = entree.op;
    // syncedAt n'est ajoute QU'ICI : sa presence signifie, a elle seule, que cette
    // ecriture est partie en retard. Quand tout va bien le champ n'existe pas, et
    // l'historique n'a rien de special a afficher.
    //
    // `trace` est explicite et non deduit : une ecriture multi-chemins (updatePaths)
    // a pour valeur un dictionnaire de CHEMINS, pas un enregistrement. Y ajouter un
    // champ creerait une cle "syncedAt" a la racine de la base.
    const valeur = (op.trace && op.value && typeof op.value === 'object')
        ? Object.assign({}, op.value, { syncedAt: new Date().toISOString() })
        : op.value;

    if (op.method === 'remove') {
        return remove(ref(database, op.path));
    }
    if (op.method === 'update') {
        return update(ref(database, op.path || '/'), valeur);
    }
    // set. La transaction fait trancher le SERVEUR : deux tablettes qui reviennent en
    // meme temps ne peuvent pas se croiser.
    if (valeur && valeur.lastCheckedTime) {
        return runTransaction(ref(database, op.path), function (actuel) {
            return fileDoitEcraser(valeur, actuel) ? valeur : undefined;  // undefined = abandon
        });
    }
    return set(ref(database, op.path), valeur);
}

// Reprise au retour du reseau. Sequentiel et dans l'ordre de saisie : deux ecritures
// sur le meme article doivent s'appliquer dans l'ordre ou la personne les a faites.
let rejeuEnCours = false;
function fileRejouer() {
    if (rejeuEnCours) return Promise.resolve();
    const file = fileLire();
    if (!file.length) return Promise.resolve();
    rejeuEnCours = true;

    // Une saisie vieille de plus d'un jour ne decrit plus l'etat du stock : la rejouer
    // ferait plus de degats que de la perdre. Elle n'est pas jetee en silence pour
    // autant — elle est mise de cote et signalee.
    const limite = Date.now() - FILE_MAX_AGE_MS;
    const perimees = file.filter(function (e) { return Date.parse(e.queuedAt) < limite; });
    const vivantes = file.filter(function (e) { return Date.parse(e.queuedAt) >= limite; });
    if (perimees.length) {
        console.warn('Ecritures en attente trop anciennes, mises de cote :', perimees);
        try {
            const deja = JSON.parse(localStorage.getItem(FILE_ABANDON_KEY) || '[]');
            localStorage.setItem(FILE_ABANDON_KEY, JSON.stringify(deja.concat(perimees)));
        } catch (e) { /* quota : le console.warn ci-dessus reste la trace */ }
        fileEcrire(vivantes);
    }

    return vivantes.reduce(function (chaine, entree) {
        return chaine.then(function () {
            return fileRejouerUne(entree)
                .then(function () { fileRetirer(entree.ticket); })
                .catch(function (err) {
                    // Refusee pour une vraie raison : insister ne la fera pas passer.
                    console.error('Rejeu impossible, ecriture abandonnee :', entree, err);
                    fileRetirer(entree.ticket);
                });
        });
    }, Promise.resolve()).then(function () {
        rejeuEnCours = false;
        try {
            window.dispatchEvent(new CustomEvent('db-replayed', {
                detail: { count: vivantes.length, expired: perimees.length }
            }));
        } catch (e) { /* la notification ne doit pas casser la reprise */ }
    });
}

// `.info/connected` et pas navigator.onLine : ce dernier dit "je suis sur le wifi", pas
// "internet repond" — et le wifi de la cuisine peut tres bien etre debout sans connexion.
onValue(ref(database, '.info/connected'), function (snap) {
    if (snap.val() === true) fileRejouer();
});

// Helper to create standard CRUD functions for a Firebase path
function createCrudHelpers(basePath, idPrefix) {
    return {
        save: function(item) {
            const chemin = basePath + '/' + item.id;
            const propre = stripUndefined(item);
            return guard(set(ref(database, chemin), propre), basePath + '/save',
                         { method: 'set', path: chemin, value: propre, trace: true });
        },
        // Partial write: ONLY the listed fields are sent, everything else in the node is
        // left alone. set() replaces the whole node, so any screen using it silently
        // deletes the fields it does not know about — that is how a DB Editor save wiped
        // canPrep and pendingQty. Prefer this whenever a screen edits a subset of a
        // record. A field set to null is deleted (that is intentional); undefined is
        // stripped, since "I have no value for this" must never mean "erase it".
        saveFields: function(id, fields) {
            const chemin = basePath + '/' + id;
            const propres = stripUndefined(fields);
            return guard(update(ref(database, chemin), propres), basePath + '/saveFields',
                         { method: 'update', path: chemin, value: propres, trace: true });
        },
        // Pas de file d'attente ici, volontairement : cette ecriture porte TOUT le
        // tableau. Rejouee des heures plus tard elle reposerait une photo perimee sur
        // le travail que les autres ont fait entre-temps.
        saveAll: function(items) {
            const updates = {};
            items.forEach(item => {
                updates[basePath + '/' + item.id] = stripUndefined(item);
            });
            return guard(update(ref(database), updates), basePath + '/saveAll');
        },
        load: function() {
            return get(ref(database, basePath)).then((snapshot) => {
                if (snapshot.exists()) {
                    return Object.values(snapshot.val());
                }
                return [];
            });
        },
        loadWithKeys: function() {
            return get(ref(database, basePath)).then((snapshot) => {
                if (snapshot.exists()) {
                    return Object.entries(snapshot.val()).map(([key, value]) => ({...value, key}));
                }
                return [];
            });
        },
        // Creation d'un article NEUF, a l'abri des collisions d'identifiant.
        //
        // L'id etait calcule en max(ids)+1 A L'OUVERTURE du formulaire, et son unicite
        // verifiee contre le tableau LOCAL — deux photos du meme instant. Deux personnes
        // qui ajoutent un article en meme temps obtenaient donc le meme numero, et le
        // second ecrasait le premier : les deux ecrans affichaient "added successfully"
        // et un article disparaissait sans que personne ne le sache.
        //
        // La transaction tranche cote SERVEUR : si le noeud est deja pris, elle avorte
        // et on essaie le suivant. Aucun nouveau noeud, donc aucune regle a deployer.
        createUnique: function(item, startId) {
            var maxTries = 50;
            function attempt(id, tries) {
                if (tries >= maxTries) {
                    return Promise.reject(new Error('No free id after ' + maxTries + ' tries'));
                }
                var candidate = Object.assign({}, item, { id: id });
                return runTransaction(ref(database, basePath + '/' + id), function (current) {
                    if (current !== null) return;          // occupe -> abandon, on reessaie
                    return stripUndefined(candidate);
                }).then(function (res) {
                    return res.committed ? candidate : attempt(id + 1, tries + 1);
                });
            }
            return guard(attempt(startId, 0), basePath + '/createUnique');
        },
        delete: function(itemId) {
            const chemin = basePath + '/' + itemId;
            return guard(remove(ref(database, chemin)), basePath + '/delete',
                         { method: 'remove', path: chemin });
        },
        onChange: function(callback) {
            onValue(ref(database, basePath), (snapshot) => {
                const data = snapshot.val();
                callback(data ? Object.values(data) : []);
            });
        }
    };
}

// Helper to create log functions for a Firebase path
function createLogHelpers(basePath, prefix) {
    return {
        // La cle est calculee ICI, a la saisie, et non au moment de l'ecriture : rejouer
        // une ligne d'historique la reecrit donc au MEME chemin. Deux rejeux ne peuvent
        // pas creer deux entrees — l'idempotence vient de la, pas d'un verrou.
        save: function(activity) {
            const logId = prefix + '_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            const chemin = basePath + '/' + logId;
            const propre = stripUndefined(activity);
            return guard(set(ref(database, chemin), propre), basePath + '/log',
                         { method: 'set', path: chemin, value: propre, trace: true });
        },
        load: function() {
            return get(ref(database, basePath)).then((snapshot) => {
                if (snapshot.exists()) {
                    return Object.entries(snapshot.val()).map(([key, value]) => ({...value, key}));
                }
                return [];
            });
        },
        // Server-side ranged load: log keys are "<prefix>_<ms>_<rand>", so key order = chronological order
        loadSince: function(sinceMs) {
            const q = query(ref(database, basePath), orderByKey(), startAt(prefix + '_' + sinceMs));
            return get(q).then((snapshot) => {
                if (snapshot.exists()) {
                    return Object.entries(snapshot.val()).map(([key, value]) => ({...value, key}));
                }
                return [];
            });
        },
        // Batch-delete all logs whose key sorts before "<prefix>_<cutoffMs>" (single atomic update)
        deleteOlderThan: function(cutoffMs) {
            const q = query(ref(database, basePath), orderByKey(), endBefore(prefix + '_' + cutoffMs));
            return get(q).then((snapshot) => {
                if (!snapshot.exists()) return 0;
                const updates = {};
                Object.keys(snapshot.val()).forEach(key => { updates[basePath + '/' + key] = null; });
                return update(ref(database), updates).then(() => Object.keys(updates).length);
            });
        },
        delete: function(logId) {
            return remove(ref(database, basePath + '/' + logId));
        },
        onChange: function(callback) {
            onValue(ref(database, basePath), (snapshot) => {
                const data = snapshot.val();
                callback(data ? Object.values(data) : []);
            });
        }
    };
}

// Build helpers
const prepItems = createCrudHelpers('prepItems');
const staffMembers = createCrudHelpers('staffMembers');
const icItems = createCrudHelpers('icItems');
const activityLogs = createLogHelpers('activityLogs', 'log');
const icActivityLogs = createLogHelpers('icActivityLogs', 'iclog');
const tasks = createCrudHelpers('tasks');
const teamMessages = createCrudHelpers('teamMessages');
const deliveryIssues = createCrudHelpers('deliveryIssues');

// Global Firebase API — same interface as before, nothing breaks
window.firebaseDb = {
    // Low-level access (used by LastCheckTracker)
    ref: function(path) { return ref(database, path); },
    set: function(dbRef, data) { return set(dbRef, data); },
    get: function(dbRef) { return get(dbRef); },
    onValue: function(query, callback, errorCallback) { return onValue(query, callback, errorCallback); },

    // ONE atomic write spanning DIFFERENT nodes: Firebase applies it all or not at all.
    // Needed whenever two records only make sense together — crediting a delivery's
    // stock while losing its claim entry turns a supplier shortfall into a silent loss.
    // Keys are full paths from the root ('icItems/45', 'deliveryIssues/issue_x').
    updatePaths: function(updates) {
        const clean = {};
        Object.keys(updates).forEach(function (path) {
            const v = updates[path];
            clean[path] = (v && typeof v === 'object' && !Array.isArray(v)) ? stripUndefined(v) : v;
        });
        // trace absent : la valeur est un dictionnaire de CHEMINS, pas un enregistrement.
        return guard(update(ref(database), clean), 'updatePaths',
                     { method: 'update', path: '/', value: clean });
    },

    // Prep items
    saveItem: prepItems.save,
    createItemUnique: prepItems.createUnique,
    saveItemFields: prepItems.saveFields,
    saveAllItems: prepItems.saveAll,
    loadItems: prepItems.load,
    deleteItem: prepItems.delete,
    onItemsChange: prepItems.onChange,

    // Activity logs
    saveActivityLog: activityLogs.save,
    loadActivityLogs: activityLogs.load,
    loadRecentActivityLogs: activityLogs.loadSince,
    deleteOldActivityLogs: activityLogs.deleteOlderThan,
    deleteActivityLog: activityLogs.delete,

    // Staff
    saveStaffMember: staffMembers.save,
    saveAllStaffMembers: staffMembers.saveAll,
    loadStaffMembers: staffMembers.load,
    deleteStaffMember: staffMembers.delete,
    onStaffChange: staffMembers.onChange,

    // I&C items
    saveIcItem: icItems.save,
    createIcItemUnique: icItems.createUnique,
    saveIcItemFields: icItems.saveFields,
    saveAllIcItems: icItems.saveAll,
    loadIcItems: icItems.load,
    deleteIcItem: icItems.delete,
    onIcItemsChange: icItems.onChange,

    // I&C activity logs
    saveIcActivityLog: icActivityLogs.save,
    loadIcActivityLogs: icActivityLogs.load,
    deleteIcActivityLogs: icActivityLogs.delete,

    // Tasks
    saveTask: tasks.save,
    deleteTasks: tasks.delete,
    onTasksChange: tasks.onChange,

    // Team messages (broadcast to the kitchen dashboard)
    saveTeamMessage: teamMessages.save,
    deleteTeamMessage: teamMessages.delete,
    onTeamMessagesChange: teamMessages.onChange,

    // Delivery issues — ordered but never delivered. Feeds the supplier claim list.
    saveDeliveryIssue: deliveryIssues.save,
    loadDeliveryIssues: deliveryIssues.load
};

// Exposé pour les tests : la file et sa regle d'arbitrage doivent pouvoir etre mises a
// l'epreuve SANS ecrire dans la base de production, qui est celle du restaurant.
window.__pmQueue = {
    guard: guard,
    lire: fileLire,
    vider: function () { try { localStorage.removeItem(FILE_KEY); } catch (e) {} },
    doitEcraser: fileDoitEcraser,
    rejouer: fileRejouer
};

// Dispatch event so pages know Firebase is ready
window.dispatchEvent(new Event('firebase-ready'));
