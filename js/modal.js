document.addEventListener('DOMContentLoaded', () => {
  const cards = document.querySelectorAll('.card');
  const overlay = document.getElementById('modalOverlay');
  const modalTitle = document.getElementById('modalTitle');
  const modalContent = document.getElementById('modalContent');
  const closeBtn = document.getElementById('modalClose');
  let lastFocused = null;

  function openModal(title, content, trigger) {
    lastFocused = trigger || document.activeElement;
    modalTitle.textContent = title;
    modalContent.innerHTML = content;
    overlay.classList.remove('hidden');
    overlay.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');
    // move focus into the modal
    closeBtn.focus();
    document.addEventListener('keydown', onKeyDown);
  }

  function closeModal() {
    overlay.classList.add('hidden');
    overlay.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('modal-open');
    if (lastFocused) lastFocused.focus();
    document.removeEventListener('keydown', onKeyDown);
  }

  function onKeyDown(e) {
    if (e.key === 'Escape') closeModal();
    // basic trapping: keep focus inside modal when TAB pressed
    if (e.key === 'Tab' && overlay && !overlay.classList.contains('hidden')) {
      const focusable = overlay.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal();
  });

  closeBtn.addEventListener('click', closeModal);

  cards.forEach(card => {
    // make sure every card is focusable and clickable
    const defaultAngle = 135;
    card.style.setProperty('--g-angle', defaultAngle + 'deg');

    card.addEventListener('pointermove', (e) => {
      const rect = card.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      const angle = (Math.atan2(dy, dx) * 180 / Math.PI) + 90;
      card.style.setProperty('--g-angle', angle + 'deg');
    });

    card.addEventListener('pointerleave', () => {
      card.style.setProperty('--g-angle', defaultAngle + 'deg');
    });

    card.addEventListener('click', () => {
      const title = card.querySelector('h4')?.textContent || 'Details';
      const extraEl = card.querySelector('.card-extra');
      const extra = extraEl ? extraEl.innerHTML : '<p>No extra info.</p>';
      openModal(title, extra, card);
    });

    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        card.click();
      }
    });
  });
});