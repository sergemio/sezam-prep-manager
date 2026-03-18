# Task Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a task management system (recurring, one-off, scheduled tasks) that integrates into the existing prep to-do list.

**Architecture:** New `tasks/` path in Firebase with client-side recurrence logic. Tasks merge into the existing to-do list with unified priority sorting. Task CRUD managed via a new "Tasks" tab in DB Editor.

**Tech Stack:** Vanilla JS, Firebase Realtime Database, CSS

**Spec:** `docs/superpowers/specs/2026-03-19-task-management-design.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `firebase-config.js` | Modify | Add tasks CRUD helpers + expose on `window.firebaseDb` |
| `script.js` | Modify | Load tasks, merge into to-do list, task completion modal |
| `styles.css` | Modify | Task card styles (blue border, TASK/OVERDUE tags) |
| `db-editor.html` | Modify | Add "Tasks" tab button + task section HTML |
| `db-editor.js` | Modify | Task CRUD (add/edit/delete, type-dependent form fields) |
| `history.js` | Modify | Handle `task-done` actionType in log display |
| `database.rules.json` | Modify | Add `tasks/` path validation (in Firebase CLI folder) |

No new files needed — all changes extend existing files.

---

### Task 1: Firebase — Add tasks CRUD helpers

**Files:**
- Modify: `firebase-config.js`

- [ ] **Step 1: Add tasks CRUD helper and expose on window.firebaseDb**

After the existing `icActivityLogs` declaration (~line 93), add:

```javascript
const tasks = createCrudHelpers('tasks');
```

Then in the `window.firebaseDb` object, add after the I&C activity logs section:

```javascript
    // Tasks
    saveTask: tasks.save,
    saveAllTasks: tasks.saveAll,
    loadTasks: tasks.load,
    deleteTasks: tasks.delete,
    onTasksChange: tasks.onChange,
```

- [ ] **Step 2: Test in browser console**

Open `https://sergemio.github.io/sezam-prep-manager/` (after push), open console:
```javascript
window.firebaseDb.loadTasks().then(t => console.log('Tasks:', t))
// Expected: Tasks: []
```

- [ ] **Step 3: Commit**

```bash
git add firebase-config.js
git commit -m "feat: add tasks CRUD helpers to firebase-config"
```

---

### Task 2: Firebase Security Rules — Add tasks path

**Files:**
- Modify: `C:\Users\serge\Desktop\restaurant-prep-simple\SEZAM PREP MANAGER\FIREBASE - Sezam restaurant manager\database.rules.json`

- [ ] **Step 1: Add tasks rules**

Add inside `"rules"`, alongside the existing paths:

```json
"tasks": {
  "$taskId": {
    ".read": true,
    ".write": true,
    ".validate": "newData.hasChildren(['title', 'type', 'active'])"
  }
}
```

- [ ] **Step 2: Deploy rules**

```bash
cd "C:\Users\serge\Desktop\restaurant-prep-simple\SEZAM PREP MANAGER\FIREBASE - Sezam restaurant manager"
firebase deploy --only database --project sezam-prep-manager
```

Expected: `✔ Database Rules for sezam-prep-manager have been released.`

- [ ] **Step 3: Test with curl**

```bash
# Should work (valid path)
curl -s "https://sezam-prep-manager-default-rtdb.europe-west1.firebasedatabase.app/tasks.json"
# Expected: null (empty)

# Should fail (unknown path)
curl -s "https://sezam-prep-manager-default-rtdb.europe-west1.firebasedatabase.app/badpath.json"
# Expected: {"error":"Permission denied"}
```

---

### Task 3: DB Editor — Tasks tab HTML + CSS

**Files:**
- Modify: `db-editor.html`
- Modify: `styles.css`

- [ ] **Step 1: Add "Tasks" tab button**

In `db-editor.html`, find the `.tab-navigation` div with the 3 existing buttons. Add a 4th button:

```html
<button class="tab-button" data-target="tasks-section">Tasks</button>
```

- [ ] **Step 2: Add tasks section HTML**

After the last `.tab-section` div (ic-items-section), add:

```html
<div id="tasks-section" class="tab-section">
    <div class="section-header">
        <h2>Tasks</h2>
        <button id="add-task-button" class="action-button">+ Add New Task</button>
    </div>
    <table class="inventory-table">
        <thead>
            <tr>
                <th>Title</th>
                <th>Type</th>
                <th>Frequency / Date</th>
                <th>Active</th>
                <th>Last Done</th>
                <th>Actions</th>
            </tr>
        </thead>
        <tbody id="tasks-table-body">
        </tbody>
    </table>
</div>
```

- [ ] **Step 3: Add task edit modal HTML**

After the existing modals (edit-form, staff-edit-form), add:

```html
<div id="task-edit-form" class="hidden">
    <div class="form-container">
        <div class="form-header">
            <h3 id="task-form-title">Add New Task</h3>
        </div>
        <div class="form-group">
            <label for="task-title-input">Title *</label>
            <input type="text" id="task-title-input" placeholder="e.g. Passer l'aspirateur">
        </div>
        <div class="form-group">
            <label for="task-description-input">Description</label>
            <textarea id="task-description-input" rows="3" placeholder="Detailed instructions..."></textarea>
        </div>
        <div class="form-group">
            <label for="task-type-input">Type *</label>
            <select id="task-type-input">
                <option value="recurring">Recurring</option>
                <option value="one-off">One-off</option>
                <option value="scheduled">Scheduled</option>
            </select>
        </div>
        <div class="form-group" id="task-frequency-group">
            <label for="task-frequency-input">Every ___ days</label>
            <input type="number" id="task-frequency-input" min="1" value="1">
        </div>
        <div class="form-group hidden" id="task-scheduled-group">
            <label for="task-date-input">Date</label>
            <input type="date" id="task-date-input">
            <label for="task-time-input" style="margin-top: 8px;">Time (optional)</label>
            <input type="time" id="task-time-input">
        </div>
        <div class="form-group">
            <label>
                <input type="checkbox" id="task-active-input" checked> Active
            </label>
        </div>
        <div class="button-group">
            <button id="save-task" class="action-button save-button">Save</button>
            <button id="cancel-task-edit" class="secondary-button cancel-button">Cancel</button>
            <button id="delete-task" class="delete-button hidden">Delete Task</button>
        </div>
    </div>
</div>
```

- [ ] **Step 4: Add `#task-edit-form` to the modal CSS selector**

In `db-editor.html`, find the inline `<style>` block (~line 72). Change:
```css
#edit-form, #staff-edit-form {
```
to:
```css
#edit-form, #staff-edit-form, #task-edit-form {
```

This ensures the task modal displays as a centered overlay like the other modals.

- [ ] **Step 5: Add textarea style for task description**

In `styles.css`, add after the existing form styles:

```css
#task-description-input {
    width: 100%;
    padding: 8px;
    border: 1px solid var(--border-light);
    border-radius: 4px;
    font-family: inherit;
    font-size: 14px;
    resize: vertical;
}
```

- [ ] **Step 6: Add `.todo-footer` CSS**

In `styles.css`, add after the `.todo-item-detail` styles:

```css
.todo-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 8px;
}
```

- [ ] **Step 7: Commit**

```bash
git add db-editor.html styles.css
git commit -m "feat: add Tasks tab HTML and modal to DB Editor"
```

---

### Task 4: DB Editor — Tasks CRUD logic

**Files:**
- Modify: `db-editor.js`

- [ ] **Step 1: Add task state variables and DOM references**

At the top of db-editor.js, after the existing variable declarations, add:

```javascript
// === TASKS MANAGEMENT ===
let allTasks = [];
let isAddingTask = false;
let currentEditingTaskId = null;

const tasksTableBody = document.getElementById('tasks-table-body');
const addTaskButton = document.getElementById('add-task-button');
const taskEditForm = document.getElementById('task-edit-form');
const taskFormTitle = document.getElementById('task-form-title');
const taskTitleInput = document.getElementById('task-title-input');
const taskDescriptionInput = document.getElementById('task-description-input');
const taskTypeInput = document.getElementById('task-type-input');
const taskFrequencyInput = document.getElementById('task-frequency-input');
const taskFrequencyGroup = document.getElementById('task-frequency-group');
const taskScheduledGroup = document.getElementById('task-scheduled-group');
const taskDateInput = document.getElementById('task-date-input');
const taskTimeInput = document.getElementById('task-time-input');
const taskActiveInput = document.getElementById('task-active-input');
const saveTaskButton = document.getElementById('save-task');
const cancelTaskEditButton = document.getElementById('cancel-task-edit');
const deleteTaskButton = document.getElementById('delete-task');
```

- [ ] **Step 2: Add type dropdown toggle logic**

```javascript
function updateTaskTypeFields() {
    const type = taskTypeInput.value;
    taskFrequencyGroup.classList.toggle('hidden', type !== 'recurring');
    taskScheduledGroup.classList.toggle('hidden', type !== 'scheduled');
}
```

- [ ] **Step 3: Add render function**

```javascript
function renderTasksTable() {
    tasksTableBody.innerHTML = '';

    if (allTasks.length === 0) {
        tasksTableBody.innerHTML = '<tr><td colspan="6" class="empty-state-cell">No tasks defined yet</td></tr>';
        return;
    }

    allTasks.forEach(task => {
        const row = document.createElement('tr');

        let freqDisplay = '';
        if (task.type === 'recurring') {
            freqDisplay = `Every ${task.frequencyDays} day${task.frequencyDays > 1 ? 's' : ''}`;
        } else if (task.type === 'scheduled') {
            freqDisplay = task.scheduledDate + (task.scheduledTime ? ' ' + task.scheduledTime : '');
        } else {
            freqDisplay = '—';
        }

        let lastDone = 'Never';
        if (task.lastCompletedAt) {
            const d = new Date(task.lastCompletedAt);
            lastDone = d.toLocaleDateString('fr-FR') + ' by ' + (task.lastCompletedBy || '?');
        }

        row.innerHTML = `
            <td>${task.title}</td>
            <td>${task.type}</td>
            <td>${freqDisplay}</td>
            <td><span class="${task.active ? 'status-active' : 'status-inactive'}">${task.active ? 'Active' : 'Inactive'}</span></td>
            <td>${lastDone}</td>
            <td>
                <div class="actions-cell">
                    <button class="edit-button" data-task-id="${task.id}">Edit</button>
                </div>
            </td>
        `;

        tasksTableBody.appendChild(row);

        row.querySelector('.edit-button').addEventListener('click', function() {
            showEditTaskForm(this.getAttribute('data-task-id'));
        });
    });
}
```

- [ ] **Step 4: Add show/cancel/save/delete functions**

```javascript
function showAddTaskForm() {
    isAddingTask = true;
    currentEditingTaskId = null;
    taskFormTitle.textContent = 'Add New Task';

    taskTitleInput.value = '';
    taskDescriptionInput.value = '';
    taskTypeInput.value = 'recurring';
    taskFrequencyInput.value = 1;
    taskDateInput.value = '';
    taskTimeInput.value = '';
    taskActiveInput.checked = true;

    updateTaskTypeFields();
    deleteTaskButton.classList.add('hidden');
    document.body.style.overflow = 'hidden';
    taskEditForm.classList.remove('hidden');
}

function showEditTaskForm(taskId) {
    const task = allTasks.find(t => t.id === taskId);
    if (!task) return;

    isAddingTask = false;
    currentEditingTaskId = taskId;
    taskFormTitle.textContent = 'Edit Task: ' + task.title;

    taskTitleInput.value = task.title;
    taskDescriptionInput.value = task.description || '';
    taskTypeInput.value = task.type;
    taskFrequencyInput.value = task.frequencyDays || 1;
    taskDateInput.value = task.scheduledDate || '';
    taskTimeInput.value = task.scheduledTime || '';
    taskActiveInput.checked = task.active;

    updateTaskTypeFields();
    deleteTaskButton.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    taskEditForm.classList.remove('hidden');
}

function cancelTaskEdit() {
    taskEditForm.classList.add('hidden');
    document.body.style.overflow = 'auto';
    isAddingTask = false;
    currentEditingTaskId = null;
}

function saveTask() {
    const title = taskTitleInput.value.trim();
    if (!title) {
        showErrorMessage('Title is required');
        return;
    }

    const type = taskTypeInput.value;
    const task = {
        id: currentEditingTaskId || 'task_' + Date.now() + '_' + Math.floor(Math.random() * 10000),
        title: title,
        description: taskDescriptionInput.value.trim(),
        type: type,
        active: taskActiveInput.checked,
        createdAt: isAddingTask ? new Date().toISOString() : (allTasks.find(t => t.id === currentEditingTaskId)?.createdAt || new Date().toISOString()),
        createdBy: isAddingTask ? 'admin' : (allTasks.find(t => t.id === currentEditingTaskId)?.createdBy || 'admin')
    };

    if (type === 'recurring') {
        task.frequencyDays = parseInt(taskFrequencyInput.value) || 1;
    }
    if (type === 'scheduled') {
        task.scheduledDate = taskDateInput.value;
        task.scheduledTime = taskTimeInput.value || null;
    }

    // Preserve completion state on edit
    if (!isAddingTask) {
        const existing = allTasks.find(t => t.id === currentEditingTaskId);
        if (existing) {
            task.lastCompletedAt = existing.lastCompletedAt || null;
            task.lastCompletedBy = existing.lastCompletedBy || null;
        }
    }

    window.firebaseDb.saveTask(task).then(() => {
        showSuccessMessage(isAddingTask ? 'Task created' : 'Task updated');
        cancelTaskEdit();
    });
}

function deleteTask() {
    if (!currentEditingTaskId) return;
    if (!confirm('Delete this task?')) return;

    window.firebaseDb.deleteTasks(currentEditingTaskId).then(() => {
        showSuccessMessage('Task deleted');
        cancelTaskEdit();
    });
}
```

- [ ] **Step 5: Wire up event listeners and Firebase listener**

Add in the initialization section (after existing listeners):

```javascript
// Tasks listeners
if (addTaskButton) addTaskButton.addEventListener('click', showAddTaskForm);
if (saveTaskButton) saveTaskButton.addEventListener('click', saveTask);
if (cancelTaskEditButton) cancelTaskEditButton.addEventListener('click', cancelTaskEdit);
if (deleteTaskButton) deleteTaskButton.addEventListener('click', deleteTask);
if (taskTypeInput) taskTypeInput.addEventListener('change', updateTaskTypeFields);

// Click outside modal to close
if (taskEditForm) {
    taskEditForm.addEventListener('click', function(e) {
        if (e.target === taskEditForm) cancelTaskEdit();
    });
}

// Firebase real-time listener
window.firebaseDb.onTasksChange(function(tasks) {
    allTasks = tasks || [];
    renderTasksTable();
});
```

- [ ] **Step 6: Test in browser**

Open DB Editor → click "Tasks" tab → should show empty state. Click "+ Add New Task" → fill form → save. Should appear in table. Edit → change title → save. Delete → confirm → gone.

- [ ] **Step 7: Commit**

```bash
git add db-editor.js
git commit -m "feat: add tasks CRUD logic to DB Editor"
```

---

### Task 5: To-Do List — Task visibility logic + merge with preps

**Files:**
- Modify: `script.js`

- [ ] **Step 1: Add tasks state variable**

Near the top of script.js, after existing state variables (~line 42):

```javascript
let tasks = [];
```

- [ ] **Step 2: Add task visibility helper functions**

Add before `updateTodoList()`:

```javascript
function getTaskMissedCount(task) {
    if (!task.lastCompletedAt || task.type !== 'recurring') return 0;
    const daysSince = (Date.now() - new Date(task.lastCompletedAt).getTime()) / (1000 * 60 * 60 * 24);
    const missed = Math.floor(daysSince / task.frequencyDays) - 1;
    return Math.max(0, missed);
}

function isTaskDue(task) {
    if (!task.active) return false;

    if (task.type === 'one-off') {
        return !task.lastCompletedAt;
    }

    if (task.type === 'scheduled') {
        if (!task.scheduledDate) return false;
        const now = new Date();
        const scheduled = new Date(task.scheduledDate + (task.scheduledTime ? 'T' + task.scheduledTime : 'T00:00'));
        return now >= scheduled && !task.lastCompletedAt;
    }

    if (task.type === 'recurring') {
        if (!task.lastCompletedAt) return true;
        const daysSince = (Date.now() - new Date(task.lastCompletedAt).getTime()) / (1000 * 60 * 60 * 24);
        return daysSince >= task.frequencyDays;
    }

    return false;
}

function getTaskDaysOverdue(task) {
    if (task.type === 'recurring') {
        if (!task.lastCompletedAt) return 0;
        const daysSince = (Date.now() - new Date(task.lastCompletedAt).getTime()) / (1000 * 60 * 60 * 24);
        const overdue = daysSince - task.frequencyDays;
        return Math.max(0, Math.floor(overdue));
    }
    if (task.type === 'scheduled' && task.scheduledDate) {
        const daysSince = (Date.now() - new Date(task.scheduledDate).getTime()) / (1000 * 60 * 60 * 24);
        return Math.max(0, Math.floor(daysSince));
    }
    return 0;
}
```

- [ ] **Step 3: Add Firebase listener for tasks**

In `initApp()` (or after the existing `onItemsChange` listener), add:

```javascript
window.firebaseDb.onTasksChange(function(loadedTasks) {
    tasks = loadedTasks || [];
    updateTodoList();
});
```

- [ ] **Step 4: Modify `updateTodoList()` to merge tasks and preps**

Replace the existing `updateTodoList()` function. The key changes:
1. Build a unified array of `todoItems` — each item has `_type` ('prep' or 'task') and `_sortPriority` (1-5)
2. Sort by `_sortPriority`, then by sub-priority within each level
3. Render prep items as before, task items with new card layout

```javascript
function updateTodoList() {
    const sortedItems = sortItemsByDisplayOrder(prepItems);

    // --- Prep items (existing logic, unchanged) ---
    const itemsMarkedAsCantPrep = sortedItems.filter(item => item.canPrep === false);
    const cantPrepCount = itemsMarkedAsCantPrep.length;

    const todoTitleElement = document.querySelector('.todo-panel .todo-title');
    if (todoTitleElement) {
        let cantPrepBadge = todoTitleElement.querySelector('.cant-prep-badge');
        if (!cantPrepBadge) {
            cantPrepBadge = document.createElement('span');
            cantPrepBadge.className = 'cant-prep-badge';
            todoTitleElement.appendChild(cantPrepBadge);
        }
        if (cantPrepCount > 0) {
            cantPrepBadge.textContent = cantPrepCount;
            cantPrepBadge.style.display = 'inline-block';
        } else {
            cantPrepBadge.style.display = 'none';
        }
    }

    // Build unified todo array
    const todoItems = [];

    // Add prep items (existing filter: < 50% of target or canPrep === false)
    sortedItems
        .filter(item => (item.currentLevel < item.targetLevel * 0.5) || (item.canPrep === false))
        .forEach(item => {
            const percentage = item.currentLevel / item.targetLevel;
            let priority;
            if (item.canPrep === false) {
                priority = 5;
            } else if (item.currentLevel === 0 || percentage <= 0.25) {
                priority = 2; // EMPTY or CRITICAL
            } else {
                priority = 4; // LOW or GETTING LOW
            }
            todoItems.push({ _type: 'prep', _sortPriority: priority, _subSort: percentage, data: item });
        });

    // Add due tasks
    tasks.filter(isTaskDue).forEach(task => {
        const missed = getTaskMissedCount(task);
        const overdue = getTaskDaysOverdue(task);
        const priority = (missed > 0 || overdue > 0) ? 1 : 3;
        todoItems.push({ _type: 'task', _sortPriority: priority, _subSort: -missed, data: task, missed, overdue });
    });

    // Sort: by priority (asc), then sub-sort (asc = lower % or more missed first)
    todoItems.sort((a, b) => {
        if (a._sortPriority !== b._sortPriority) return a._sortPriority - b._sortPriority;
        return a._subSort - b._subSort;
    });

    // Render
    todoListContainer.innerHTML = '';

    if (todoItems.length === 0) {
        todoListContainer.innerHTML = '<div class="todo-empty">All items are at good levels!</div>';
        return;
    }

    todoItems.forEach(entry => {
        if (entry._type === 'prep') {
            renderPrepTodoItem(entry.data);
        } else {
            renderTaskTodoItem(entry.data, entry.missed, entry.overdue);
        }
    });
}
```

- [ ] **Step 5: Extract existing prep rendering to `renderPrepTodoItem()`**

Move the existing per-item rendering code from the old `updateTodoList` into its own function:

```javascript
function renderPrepTodoItem(item) {
    const percentage = item.currentLevel / item.targetLevel;

    let badgeClass, badgeText;
    if (item.canPrep === false) {
        badgeClass = 'cant-prep';
        badgeText = "Can't Prep";
    } else if (item.currentLevel === 0) {
        badgeClass = 'empty';
        badgeText = 'EMPTY';
    } else if (percentage <= 0.25) {
        badgeClass = 'critical';
        badgeText = 'CRITICAL';
    } else if (percentage <= 0.4) {
        badgeClass = 'low';
        badgeText = 'LOW';
    } else {
        badgeClass = 'getting-low';
        badgeText = 'GETTING LOW';
    }

    let timeDisplay = '';
    if (item.lastCheckedTime) {
        try {
            const date = new Date(item.lastCheckedTime);
            if (!isNaN(date.getTime())) {
                const hours = String(date.getHours()).padStart(2, '0');
                const minutes = String(date.getMinutes()).padStart(2, '0');
                timeDisplay = `${hours}:${minutes}`;
            }
        } catch (e) {}
    }

    const todoItem = document.createElement('div');
    todoItem.className = 'todo-item';

    if (item.canPrep === false) {
        todoItem.style.borderLeftColor = '#ef4444';
        todoItem.style.opacity = '0.7';
    } else if (percentage === 0) {
        todoItem.style.borderLeftColor = '#ef4444';
    } else if (percentage <= 0.25) {
        todoItem.style.borderLeftColor = '#f97316';
    } else if (percentage <= 0.4) {
        todoItem.style.borderLeftColor = '#ca8a04';
    } else {
        todoItem.style.borderLeftColor = '#64748b';
    }

    todoItem.innerHTML = `
        <div class="todo-item-name">${item.name}</div>
        <div class="todo-item-detail">Current: ${item.currentLevel}</div>
        <div class="todo-item-detail"><span style="font-weight: 700;">Need:</span> ${item.targetLevel - item.currentLevel} more</div>
        ${item.canPrep === false ? `
            <div class="cant-prep-info" style="margin-top: 8px; background-color: #fff1f1; padding: 8px; border-radius: 4px; font-size: 13px;">
                <div style="font-weight: 600; color: #ef4444;">Can't Prep: ${item.cantPrepReason}</div>
                ${item.cantPrepReasonText ? `<div style="margin-top: 4px;">Reason: ${item.cantPrepReasonText}</div>` : ''}
                <div style="display: flex; justify-content: space-between; margin-top: 4px; font-size: 12px; color: #666;">
                    <span>By: ${item.cantPrepBy || 'Unknown'}</span>
                    <span>${formatDate(item.cantPrepTime)}</span>
                </div>
            </div>
        ` : ''}
        <div class="todo-footer">
            <span class="todo-tag ${badgeClass}">${badgeText}</span>
            <span class="todo-item-detail todo-timestamp">${timeDisplay}</span>
        </div>
    `;

    todoItem.addEventListener('click', () => {
        showQuickUpdateModal(item);
    });

    todoListContainer.appendChild(todoItem);
}
```

- [ ] **Step 6: Add `renderTaskTodoItem()` function**

```javascript
function renderTaskTodoItem(task, missed, overdue) {
    const isOverdue = missed > 0 || overdue > 0;

    let freqText = '';
    if (task.type === 'recurring') {
        freqText = `Every ${task.frequencyDays} day${task.frequencyDays > 1 ? 's' : ''}`;
    } else if (task.type === 'scheduled') {
        freqText = task.scheduledDate + (task.scheduledTime ? ' ' + task.scheduledTime : '');
    } else {
        freqText = 'One-off';
    }

    const todoItem = document.createElement('div');
    todoItem.className = 'todo-item todo-item-task';
    todoItem.style.borderLeftColor = isOverdue ? '#ef4444' : '#3b82f6';

    todoItem.innerHTML = `
        <div class="todo-item-name">${task.title}</div>
        <div class="todo-item-detail">${freqText}${isOverdue ? ' \u2022 En retard (' + overdue + ' jour' + (overdue > 1 ? 's' : '') + ')' : ''}</div>
        <div class="todo-footer">
            <span class="todo-tag ${isOverdue ? 'overdue' : 'task'}">${isOverdue ? 'OVERDUE' : 'TASK'}</span>
        </div>
    `;

    todoItem.addEventListener('click', () => {
        showTaskModal(task);
    });

    todoListContainer.appendChild(todoItem);
}
```

- [ ] **Step 7: Commit**

```bash
git add script.js
git commit -m "feat: merge tasks into to-do list with priority sorting"
```

---

### Task 6: Task completion modal

**Files:**
- Modify: `script.js`

- [ ] **Step 1: Add `showTaskModal()` function**

```javascript
function showTaskModal(task) {
    const modalBackdrop = document.createElement('div');
    modalBackdrop.className = 'modal-backdrop';
    modalBackdrop.style.position = 'fixed';
    modalBackdrop.style.top = '0';
    modalBackdrop.style.left = '0';
    modalBackdrop.style.width = '100%';
    modalBackdrop.style.height = '100%';
    modalBackdrop.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
    modalBackdrop.style.display = 'flex';
    modalBackdrop.style.justifyContent = 'center';
    modalBackdrop.style.alignItems = 'center';
    modalBackdrop.style.zIndex = '9999';

    const modalContent = document.createElement('div');
    modalContent.style.position = 'relative';
    modalContent.style.backgroundColor = 'white';
    modalContent.style.padding = '24px';
    modalContent.style.borderRadius = '8px';
    modalContent.style.maxWidth = '90%';
    modalContent.style.width = '420px';
    modalContent.style.maxHeight = '90vh';
    modalContent.style.overflowY = 'auto';
    modalContent.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.1)';

    let freqText = '';
    if (task.type === 'recurring') {
        freqText = `Every ${task.frequencyDays} day${task.frequencyDays > 1 ? 's' : ''}`;
    } else if (task.type === 'scheduled') {
        freqText = task.scheduledDate + (task.scheduledTime ? ' at ' + task.scheduledTime : '');
    } else {
        freqText = 'One-off task';
    }

    let lastDoneText = 'Never done';
    if (task.lastCompletedAt) {
        const d = new Date(task.lastCompletedAt);
        const hours = String(d.getHours()).padStart(2, '0');
        const minutes = String(d.getMinutes()).padStart(2, '0');
        lastDoneText = `By ${task.lastCompletedBy || '?'}, ${d.toLocaleDateString('fr-FR')} at ${hours}:${minutes}`;
    }

    modalContent.innerHTML = `
        <h3 style="margin: 0 0 12px 0; color: #333;">${task.title}</h3>
        ${task.description ? `<p style="margin: 0 0 16px 0; color: #555; font-size: 14px; line-height: 1.5;">${task.description}</p>` : ''}
        <div style="margin-bottom: 16px; padding: 12px; background: #f7f9f5; border-radius: 6px; font-size: 14px;">
            <div style="margin-bottom: 6px;"><strong>Type:</strong> ${freqText}</div>
            <div><strong>Last done:</strong> ${lastDoneText}</div>
        </div>
        <div style="display: flex; gap: 10px;">
            <button id="task-done-btn" style="flex: 1; padding: 14px; background-color: #80b244; color: white; border: none; border-radius: 8px; font-size: 16px; font-weight: 600; cursor: pointer;">Marquer comme fait</button>
            <button id="task-close-btn" style="padding: 14px 20px; background-color: #e5e7eb; color: #333; border: none; border-radius: 8px; font-size: 16px; cursor: pointer;">Fermer</button>
        </div>
    `;

    modalBackdrop.appendChild(modalContent);
    document.body.appendChild(modalBackdrop);

    // Close on backdrop click
    modalBackdrop.addEventListener('click', function(e) {
        if (e.target === modalBackdrop) {
            document.body.removeChild(modalBackdrop);
        }
    });

    // Close button
    modalContent.querySelector('#task-close-btn').addEventListener('click', function() {
        document.body.removeChild(modalBackdrop);
    });

    // Done button
    modalContent.querySelector('#task-done-btn').addEventListener('click', function() {
        completeTask(task);
        document.body.removeChild(modalBackdrop);
    });
}
```

- [ ] **Step 2: Add `completeTask()` function**

```javascript
function completeTask(task) {
    const now = new Date().toISOString();
    const staffName = currentStaff || 'Unknown';

    // Update task in Firebase
    task.lastCompletedAt = now;
    task.lastCompletedBy = staffName;
    window.firebaseDb.saveTask(task);

    // Log to activity history
    window.firebaseDb.saveActivityLog({
        timestamp: now,
        user: staffName,
        itemName: task.title,
        actionType: 'task-done'
    });
}
```

- [ ] **Step 3: Commit**

```bash
git add script.js
git commit -m "feat: add task completion modal and activity logging"
```

---

### Task 7: History — Display task-done logs

**Files:**
- Modify: `history.js`

- [ ] **Step 1: Add task-done case to the actionType switch**

In `history.js`, find the `switch(log.actionType)` block. Add before the `default` case:

```javascript
case 'task-done':
    actionText = 'completed task';
    changeText = '';
    break;
```

- [ ] **Step 2: Commit**

```bash
git add history.js
git commit -m "feat: display task-done logs in activity history"
```

---

### Task 8: CSS — Task card styles

**Files:**
- Modify: `styles.css`

- [ ] **Step 1: Add task-specific tag styles**

Add after the existing `.todo-tag` styles:

```css
.todo-tag.task {
    background-color: #3b82f6;
    color: white;
    text-transform: uppercase;
    font-weight: 800;
}

.todo-tag.overdue {
    background-color: #ef4444;
    color: white;
    text-transform: uppercase;
    font-weight: 800;
}
```

- [ ] **Step 2: Commit**

```bash
git add styles.css
git commit -m "feat: add CSS styles for task cards (TASK/OVERDUE tags)"
```

---

### Task 9: End-to-end test with Playwright

**Files:** None (testing only)

- [ ] **Step 1: Push to GitHub Pages**

```bash
cd C:/Users/serge/Claude/sezam-prep-manager
git push origin main
```

Wait ~30 seconds for GitHub Pages to deploy.

- [ ] **Step 2: Test DB Editor — Create a task**

Using Playwright:
1. Navigate to `https://sergemio.github.io/sezam-prep-manager/db-editor.html`
2. Click "Tasks" tab
3. Click "+ Add New Task"
4. Fill: title "Test aspirateur", type "recurring", frequency 2
5. Save
6. Verify it appears in the table

- [ ] **Step 3: Test main page — Task appears in to-do list**

1. Navigate to `https://sergemio.github.io/sezam-prep-manager/`
2. Select any staff member
3. Look at the to-do list on the right
4. Verify "Test aspirateur" appears with blue border and "TASK" tag

- [ ] **Step 4: Test task completion**

1. Click on "Test aspirateur" in the to-do list
2. Verify modal shows title, "Every 2 days", "Never done"
3. Click "Marquer comme fait"
4. Verify task disappears from to-do list

- [ ] **Step 5: Test history**

1. Click "History" in the nav
2. Verify log entry shows "[staff name] completed task Test aspirateur"

- [ ] **Step 6: Clean up test data**

In DB Editor → Tasks tab → Edit "Test aspirateur" → Delete

- [ ] **Step 7: Final commit if any fixes were needed**

```bash
git add -A
git commit -m "fix: adjustments from e2e testing"
git push origin main
```
