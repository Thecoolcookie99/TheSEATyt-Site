document.addEventListener('DOMContentLoaded', () => {
    let theme = "orange";
    const cards = document.querySelectorAll('.card');
    const overlay = document.getElementById('modalOverlay');
    const modalTitle = document.getElementById('modalTitle');
    const modalContent = document.getElementById('modalContent');
    const closeBtn = document.getElementById('modalClose');
    const logo = document.querySelector('.theSEAT');
    let lastFocused = null;

    // Page entrance
    setTimeout(() => {
        document.body.classList.add('loaded');
    }, 80);

    function openModal(title, content, trigger) {
        lastFocused = trigger || document.activeElement;
        modalTitle.textContent = title;
        modalContent.innerHTML = content;
        overlay.classList.remove('hidden');
        overlay.setAttribute('aria-hidden', 'false');
        document.body.classList.add('modal-open');
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
        if (e.key === 'Escape') {
            closeModal();
            return;
        }
        if (e.key === 'Tab' && !overlay.classList.contains('hidden')) {
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

    function updateTheme() {
        const body = document.body;

        if (theme === "green") {
            body.classList.remove('orange-theme');
            body.classList.add('green-theme');
            document.documentElement.style.setProperty('--primary', 'rgb(85, 255, 213)');
            document.documentElement.style.setProperty('--primary-light', 'rgb(0, 255, 195)');
            document.documentElement.style.setProperty('--primary-lighter', 'rgb(0, 255, 76)');
        } else {
            body.classList.remove('green-theme');
            body.classList.add('orange-theme');
            document.documentElement.style.setProperty('--primary', 'rgb(255, 121, 121)');
            document.documentElement.style.setProperty('--primary-light', 'rgb(225,43,43)');
            document.documentElement.style.setProperty('--primary-lighter', 'yellow');
        }
    }

    // Initial theme
    updateTheme();

    // Logo = theme switch
    if (logo) {
        logo.addEventListener('click', () => {
            theme = theme === "orange" ? "green" : "orange";
            updateTheme();
        });
    }

    // Card tilt effect 
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

    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeModal();
    });
    }),
    closeBtn.addEventListener('click', closeModal);
});