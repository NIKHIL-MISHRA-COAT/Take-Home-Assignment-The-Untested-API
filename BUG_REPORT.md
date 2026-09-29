# Bug Report - Task API

I found these by writing tests and also trying the API by hand (curl / supertest).
Bugs #1, #2 and #3 are fixed. Bugs #4 to #7 are still open, and each one has a
`test.failing` test so we don't forget them.

| # | Where | Status |
|---|-------|--------|
| 1 | `getPaginated` in taskService.js | Fixed |
| 2 | `getByStatus` in taskService.js | Fixed |
| 3 | `completeTask` in taskService.js | Fixed |
| 4 | `update` in taskService.js (PUT) | Open |
| 5 | error handler in app.js | Open |
| 6 | `GET /tasks` in routes/tasks.js | Open |
| 7 | `GET /tasks` in routes/tasks.js | Open |

## 1. Page 1 skips the first items (FIXED)
- **Should happen:** `?page=1&limit=5` gives tasks 1 to 5.
- **What happens:** it gave tasks 6 to 10.
- **How I found it:** I made 12 tasks and checked page 1 in a test.
- **Why:** the code did `page * limit`. Pages start from 1, so page 1 jumped ahead by a full page.
- **Fix:** use `(page - 1) * limit`.

## 2. Status filter matches part of a word (FIXED)
- **Should happen:** `?status=do` gives nothing.
- **What happens:** it gave both `todo` and `done` tasks.
- **How I found it:** unit test with `getByStatus('do')`.
- **Why:** the code used `includes()`, which checks for part of the text.
- **Fix:** use `===` so it must match exactly.

## 3. Completing a task changes its priority (FIXED)
- **Should happen:** complete only sets status = done and completedAt.
- **What happens:** a `high` priority task became `medium`.
- **How I found it:** created a high task, completed it, looked at the result.
- **Why:** `completeTask` had `priority: 'medium'` written inside it.
- **Fix:** removed that line.

## 4. PUT can overwrite id and createdAt (open)
- **Should happen:** only title, description, status, priority, dueDate can be changed.
- **What happens:** sending `{"id":"hacked","createdAt":"x"}` changes them.
- **How I found it:** tried it by hand, then wrote a test.
- **Why:** `update` merges whatever the client sends (`{...task, ...fields}`).
- **Fix idea:** copy only the allowed fields before merging.

## 5. Broken JSON gives 500 instead of 400 (open)
- **Should happen:** 400 (client mistake).
- **What happens:** 500 "Internal server error".
- **How I found it:** sent `{bad json` to POST /tasks.
- **Why:** the error handler in app.js always returns 500 and ignores `err.status`.
- **Fix idea:** `res.status(err.status || 500)`.

## 6. Bad page / limit values are accepted (open)
- **Should happen:** `limit=-2` should be a 400 (or use the default).
- **What happens:** 200 with an empty list.
- **Why:** `parseInt('-2') || 10` keeps -2 because it is not falsy.
- **Fix idea:** check page >= 1 and limit between 1 and some max.

## 7. Status filter cancels pagination (open)
- **Should happen:** `?status=todo&page=1&limit=2` gives max 2 tasks.
- **What happens:** gives all todo tasks, page and limit are ignored.
- **Why:** the route returns early inside `if (status)`.
- **Fix idea:** filter first, then paginate the filtered list.

---

## New feature: PATCH /tasks/:id/assign
- Body: `{ "assignee": "Alice" }`. Returns the updated task (200).
- Task not found -> 404.
- Bad assignee -> 400: missing, not a string, empty, only spaces, or longer than 100 characters.
- The name is trimmed, so `"  Alice  "` is saved as `"Alice"`.
- **Already assigned?** I allow it and just replace the name. Reason: PATCH can be repeated safely and there is no unassign endpoint, so a 409 would leave the user stuck. Easy to change if the team wants a 409.
- Order is 400 first, then 404 (same as PUT).
- New tasks now start with `assignee: null`.

## Submission note
- **Test next:** PUT with `status: done` (completedAt is not set), completing an already-done task (it overwrites completedAt), overdue with different timezones, very large `limit`.
- **Surprised me:** the README says statuses are `pending/completed` but the code uses `todo/in_progress/done`. Also PUT is called "full update" but acts like a partial update. Also the priority reset was hidden inside `completeTask`.
- **Questions before production:** should assignee be a real user id instead of free text? Who is allowed to re-assign? Do we need a database and login? What is the max page size?