// Tests for the API endpoints using supertest (no real server needed).
// We only check status codes and response body.
// test.failing = a bug that is still there (see BUG_REPORT.md).

const request = require('supertest');
const app = require('../src/app');
const service = require('../src/services/taskService');

beforeEach(() => service._reset());

const createTask = async (body = { title: 'Sample' }) => (await request(app).post('/tasks').send(body)).body;

describe('POST /tasks', () => {
  test('creates a task (201) with defaults', async () => {
    const res = await request(app).post('/tasks').send({ title: 'Write tests', priority: 'high' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ title: 'Write tests', priority: 'high', status: 'todo', assignee: null });
    expect(res.body.id).toBeDefined();
  });

  test.each([
    ['missing title', {}],
    ['empty title', { title: '' }],
    ['whitespace title', { title: '   ' }],
    ['non-string title', { title: 123 }],
    ['invalid status', { title: 'a', status: 'blocked' }],
    ['invalid priority', { title: 'a', priority: 'urgent' }],
    ['invalid dueDate', { title: 'a', dueDate: 'not-a-date' }],
  ])('rejects %s with 400', async (_name, body) => {
    const res = await request(app).post('/tasks').send(body);
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  // Bug #5 (NOT fixed): bad JSON gives 500, should be 400.
  test.failing('malformed JSON returns 400, not 500', async () => {
    const res = await request(app).post('/tasks').set('Content-Type', 'application/json').send('{bad json');
    expect(res.status).toBe(400);
  });
});

describe('GET /tasks', () => {
  test('returns an empty array when there are no tasks', async () => {
    const res = await request(app).get('/tasks');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  test('returns all tasks', async () => {
    await createTask({ title: 'a' });
    await createTask({ title: 'b' });
    const res = await request(app).get('/tasks');
    expect(res.body).toHaveLength(2);
  });

  test('filters by exact status', async () => {
    await createTask({ title: 'a', status: 'todo' });
    await createTask({ title: 'b', status: 'done' });
    const res = await request(app).get('/tasks?status=done');
    expect(res.body.map((t) => t.title)).toEqual(['b']);
  });

  describe('pagination', () => {
    beforeEach(async () => {
      for (let i = 1; i <= 12; i++) await createTask({ title: `t${i}` });
    });

    test('?page=1&limit=5 returns the first five tasks', async () => {
      const res = await request(app).get('/tasks?page=1&limit=5');
      expect(res.body.map((t) => t.title)).toEqual(['t1', 't2', 't3', 't4', 't5']);
    });

    test('?page=2&limit=5 returns the next five', async () => {
      const res = await request(app).get('/tasks?page=2&limit=5');
      expect(res.body.map((t) => t.title)).toEqual(['t6', 't7', 't8', 't9', 't10']);
    });

    test('defaults to page 1 / limit 10 when values are missing or non-numeric', async () => {
      const res = await request(app).get('/tasks?page=abc');
      expect(res.body).toHaveLength(10);
      expect(res.body[0].title).toBe('t1');
    });

    test('a page past the end returns []', async () => {
      const res = await request(app).get('/tasks?page=50&limit=5');
      expect(res.body).toEqual([]);
    });

    // Bug #6 (NOT fixed): negative limit is accepted and returns nothing.
    test.failing('negative limit is rejected with 400', async () => {
      const res = await request(app).get('/tasks?page=1&limit=-2');
      expect(res.status).toBe(400);
    });

    // Bug #7 (NOT fixed): if status is sent, page and limit get ignored.
    test.failing('status filter and pagination can be combined', async () => {
      const res = await request(app).get('/tasks?status=todo&page=1&limit=2');
      expect(res.body).toHaveLength(2);
    });
  });

  // Bug #2 (fixed), checked through the API
  test('?status=do does not match "todo"/"done"', async () => {
    await createTask({ title: 'a', status: 'todo' });
    const res = await request(app).get('/tasks?status=do');
    expect(res.body).toEqual([]);
  });
});

describe('PUT /tasks/:id', () => {
  test('updates a task', async () => {
    const t = await createTask();
    const res = await request(app).put(`/tasks/${t.id}`).send({ title: 'Renamed', status: 'in_progress' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: t.id, title: 'Renamed', status: 'in_progress' });
  });

  test('404 for an unknown id', async () => {
    const res = await request(app).put('/tasks/nope').send({ title: 'x' });
    expect(res.status).toBe(404);
  });

  test.each([
    ['empty title', { title: '' }],
    ['invalid status', { status: 'nope' }],
    ['invalid priority', { priority: 'nope' }],
    ['invalid dueDate', { dueDate: 'nope' }],
  ])('400 for %s', async (_n, body) => {
    const t = await createTask();
    const res = await request(app).put(`/tasks/${t.id}`).send(body);
    expect(res.status).toBe(400);
  });

  // Bug #4 (NOT fixed), checked through the API
  test.failing('cannot overwrite id / createdAt', async () => {
    const t = await createTask();
    const res = await request(app).put(`/tasks/${t.id}`).send({ id: 'hacked', createdAt: 'x' });
    expect(res.body.id).toBe(t.id);
    expect(res.body.createdAt).toBe(t.createdAt);
  });
});

describe('DELETE /tasks/:id', () => {
  test('deletes a task (204, empty body)', async () => {
    const t = await createTask();
    const res = await request(app).delete(`/tasks/${t.id}`);
    expect(res.status).toBe(204);
    expect(res.text).toBe('');
    expect((await request(app).get('/tasks')).body).toHaveLength(0);
  });

  test('404 for an unknown id', async () => {
    expect((await request(app).delete('/tasks/nope')).status).toBe(404);
  });

  test('404 when deleting the same task twice', async () => {
    const t = await createTask();
    await request(app).delete(`/tasks/${t.id}`);
    expect((await request(app).delete(`/tasks/${t.id}`)).status).toBe(404);
  });
});

describe('PATCH /tasks/:id/complete', () => {
  test('marks the task done and sets completedAt', async () => {
    const t = await createTask();
    const res = await request(app).patch(`/tasks/${t.id}/complete`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('done');
    expect(res.body.completedAt).not.toBeNull();
  });

  test('404 for an unknown id', async () => {
    expect((await request(app).patch('/tasks/nope/complete')).status).toBe(404);
  });

  // Bug #3 (fixed), checked through the API
  test('does not reset priority', async () => {
    const t = await createTask({ title: 'a', priority: 'high' });
    const res = await request(app).patch(`/tasks/${t.id}/complete`);
    expect(res.body.priority).toBe('high');
  });
});

describe('GET /tasks/stats', () => {
  test('returns counts by status plus overdue', async () => {
    await createTask({ title: 'a' });
    await createTask({ title: 'b', status: 'in_progress', dueDate: '2000-01-01T00:00:00.000Z' });
    await createTask({ title: 'c', status: 'done' });
    const res = await request(app).get('/tasks/stats');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ todo: 1, in_progress: 1, done: 1, overdue: 1 });
  });

  test('is routed as /stats, not treated as a task id', async () => {
    const res = await request(app).get('/tasks/stats');
    expect(res.body).toHaveProperty('overdue');
  });
});

describe('PATCH /tasks/:id/assign', () => {
  test('assigns a task and returns it (200)', async () => {
    const t = await createTask();
    const res = await request(app).patch(`/tasks/${t.id}/assign`).send({ assignee: 'Alice' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: t.id, assignee: 'Alice' });
  });

  test('the assignment persists (visible in GET /tasks)', async () => {
    const t = await createTask();
    await request(app).patch(`/tasks/${t.id}/assign`).send({ assignee: 'Alice' });
    const list = await request(app).get('/tasks');
    expect(list.body[0].assignee).toBe('Alice');
  });

  test('trims surrounding whitespace from the name', async () => {
    const t = await createTask();
    const res = await request(app).patch(`/tasks/${t.id}/assign`).send({ assignee: '  Alice  ' });
    expect(res.body.assignee).toBe('Alice');
  });

  test('404 when the task does not exist', async () => {
    const res = await request(app).patch('/tasks/nope/assign').send({ assignee: 'Alice' });
    expect(res.status).toBe(404);
  });

  test.each([
    ['missing assignee', {}],
    ['empty string', { assignee: '' }],
    ['whitespace only', { assignee: '   ' }],
    ['a number', { assignee: 42 }],
    ['null', { assignee: null }],
    ['an array', { assignee: ['Alice'] }],
    ['over 100 characters', { assignee: 'x'.repeat(101) }],
  ])('400 for %s', async (_n, body) => {
    const t = await createTask();
    const res = await request(app).patch(`/tasks/${t.id}/assign`).send(body);
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
    // and the task must be left untouched
    expect((await request(app).get('/tasks')).body[0].assignee).toBeNull();
  });

  test('re-assigning an already-assigned task overwrites the assignee', async () => {
    const t = await createTask();
    await request(app).patch(`/tasks/${t.id}/assign`).send({ assignee: 'Alice' });
    const res = await request(app).patch(`/tasks/${t.id}/assign`).send({ assignee: 'Bob' });
    expect(res.status).toBe(200);
    expect(res.body.assignee).toBe('Bob');
  });

  test('assigning the same person twice is idempotent', async () => {
    const t = await createTask();
    await request(app).patch(`/tasks/${t.id}/assign`).send({ assignee: 'Alice' });
    const res = await request(app).patch(`/tasks/${t.id}/assign`).send({ assignee: 'Alice' });
    expect(res.status).toBe(200);
    expect(res.body.assignee).toBe('Alice');
  });

  test('validation runs before the 404 lookup (bad body + unknown id -> 400)', async () => {
    const res = await request(app).patch('/tasks/nope/assign').send({});
    expect(res.status).toBe(400);
  });
});