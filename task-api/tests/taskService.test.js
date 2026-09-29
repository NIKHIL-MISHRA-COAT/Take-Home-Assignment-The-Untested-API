// Tests for taskService (we call the functions directly, no HTTP).
// We clear the tasks before every test so tests don't affect each other.
// test.failing = a bug that is still there. The test says what SHOULD happen.
// It is expected to fail now. Once the bug is fixed, change it to a normal test().

const service = require('../src/services/taskService');

beforeEach(() => service._reset());

describe('create / getAll / findById', () => {
  test('create applies defaults and generates id + createdAt', () => {
    const t = service.create({ title: 'Write tests' });
    expect(t).toMatchObject({
      title: 'Write tests',
      description: '',
      status: 'todo',
      priority: 'medium',
      dueDate: null,
      assignee: null,
      completedAt: null,
    });
    expect(typeof t.id).toBe('string');
    expect(new Date(t.createdAt).toString()).not.toBe('Invalid Date');
  });

  test('create respects provided fields', () => {
    const t = service.create({ title: 'A', status: 'in_progress', priority: 'high', dueDate: '2030-01-01T00:00:00.000Z' });
    expect(t).toMatchObject({ status: 'in_progress', priority: 'high', dueDate: '2030-01-01T00:00:00.000Z' });
  });

  test('getAll returns every task, and a copy of the array', () => {
    service.create({ title: 'A' });
    service.create({ title: 'B' });
    const all = service.getAll();
    expect(all).toHaveLength(2);
    all.pop(); // mutating the returned array must not affect the store
    expect(service.getAll()).toHaveLength(2);
  });

  test('findById returns the task, or undefined when unknown', () => {
    const t = service.create({ title: 'A' });
    expect(service.findById(t.id)).toEqual(t);
    expect(service.findById('nope')).toBeUndefined();
  });
});

describe('getByStatus', () => {
  beforeEach(() => {
    service.create({ title: 'a', status: 'todo' });
    service.create({ title: 'b', status: 'in_progress' });
    service.create({ title: 'c', status: 'done' });
  });

  test('returns only tasks with the exact status', () => {
    expect(service.getByStatus('todo').map((t) => t.title)).toEqual(['a']);
    expect(service.getByStatus('done').map((t) => t.title)).toEqual(['c']);
  });

  test('returns [] when nothing matches', () => {
    expect(service.getByStatus('archived')).toEqual([]);
  });

  // Bug #2 (fixed): partial words used to match.
  test('does NOT match on a substring ("do" must not match todo/done)', () => {
    expect(service.getByStatus('do')).toEqual([]);
  });
});

describe('getPaginated', () => {
  beforeEach(() => {
    for (let i = 1; i <= 12; i++) service.create({ title: `t${i}` });
  });

  // Bug #1 (fixed): these failed before the offset fix.
  test('page 1 returns the first `limit` tasks', () => {
    expect(service.getPaginated(1, 5).map((t) => t.title)).toEqual(['t1', 't2', 't3', 't4', 't5']);
  });

  test('page 2 returns the next slice', () => {
    expect(service.getPaginated(2, 5).map((t) => t.title)).toEqual(['t6', 't7', 't8', 't9', 't10']);
  });

  test('last page may be partial', () => {
    expect(service.getPaginated(3, 5).map((t) => t.title)).toEqual(['t11', 't12']);
  });

  test('a page past the end returns []', () => {
    expect(service.getPaginated(99, 5)).toEqual([]);
  });
});

describe('getStats', () => {
  test('counts by status and starts at zero', () => {
    expect(service.getStats()).toEqual({ todo: 0, in_progress: 0, done: 0, overdue: 0 });
    service.create({ title: 'a' });
    service.create({ title: 'b', status: 'in_progress' });
    service.create({ title: 'c', status: 'done' });
    expect(service.getStats()).toMatchObject({ todo: 1, in_progress: 1, done: 1 });
  });

  test('overdue counts past-due tasks that are not done', () => {
    const past = '2000-01-01T00:00:00.000Z';
    const future = '2999-01-01T00:00:00.000Z';
    service.create({ title: 'late todo', dueDate: past });
    service.create({ title: 'late in progress', status: 'in_progress', dueDate: past });
    service.create({ title: 'late but done', status: 'done', dueDate: past });
    service.create({ title: 'not due yet', dueDate: future });
    service.create({ title: 'no due date' });
    expect(service.getStats().overdue).toBe(2);
  });
});

describe('update', () => {
  test('merges fields and persists them', () => {
    const t = service.create({ title: 'old' });
    const updated = service.update(t.id, { title: 'new', priority: 'high' });
    expect(updated).toMatchObject({ id: t.id, title: 'new', priority: 'high' });
    expect(service.findById(t.id).title).toBe('new');
  });

  test('returns null for an unknown id', () => {
    expect(service.update('nope', { title: 'x' })).toBeNull();
  });

  // Bug #4 (NOT fixed): update lets you overwrite id and createdAt.
  test.failing('cannot overwrite server-owned fields (id, createdAt)', () => {
    const t = service.create({ title: 'a' });
    const updated = service.update(t.id, { id: 'hacked', createdAt: '1999-01-01T00:00:00.000Z' });
    expect(updated.id).toBe(t.id);
    expect(updated.createdAt).toBe(t.createdAt);
  });
});

describe('remove', () => {
  test('removes an existing task and returns true', () => {
    const t = service.create({ title: 'a' });
    expect(service.remove(t.id)).toBe(true);
    expect(service.getAll()).toHaveLength(0);
  });

  test('returns false for an unknown id', () => {
    expect(service.remove('nope')).toBe(false);
  });
});

describe('completeTask', () => {
  test('sets status to done and stamps completedAt', () => {
    const t = service.create({ title: 'a' });
    const done = service.completeTask(t.id);
    expect(done.status).toBe('done');
    expect(new Date(done.completedAt).toString()).not.toBe('Invalid Date');
    expect(service.findById(t.id).status).toBe('done');
  });

  test('returns null for an unknown id', () => {
    expect(service.completeTask('nope')).toBeNull();
  });

  // Bug #3 (fixed): priority used to get reset to medium.
  test('keeps the original priority', () => {
    const t = service.create({ title: 'a', priority: 'high' });
    expect(service.completeTask(t.id).priority).toBe('high');
  });
});

describe('assignTask', () => {
  test('stores the assignee and returns the updated task', () => {
    const t = service.create({ title: 'a' });
    const assigned = service.assignTask(t.id, 'Alice');
    expect(assigned.assignee).toBe('Alice');
    expect(service.findById(t.id).assignee).toBe('Alice');
  });

  test('re-assigning overwrites the previous assignee', () => {
    const t = service.create({ title: 'a' });
    service.assignTask(t.id, 'Alice');
    expect(service.assignTask(t.id, 'Bob').assignee).toBe('Bob');
  });

  test('does not change other fields', () => {
    const t = service.create({ title: 'a', priority: 'high' });
    const assigned = service.assignTask(t.id, 'Alice');
    expect(assigned).toEqual({ ...t, assignee: 'Alice' });
  });

  test('returns null for an unknown id', () => {
    expect(service.assignTask('nope', 'Alice')).toBeNull();
  });
});