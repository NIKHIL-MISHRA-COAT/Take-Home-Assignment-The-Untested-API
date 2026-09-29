const VALID_STATUSES = ['todo', 'in_progress', 'done'];
const VALID_PRIORITIES = ['low', 'medium', 'high'];

const validateCreateTask = (body) => {
  if (!body.title || typeof body.title !== 'string' || body.title.trim() === '') {
    return 'title is required and must be a non-empty string';
  }
  if (body.status && !VALID_STATUSES.includes(body.status)) {
    return `status must be one of: ${VALID_STATUSES.join(', ')}`;
  }
  if (body.priority && !VALID_PRIORITIES.includes(body.priority)) {
    return `priority must be one of: ${VALID_PRIORITIES.join(', ')}`;
  }
  if (body.dueDate && isNaN(Date.parse(body.dueDate))) {
    return 'dueDate must be a valid ISO date string';
  }
  return null;
};

const validateUpdateTask = (body) => {
  if (body.title !== undefined && (typeof body.title !== 'string' || body.title.trim() === '')) {
    return 'title must be a non-empty string';
  }
  if (body.status && !VALID_STATUSES.includes(body.status)) {
    return `status must be one of: ${VALID_STATUSES.join(', ')}`;
  }
  if (body.priority && !VALID_PRIORITIES.includes(body.priority)) {
    return `priority must be one of: ${VALID_PRIORITIES.join(', ')}`;
  }
  if (body.dueDate && isNaN(Date.parse(body.dueDate))) {
    return 'dueDate must be a valid ISO date string';
  }
  return null;
};

const MAX_ASSIGNEE_LENGTH = 100;

// Checks the body for PATCH /tasks/:id/assign
// - assignee must be there and must be a string
// - empty or only-spaces name is not allowed
// - max 100 characters so nobody sends a giant name
const validateAssignTask = (body) => {
  if (!body || typeof body.assignee !== 'string') {
    return 'assignee is required and must be a string';
  }
  const name = body.assignee.trim();
  if (name === '') {
    return 'assignee must be a non-empty string';
  }
  if (name.length > MAX_ASSIGNEE_LENGTH) {
    return `assignee must be at most ${MAX_ASSIGNEE_LENGTH} characters`;
  }
  return null;
};

module.exports = { validateCreateTask, validateUpdateTask, validateAssignTask };