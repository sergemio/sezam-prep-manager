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

// EVERY write goes through here. A failed write that nobody notices is the worst
// outcome in this app: the screen shows the new value, the database keeps the old one,
// and the two only diverge further. Callers should still add their own .catch to roll
// back their local state — this is the net beneath them, not a replacement. It fires a
// `db-write-failed` event (ui-helpers turns it into a toast) and re-throws so existing
// .catch blocks keep working.
function guard(promise, label) {
    return promise.catch(function (err) {
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

// Helper to create standard CRUD functions for a Firebase path
function createCrudHelpers(basePath, idPrefix) {
    return {
        save: function(item) {
            return guard(set(ref(database, basePath + '/' + item.id), stripUndefined(item)),
                         basePath + '/save');
        },
        // Partial write: ONLY the listed fields are sent, everything else in the node is
        // left alone. set() replaces the whole node, so any screen using it silently
        // deletes the fields it does not know about — that is how a DB Editor save wiped
        // canPrep and pendingQty. Prefer this whenever a screen edits a subset of a
        // record. A field set to null is deleted (that is intentional); undefined is
        // stripped, since "I have no value for this" must never mean "erase it".
        saveFields: function(id, fields) {
            return guard(update(ref(database, basePath + '/' + id), stripUndefined(fields)),
                         basePath + '/saveFields');
        },
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
            return guard(remove(ref(database, basePath + '/' + itemId)), basePath + '/delete');
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
        save: function(activity) {
            const logId = prefix + '_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            return guard(set(ref(database, basePath + '/' + logId), stripUndefined(activity)),
                         basePath + '/log');
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
        return guard(update(ref(database), clean), 'updatePaths');
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

// Dispatch event so pages know Firebase is ready
window.dispatchEvent(new Event('firebase-ready'));
