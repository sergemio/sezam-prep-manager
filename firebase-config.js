// Firebase Configuration & Database Wrapper
// Single source of truth — loaded by all pages

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, set, onValue, get, update, remove } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

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

// Helper to create standard CRUD functions for a Firebase path
function createCrudHelpers(basePath, idPrefix) {
    return {
        save: function(item) {
            return set(ref(database, basePath + '/' + item.id), item);
        },
        saveAll: function(items) {
            const updates = {};
            items.forEach(item => {
                updates[basePath + '/' + item.id] = item;
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
            return set(ref(database, basePath + '/' + logId), activity);
        },
        load: function() {
            return get(ref(database, basePath)).then((snapshot) => {
                if (snapshot.exists()) {
                    return Object.entries(snapshot.val()).map(([key, value]) => ({...value, key}));
                }
                return [];
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
    saveAllItems: prepItems.saveAll,
    loadItems: prepItems.load,
    deleteItem: prepItems.delete,
    onItemsChange: prepItems.onChange,

    // Activity logs
    saveActivityLog: activityLogs.save,
    loadActivityLogs: activityLogs.load,
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
    saveAllIcItems: icItems.saveAll,
    loadIcItems: icItems.load,
    deleteIcItem: icItems.delete,
    onIcItemsChange: icItems.onChange,

    // I&C activity logs
    saveIcActivityLog: icActivityLogs.save,
    loadIcActivityLogs: icActivityLogs.load,
    deleteIcActivityLogs: icActivityLogs.delete,
    onIcActivityLogsChange: icActivityLogs.onChange
};

// Dispatch event so pages know Firebase is ready
window.dispatchEvent(new Event('firebase-ready'));
