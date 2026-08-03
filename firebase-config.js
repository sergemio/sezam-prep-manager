// Firebase Configuration & Database Wrapper
// Single source of truth — loaded by all pages
// Formes des données (prepItem / icItem / task / log) documentées dans ARCHITECTURE.md

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, set, onValue, get, update, remove, query, orderByKey, startAt, endBefore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

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

// Helper to create standard CRUD functions for a Firebase path
function createCrudHelpers(basePath, idPrefix) {
    return {
        save: function(item) {
            return set(ref(database, basePath + '/' + item.id), stripUndefined(item));
        },
        // Partial write: ONLY the listed fields are sent, everything else in the node is
        // left alone. set() replaces the whole node, so any screen using it silently
        // deletes the fields it does not know about — that is how a DB Editor save wiped
        // canPrep and pendingQty. Prefer this whenever a screen edits a subset of a
        // record. A field set to null is deleted (that is intentional); undefined is
        // stripped, since "I have no value for this" must never mean "erase it".
        saveFields: function(id, fields) {
            return update(ref(database, basePath + '/' + id), stripUndefined(fields));
        },
        saveAll: function(items) {
            const updates = {};
            items.forEach(item => {
                updates[basePath + '/' + item.id] = stripUndefined(item);
            });
            return update(ref(database), updates);
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
        delete: function(itemId) {
            return remove(ref(database, basePath + '/' + itemId));
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
            return set(ref(database, basePath + '/' + logId), stripUndefined(activity));
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
    remove: function(dbRef) { return remove(dbRef); },

    // Prep items
    saveItem: prepItems.save,
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
    onActivityLogsChange: activityLogs.onChange,

    // Staff
    saveStaffMember: staffMembers.save,
    saveAllStaffMembers: staffMembers.saveAll,
    loadStaffMembers: staffMembers.load,
    deleteStaffMember: staffMembers.delete,
    onStaffChange: staffMembers.onChange,

    // I&C items
    saveIcItem: icItems.save,
    saveIcItemFields: icItems.saveFields,
    saveAllIcItems: icItems.saveAll,
    loadIcItems: icItems.load,
    deleteIcItem: icItems.delete,
    onIcItemsChange: icItems.onChange,

    // I&C activity logs
    saveIcActivityLog: icActivityLogs.save,
    loadIcActivityLogs: icActivityLogs.load,
    deleteIcActivityLogs: icActivityLogs.delete,
    onIcActivityLogsChange: icActivityLogs.onChange,

    // Tasks
    saveTask: tasks.save,
    saveAllTasks: tasks.saveAll,
    loadTasks: tasks.load,
    deleteTasks: tasks.delete,
    onTasksChange: tasks.onChange,

    // Team messages (broadcast to the kitchen dashboard)
    saveTeamMessage: teamMessages.save,
    loadTeamMessages: teamMessages.load,
    deleteTeamMessage: teamMessages.delete,
    onTeamMessagesChange: teamMessages.onChange,

    // Delivery issues — ordered but never delivered. Feeds the supplier claim list.
    saveDeliveryIssue: deliveryIssues.save,
    loadDeliveryIssues: deliveryIssues.load,
    deleteDeliveryIssue: deliveryIssues.delete,
    onDeliveryIssuesChange: deliveryIssues.onChange
};

// Dispatch event so pages know Firebase is ready
window.dispatchEvent(new Event('firebase-ready'));
