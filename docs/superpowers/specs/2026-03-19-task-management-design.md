# Task Management Feature — Design Spec

## Overview

Add a task management system to the Sezam Prep Manager that lets staff define and track non-prep tasks (cleaning, restocking, etc.) alongside existing prep items in the same to-do list.

## Requirements

- Tasks appear in the same to-do list as preps (right panel on main page)
- Visually distinct from preps (blue border, "TASK" tag)
- Three scheduling types: recurring, one-off, scheduled
- Any staff member can create tasks (not admin-only)
- Tasks are "first come, first served" — no assignment
- Click a task card → modal with details + "Mark as done" button
- Closing the modal without clicking "done" = no change
- Completed tasks log to the existing activity history
- Overdue recurring tasks increase in priority

## Architecture: Approach A — Client-Side Firebase

All logic runs client-side. No Cloud Functions or server-side cron. The app calculates task visibility on load by comparing current date against `lastCompletedAt + frequencyDays`. Sufficient because the app runs continuously at the restaurant.

## Data Structure

### Firebase path: `tasks/[taskId]`

```
id: number                       // Auto-incremented
title: string                    // "Passer l'aspirateur"
description: string              // Detailed instructions (shown in modal)
type: "recurring" | "one-off" | "scheduled"

// Recurring only
frequencyDays: number            // e.g., 2 = every 2 days

// Scheduled only
scheduledDate: "YYYY-MM-DD"      // Specific date
scheduledTime: "HH:MM"           // Optional specific time

// State
active: boolean                  // true = visible in app (toggle to disable without deleting)
lastCompletedAt: ISO timestamp   // When it was last done
lastCompletedBy: string          // Who did it
missedCount: number              // Consecutive missed occurrences (drives priority)

// Order & meta
displayOrder: number
createdAt: ISO timestamp
createdBy: string
```

### Activity logs (existing `activityLogs/` path)

```javascript
{
  id: "log_[timestamp]_[random]",
  timestamp: ISO string,
  user: "Tatiana",
  itemName: "Passer l'aspirateur",
  actionType: "task-done"
  // No oldValue/newValue/unit — binary done/not done
}
```

## Visibility Logic (client-side)

Calculated on page load and on Firebase data change:

- **Recurring**: visible if `lastCompletedAt` is null OR `now - lastCompletedAt >= frequencyDays` days. If already overdue and not done, `missedCount` increments → priority rises.
- **One-off**: visible until completed. Disappears permanently after.
- **Scheduled**: visible on or after `scheduledDate`. If not done, stays visible past the date.

## To-Do List Integration

### Sort priority (top to bottom):

1. Overdue tasks (missedCount > 0) — red/orange border
2. Urgent preps (EMPTY, CRITICAL)
3. Due tasks (today) — blue border, tag "TASK"
4. Low preps (LOW, GETTING LOW)
5. Can't Prep items (bottom)

### Task card (in to-do list):

```
┌─ blue border (or red if overdue) ────────────────┐
│  Passer l'aspirateur                              │
│  Tous les 2 jours                                 │
│  [TASK]                     [14:32]               │
└───────────────────────────────────────────────────┘
```

If overdue:
```
┌─ red border ─────────────────────────────────────┐
│  Passer l'aspirateur                              │
│  Tous les 2 jours • En retard (2 jours)          │
│  [OVERDUE]                                        │
└───────────────────────────────────────────────────┘
```

### Task modal (on click):

- Title (large)
- Full description/instructions
- Recurrence info ("Tous les 2 jours" / "Une seule fois" / "Planifié le 25/03")
- Last completed: "Par Tatiana, hier à 14h32" (or "Jamais fait")
- **"Marquer comme fait"** button → logs to history, removes from list
- Click outside or X → closes, no change

## DB Editor — Tasks Tab

New tab "Tasks" alongside existing "Prep Items", "Staff", "I&C Items".

### Task list view:
- Table with columns: Title, Type, Frequency/Date, Active, Actions (Edit/Delete)
- "+ Add New Task" button

### Create/Edit modal:
- **Title** (required)
- **Description** (optional)
- **Type** dropdown: Recurring / One-off / Scheduled
  - Recurring → "Every ___ days" input
  - Scheduled → date picker + optional time picker
  - One-off → no extra fields
- **Active** toggle

### Delete:
- Confirmation dialog (same pattern as prep items)

## Files Impacted

| File | Change |
|------|--------|
| `firebase-config.js` | Add CRUD methods for `tasks/` (saveTask, loadTasks, deleteTask, onTasksChange) |
| `script.js` | Load tasks, inject into to-do list, task completion modal |
| `styles.css` | Task card styles (blue border, TASK/OVERDUE tags) |
| `index.html` | Minimal or none — content is dynamic |
| `db-editor.html` | New "Tasks" tab |
| `db-editor.js` | Task CRUD (add/edit/delete form with type/recurrence) |
| `history.js` | Display `task-done` logs with appropriate label |
| `database.rules.json` | New `tasks/` path with field validation |

## Firebase Security Rules

Add to `database.rules.json`:
```json
"tasks": {
  "$taskId": {
    ".read": true,
    ".write": true,
    ".validate": "newData.hasChildren(['id', 'title', 'type', 'active'])"
  }
}
```

Redeploy: `firebase deploy --only database --project sezam-prep-manager`
