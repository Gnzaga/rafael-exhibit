import { getUser, checkAuth } from './auth.js';

const RELATIONS = [
  'Son', 'Daughter', 'Son in Law', 'Daughter in Law',
  'Grandson', 'Granddaughter', 'Wife', 'Husband',
  'Brother', 'Sister', 'Nephew', 'Niece', 'Cousin', 'Friend'
];

export function initProfileModal(containerEl) {
  const modal = document.createElement('div');
  modal.className = 'profile-modal hidden';
  modal.id = 'profile-modal';
  modal.innerHTML = `
    <div class="profile-modal__backdrop"></div>
    <div class="profile-modal__dialog" role="dialog" aria-modal="true" aria-labelledby="profile-modal-title">
      <h2 class="profile-modal__title" id="profile-modal-title">Your Profile</h2>
      <p class="profile-modal__subtitle">Help us know who you are in the family</p>
      <form class="profile-modal__form" id="profile-form">
        <div class="profile-modal__field">
          <label for="profile-name">Your name</label>
          <input type="text" id="profile-name" name="display_name" maxlength="100" required placeholder="e.g. Voltaire Gonzaga" />
        </div>
        <div class="profile-modal__field">
          <label for="profile-relation">Your relation to Rafael</label>
          <select id="profile-relation" name="relation" required>
            <option value="">— Select —</option>
            ${RELATIONS.map(r => `<option value="${r}">${r}</option>`).join('')}
          </select>
        </div>
        <div class="profile-modal__error hidden" id="profile-error"></div>
        <div class="profile-modal__actions">
          <button type="submit" class="btn btn--primary">Save Profile</button>
          <button type="button" class="btn btn--ghost" id="profile-cancel">Cancel</button>
        </div>
      </form>
    </div>
  `;

  containerEl.appendChild(modal);

  const form = modal.querySelector('#profile-form');
  const cancelBtn = modal.querySelector('#profile-cancel');
  const errorEl = modal.querySelector('#profile-error');
  const backdrop = modal.querySelector('.profile-modal__backdrop');

  function open() {
    const user = getUser();
    if (user) {
      form.querySelector('#profile-name').value = user.display_name || '';
      const sel = form.querySelector('#profile-relation');
      sel.value = user.relation || '';
    }
    modal.classList.remove('hidden');
    form.querySelector('#profile-name').focus();
  }

  function close() {
    modal.classList.add('hidden');
    errorEl.classList.add('hidden');
    errorEl.textContent = '';
  }

  cancelBtn.addEventListener('click', close);
  backdrop.addEventListener('click', close);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEl.classList.add('hidden');

    const display_name = form.querySelector('#profile-name').value.trim();
    const relation = form.querySelector('#profile-relation').value;

    if (!display_name) {
      errorEl.textContent = 'Please enter your name.';
      errorEl.classList.remove('hidden');
      return;
    }
    if (!relation) {
      errorEl.textContent = 'Please select your relation to Rafael.';
      errorEl.classList.remove('hidden');
      return;
    }

    try {
      const res = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ display_name, relation }),
      });

      if (!res.ok) {
        const data = await res.json();
        errorEl.textContent = data.error || 'Failed to save profile.';
        errorEl.classList.remove('hidden');
        return;
      }

      await checkAuth(); // Refresh user data
      close();
    } catch {
      errorEl.textContent = 'Network error. Please try again.';
      errorEl.classList.remove('hidden');
    }
  });

  return { open, close };
}
