// main.js — small interactions for highlight & flare
document.addEventListener('DOMContentLoaded', () => {
  // subtle load class
  window.setTimeout(() => document.body.classList.add('loaded'), 80);

  // card hover / click highlights
  document.querySelectorAll('.card').forEach(card => {
    card.addEventListener('mouseenter', () => {
      card.classList.add('is-highlight');
    });
    card.addEventListener('mouseleave', () => {
      card.classList.remove('is-highlight');
    });
    // clicking toggles highlight (useful for keyboard users too)
    card.addEventListener('click', (e) => {
      // allow toggling only when the target is the card or inside a tag
      if (!card.classList.contains('is-highlight')) card.classList.add('is-highlight'); else card.classList.remove('is-highlight');
    });
  });

  // Flare follow effect — moves flare element based on mouse inside each card
  document.querySelectorAll('.card').forEach(card => {
    const flare = card.querySelector('.flare');
    if (!flare) return;
    card.addEventListener('mousemove', (ev) => {
      const rect = card.getBoundingClientRect();
      const x = ((ev.clientX - rect.left) / rect.width) * 100;
      const y = ((ev.clientY - rect.top) / rect.height) * 100;
      flare.style.left = `${x}%`;
      flare.style.top = `${y}%`;
      flare.style.opacity = '0.95';
    });
    card.addEventListener('mouseleave', () => {
      flare.style.opacity = '0';
    });
  });
});
