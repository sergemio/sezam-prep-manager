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
const tasks = createCrudHelpers('tasks');

// Returns today's date as "YYYY-MM-DD", but before 4h AM returns yesterday
function getDateKey() {
    const now = new Date();
    if (now.getHours() < 4) {
        now.setDate(now.getDate() - 1);
    }
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}

// Helper to create checklist CRUD + daily status functions for a named checklist
function createChecklistHelpers(checklistName) {
    const itemsPath = `checklists/${checklistName}/items`;
    const statusBasePath = `checklists/${checklistName}/status`;
    const statusListeners = {};

    return {
        // Items CRUD
        saveItem: function(item) {
            return set(ref(database, itemsPath + '/' + item.id), item);
        },
        saveAllItems: function(items) {
            const obj = {};
            items.forEach(item => { obj[item.id] = item; });
            return set(ref(database, itemsPath), obj);
        },
        loadItems: function() {
            return get(ref(database, itemsPath)).then((snapshot) => {
                if (snapshot.exists()) {
                    return Object.values(snapshot.val()).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
                }
                return [];
            });
        },
        deleteItem: function(itemId) {
            return remove(ref(database, itemsPath + '/' + itemId));
        },
        onItemsChange: function(callback) {
            onValue(ref(database, itemsPath), (snapshot) => {
                const data = snapshot.val();
                const arr = data ? Object.values(data).sort((a, b) => (a.order ?? 0) - (b.order ?? 0)) : [];
                callback(arr);
            });
        },

        // Daily Status
        getStatus: function(dateKey) {
            return get(ref(database, statusBasePath + '/' + dateKey)).then((snapshot) => {
                return snapshot.exists() ? snapshot.val() : {};
            });
        },
        setItemStatus: function(dateKey, itemId, statusObj) {
            return set(ref(database, statusBasePath + '/' + dateKey + '/' + itemId), statusObj);
        },
        clearItemStatus: function(dateKey, itemId) {
            return remove(ref(database, statusBasePath + '/' + dateKey + '/' + itemId));
        },
        onStatusChange: function(dateKey, callback) {
            const unsubscribe = onValue(ref(database, statusBasePath + '/' + dateKey), (snapshot) => {
                callback(snapshot.exists() ? snapshot.val() : {});
            });
            statusListeners[dateKey] = unsubscribe;
        },
        offStatusChange: function(dateKey) {
            if (statusListeners[dateKey]) {
                statusListeners[dateKey]();
                delete statusListeners[dateKey];
            }
        }
    };
}

// Build checklist helpers
const opening = createChecklistHelpers('opening');
const closing = createChecklistHelpers('closing');

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
    onIcActivityLogsChange: icActivityLogs.onChange,

    // Tasks
    saveTask: tasks.save,
    saveAllTasks: tasks.saveAll,
    loadTasks: tasks.load,
    deleteTasks: tasks.delete,
    onTasksChange: tasks.onChange,

    // Checklist helpers
    getDateKey: getDateKey,
    opening: opening,
    closing: closing
};

// Dispatch event so pages know Firebase is ready
window.dispatchEvent(new Event('firebase-ready'));
