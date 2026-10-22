'use strict';
const $ = (selector) => document.querySelector(selector);
const state = { requests: [], csrf: '', status: 'all', priority: 'all', search: '', sort: 'newest', busy: false, deleteId: null, loaded: false };
const statusLabels = { open: 'Open', in_progress: 'In progress', completed: 'Completed' };
const priorityLabels = { low: 'Low', medium: 'Medium', high: 'High' };
let toastTimer;
let returnFocus;
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
function announce(message) {
  clearTimeout(toastTimer);
  $('#toast-message').textContent = message;
  $('#toast').hidden = false;
  toastTimer = setTimeout(() => { $('#toast').hidden = true; }, 5000);
}
async function api(path, options = {}) {
  const response = await fetch(path, { ...options, headers: { 'X-CSRF-Token': state.csrf, ...options.headers } });
  let data;
  try { data = await response.json(); } catch { throw new Error('The server returned an unexpected response. Try again.'); }
  if (!response.ok) {
    const error = new Error(data.message || 'The request could not be saved.');
    error.fields = data.errors;
    throw error;
  }
  return data;
}
async function loadRequests() {
  const data = await api('/api/requests');
  state.requests = data.requests;
  state.csrf = data.csrf;
  state.loaded = true;
  $('#load-error').hidden = true;
  $('#connection').classList.add('connected');
  $('#connection span').textContent = 'Database connected';
  render();
}
async function initialLoad() {
  try { await loadRequests(); }
  catch (error) {
    $('#load-error').hidden = false;
    $('#load-error-message').textContent = error.message;
    $('#connection').classList.remove('connected');
    $('#connection span').textContent = 'Connection unavailable';
    $('#request-summary').textContent = 'Connection unavailable';
    $('#results-count').textContent = 'Requests unavailable';
    $('#empty-state').hidden = true;
  }
}
function dateLabel(date) {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(`${date}T12:00:00`));
}
function requestTitle(description) {
  const text = description.split(/[\n.!?]/)[0].trim() || description;
  return text.charAt(0).toUpperCase() + text.slice(1);
}
function render() {
  const requests = state.requests;
  const open = requests.filter((r) => r.status === 'open').length;
  const progress = requests.filter((r) => r.status === 'in_progress').length;
  const completed = requests.filter((r) => r.status === 'completed').length;
  $('#request-summary').textContent = `${open} open · ${progress} in progress · ${completed} completed`;
  $('#tab-total').textContent = requests.length;
  const query = state.search.toLocaleLowerCase().trim();
  const visible = requests.filter((r) =>
    (state.status === 'all' || r.status === state.status) &&
    (state.priority === 'all' || r.priority === state.priority) &&
    (!query || [r.id, `MR-${r.id.padStart(3, '0')}`, r.description, r.room, r.requested_by, r.requested_date].some((v) => v.toLocaleLowerCase().includes(query)))
  ).sort((a, b) => state.sort === 'oldest' ? Number(a.id) - Number(b.id) : state.sort === 'priority' ?
    ({ high: 0, medium: 1, low: 2 }[a.priority] - { high: 0, medium: 1, low: 2 }[b.priority] || Number(b.id) - Number(a.id)) : Number(b.id) - Number(a.id));
  const tbody = $('#requests-body');
  tbody.replaceChildren();
  for (const request of visible) {
    const tr = el('tr');
    const issue = el('td', 'issue-cell');
    const meta = el('div', 'request-meta');
    meta.append(el('span', 'request-id', `MR-${request.id.padStart(3, '0')}`), el('time', '', dateLabel(request.requested_date)));
    meta.querySelector('time').dateTime = request.requested_date;
    const detail = el('p', 'issue-description', request.description);
    issue.append(meta, detail);
    const location = el('td', 'location-cell', request.room);
    const person = el('td', '', request.requested_by);
    const priority = el('td', `priority-${request.priority}`, priorityLabels[request.priority]);
    const status = el('td', `status-value status-${request.status}`, statusLabels[request.status]);
    const actions = el('td', 'row-actions');
    const actionWrap = el('div');
    for (const [type, label] of [['edit', 'Edit'], ['delete', 'Delete']]) {
      const button = el('button', `row-action ${type}`, label);
      button.type = 'button';
      button.setAttribute('aria-label', `${label} request MR-${request.id.padStart(3, '0')}`);
      button.addEventListener('click', () => type === 'edit' ? openForm(request) : openDelete(request));
      actionWrap.append(button);
    }
    actions.append(actionWrap);
    tr.append(issue, location, person, priority, status, actions);
    tbody.append(tr);
  }
  const filtered = query || state.status !== 'all' || state.priority !== 'all';
  $('#empty-state').hidden = visible.length > 0;
  $('#empty-title').textContent = filtered ? 'No matching requests.' : 'No requests.';
  $('#empty-description').textContent = filtered ? 'Change your search or reset the filters.' : 'Create a request to get started.';
  $('#empty-action').textContent = filtered ? 'Reset filters' : 'New request';
  $('#results-count').textContent = `Showing ${visible.length} of ${requests.length} request${requests.length === 1 ? '' : 's'}`;
  document.querySelectorAll('.tab').forEach((tab) => {
    const selected = tab.dataset.status === state.status;
    tab.classList.toggle('selected', selected);
    tab.setAttribute('aria-pressed', String(selected));
  });

}
function clearFilters() {
  Object.assign(state, { status: 'all', priority: 'all', search: '', sort: 'newest' });
  $('#search').value = ''; $('#priority-filter').value = 'all'; $('#sort').value = 'newest';
  render();
}
function clearErrors() {
  document.querySelectorAll('.field-error').forEach((node) => { node.textContent = ''; });
  document.querySelectorAll('[aria-invalid]').forEach((node) => node.removeAttribute('aria-invalid'));
  $('#form-message').hidden = true;
}
function resetValues() {
  $('#request-form').reset();
  const today = new Date();
  $('#requested-date').value = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  updateCharacterCount(); clearErrors();
}
function showDialog(id) {
  returnFocus = document.activeElement;
  $(id).showModal();
}
function openForm(request) {
  resetValues();
  $('#request-id').value = request ? request.id : '';
  $('#dialog-title').textContent = request ? 'Edit request' : 'New request';
  $('#dialog-intro').textContent = request ? `MR-${request.id.padStart(3, '0')} · All fields are required.` : 'All fields are required.';
  $('#save-request').textContent = request ? 'Save changes' : 'Create request';
  if (request) {
    for (const key of ['requested_date', 'room', 'requested_by', 'description', 'priority', 'status']) $('#request-form').elements.namedItem(key).value = request[key];
  }
  updateCharacterCount();
  showDialog('#request-dialog');
}
function openDelete(request) {
  state.deleteId = request.id;
  $('#delete-name').textContent = `MR-${request.id.padStart(3, '0')} · ${requestTitle(request.description)}`;
  $('#delete-message').hidden = true;
  showDialog('#delete-dialog');
  $('#delete-dialog button').focus();
}
function updateCharacterCount() { $('#character-count').textContent = `${$('#description').value.length.toLocaleString()} / 2,000`; }
function setBusy(busy) {
  state.busy = busy;
  document.querySelectorAll('dialog button, dialog input, dialog textarea, dialog select').forEach((node) => { node.disabled = busy; });
  $('#save-request').textContent = busy ? 'Saving…' : $('#request-id').value ? 'Save changes' : 'Create request';
  $('#confirm-delete').textContent = busy ? 'Deleting…' : 'Delete request';
}
async function refreshAfterMutation(message) {
  announce(message);
  try { await loadRequests(); }
  catch { await initialLoad(); announce(`${message} Refresh the page to see the latest board.`); }
}
$('#request-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (state.busy) return;
  clearErrors();
  const form = $('#request-form');
  if (!form.reportValidity()) return;
  const body = new URLSearchParams(new FormData(form));
  const id = $('#request-id').value;
  setBusy(true);
  try {
    const data = await api(id ? `/api/requests/${id}` : '/api/requests', { method: 'POST', body });
    $('#request-dialog').close();
    clearFilters();
    await refreshAfterMutation(data.message);
  } catch (error) {
    $('#form-message').hidden = false;
    $('#form-message').textContent = error.message;
    if (error.fields) {
      for (const [field, message] of Object.entries(error.fields)) {
        $(`#error-${field}`).textContent = message;
        form.elements.namedItem(field).setAttribute('aria-invalid', 'true');
      }
    }
  } finally { setBusy(false); form.querySelector('[aria-invalid]')?.focus(); }
});
$('#delete-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (state.busy) return;
  setBusy(true);
  try {
    const data = await api(`/api/requests/${state.deleteId}/delete`, { method: 'POST' });
    $('#delete-dialog').close();
    await refreshAfterMutation(data.message);
  } catch (error) { $('#delete-message').hidden = false; $('#delete-message').textContent = error.message; }
  finally { setBusy(false); }
});
$('#new-request').addEventListener('click', () => openForm());
$('#empty-action').addEventListener('click', () => (state.search || state.status !== 'all' || state.priority !== 'all') ? clearFilters() : openForm());
$('#reset-form').addEventListener('click', () => { const id = $('#request-id').value; resetValues(); $('#request-id').value = id; });
$('#description').addEventListener('input', updateCharacterCount);
$('#search').addEventListener('input', (event) => { state.search = event.target.value; render(); });
$('#priority-filter').addEventListener('change', (event) => { state.priority = event.target.value; render(); });
$('#sort').addEventListener('change', (event) => { state.sort = event.target.value; render(); });
$('#retry').addEventListener('click', initialLoad);
$('#refresh-requests').addEventListener('click', initialLoad);
$('#clear-filters').addEventListener('click', clearFilters);
$('#close-toast').addEventListener('click', () => { $('#toast').hidden = true; });
$('.tabs').addEventListener('click', (event) => { const tab = event.target.closest('[data-status]'); if (tab) { state.status = tab.dataset.status; render(); } });
document.querySelectorAll('[data-close]').forEach((button) => button.addEventListener('click', () => $(`#${button.dataset.close}`).close()));
document.querySelectorAll('dialog').forEach((dialog) => {
  dialog.addEventListener('cancel', (event) => { if (state.busy) event.preventDefault(); });
  dialog.addEventListener('close', () => { if (returnFocus?.isConnected) returnFocus.focus(); else $('#new-request').focus(); });
  dialog.addEventListener('click', (event) => {
    if (event.target !== dialog || state.busy) return;
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
  });
});
document.addEventListener('keydown', (event) => {
  if (event.key === '/' && !event.metaKey && !event.ctrlKey && !document.querySelector('dialog[open]') && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) {
    event.preventDefault(); $('#search').focus();
  }
});
initialLoad();
