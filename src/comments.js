import { getUser, isAdmin } from './auth.js';

// Format a date as relative time (e.g. "3 days ago")
function formatRelativeTime(dateStr) {
  const date = new Date(dateStr + 'Z'); // SQLite stores UTC without Z
  const now = new Date();
  const diffMs = now - date;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// Render comments for a painting into containerEl
// Returns a cleanup function to call when lightbox closes
export function renderComments(paintingId, containerEl) {
  let currentEditId = null;

  containerEl.innerHTML = '';

  const listEl = document.createElement('div');
  listEl.className = 'comments__list';

  const formSection = document.createElement('div');
  formSection.className = 'comments__form-section';

  containerEl.appendChild(listEl);
  containerEl.appendChild(formSection);

  async function loadComments() {
    try {
      const res = await fetch(`/api/comments/${encodeURIComponent(paintingId)}`);
      const comments = await res.json();
      renderList(comments);
    } catch {
      listEl.innerHTML = '<p class="comments__error">Could not load comments.</p>';
    }
  }

  function renderList(comments) {
    listEl.innerHTML = '';
    comments.forEach(comment => {
      listEl.appendChild(renderComment(comment));
    });
  }

  function renderComment(comment) {
    const user = getUser();
    const canEdit = user && user.id === comment.user_id;
    const canDelete = user && (user.id === comment.user_id || isAdmin());

    const item = document.createElement('div');
    item.className = 'comment';
    item.dataset.id = comment.id;

    const bodyEl = document.createElement('p');
    bodyEl.className = 'comment__body';
    bodyEl.textContent = comment.body;

    const metaEl = document.createElement('div');
    metaEl.className = 'comment__meta';

    const attribution = document.createElement('span');
    attribution.className = 'comment__attribution';
    // Build attribution: "Display Name, Relation · time ago"
    const nameText = comment.display_name || 'Family Member';
    const relationText = comment.relation ? `, ${comment.relation}` : '';
    attribution.textContent = `— ${nameText}${relationText} · ${formatRelativeTime(comment.created_at)}`;

    metaEl.appendChild(attribution);

    if (canEdit || canDelete) {
      const actionsEl = document.createElement('span');
      actionsEl.className = 'comment__actions';

      if (canEdit) {
        const editBtn = document.createElement('button');
        editBtn.className = 'comment__action-btn';
        editBtn.textContent = 'Edit';
        editBtn.addEventListener('click', () => startEdit(item, comment));
        actionsEl.appendChild(editBtn);
      }

      if (canDelete) {
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'comment__action-btn comment__action-btn--danger';
        deleteBtn.textContent = 'Delete';
        deleteBtn.addEventListener('click', () => confirmDelete(item, comment.id));
        actionsEl.appendChild(deleteBtn);
      }

      metaEl.appendChild(actionsEl);
    }

    item.appendChild(bodyEl);
    item.appendChild(metaEl);
    return item;
  }

  function startEdit(itemEl, comment) {
    if (currentEditId !== null) return; // Only one edit at a time
    currentEditId = comment.id;

    const bodyEl = itemEl.querySelector('.comment__body');
    bodyEl.classList.add('hidden');

    const editArea = document.createElement('textarea');
    editArea.className = 'comment__edit-textarea';
    editArea.value = comment.body;
    editArea.maxLength = 2000;

    const editActions = document.createElement('div');
    editActions.className = 'comment__edit-actions';

    const saveBtn = document.createElement('button');
    saveBtn.className = 'btn btn--primary btn--sm';
    saveBtn.textContent = 'Save';

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'btn btn--ghost btn--sm';
    cancelBtn.textContent = 'Cancel';

    editActions.appendChild(saveBtn);
    editActions.appendChild(cancelBtn);

    itemEl.insertBefore(editArea, bodyEl);
    itemEl.insertBefore(editActions, bodyEl);
    editArea.focus();
    editArea.setSelectionRange(editArea.value.length, editArea.value.length);

    cancelBtn.addEventListener('click', () => cancelEdit(itemEl, bodyEl, editArea, editActions));

    saveBtn.addEventListener('click', async () => {
      const newBody = editArea.value.trim();
      if (!newBody || newBody.length > 2000) return;

      saveBtn.disabled = true;
      try {
        const res = await fetch(`/api/comments/${comment.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ body: newBody }),
        });
        if (res.ok) {
          const updated = await res.json();
          comment.body = updated.body;
          comment.updated_at = updated.updated_at;
          bodyEl.textContent = updated.body;
          cancelEdit(itemEl, bodyEl, editArea, editActions);
        }
      } catch {
        // ignore
      } finally {
        saveBtn.disabled = false;
      }
    });
  }

  function cancelEdit(itemEl, bodyEl, editArea, editActions) {
    currentEditId = null;
    editArea.remove();
    editActions.remove();
    bodyEl.classList.remove('hidden');
  }

  async function confirmDelete(itemEl, commentId) {
    if (!confirm('Delete this comment?')) return;

    try {
      const res = await fetch(`/api/comments/${commentId}`, { method: 'DELETE' });
      if (res.ok) {
        itemEl.remove();
      }
    } catch {
      // ignore
    }
  }

  function renderForm() {
    formSection.innerHTML = '';

    const user = getUser();
    if (!user || !user.relation) return;

    const form = document.createElement('form');
    form.className = 'comment-form';

    const textarea = document.createElement('textarea');
    textarea.className = 'comment-form__input';
    textarea.placeholder = 'Share a memory about this painting...';
    textarea.maxLength = 2000;
    textarea.rows = 3;

    const footer = document.createElement('div');
    footer.className = 'comment-form__footer';

    const charCount = document.createElement('span');
    charCount.className = 'comment-form__char-count';
    charCount.textContent = '0 / 2000';

    const submitBtn = document.createElement('button');
    submitBtn.type = 'submit';
    submitBtn.className = 'btn btn--primary btn--sm';
    submitBtn.textContent = 'Post';

    textarea.addEventListener('input', () => {
      charCount.textContent = `${textarea.value.length} / 2000`;
    });

    footer.appendChild(charCount);
    footer.appendChild(submitBtn);
    form.appendChild(textarea);
    form.appendChild(footer);

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const body = textarea.value.trim();
      if (!body || body.length > 2000) return;

      submitBtn.disabled = true;
      try {
        const res = await fetch(`/api/comments/${encodeURIComponent(paintingId)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ body }),
        });
        if (res.ok) {
          const comment = await res.json();
          listEl.appendChild(renderComment(comment));
          textarea.value = '';
          charCount.textContent = '0 / 2000';
        }
      } catch {
        // ignore
      } finally {
        submitBtn.disabled = false;
      }
    });

    formSection.appendChild(form);
  }

  // Initial render
  loadComments();
  renderForm();

  // Cleanup function
  return function cleanup() {
    containerEl.innerHTML = '';
    currentEditId = null;
  };
}
