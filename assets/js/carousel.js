/**
 * TutorsLink Carousel
 * Handles drag-to-scroll and arrow navigation for horizontal carousels.
 */
(function () {
  'use strict';

  /**
   * Initialise all carousels on the page.
   * Each carousel wrapper should have:
   *   - a child with class `tl-carousel`  (the scroll container)
   *   - optionally `.tl-carousel__arrow--prev` and `.tl-carousel__arrow--next`
   */
  function initCarousels() {
    document.querySelectorAll('.tl-carousel-wrap').forEach(function (wrap) {
      var track = wrap.querySelector('.tl-carousel');
      if (!track) return;

      var prevBtn = wrap.querySelector('.tl-carousel__arrow--prev');
      var nextBtn = wrap.querySelector('.tl-carousel__arrow--next');

      /* ---- Arrow navigation ---- */
      var scrollAmount = 300;

      if (prevBtn) {
        prevBtn.addEventListener('click', function () {
          track.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
        });
      }

      if (nextBtn) {
        nextBtn.addEventListener('click', function () {
          track.scrollBy({ left: scrollAmount, behavior: 'smooth' });
        });
      }

      /* ---- Drag-to-scroll ---- */
      var isDragging = false;
      var startX = 0;
      var scrollLeft = 0;

      track.addEventListener('mousedown', function (e) {
        isDragging = true;
        startX = e.pageX - track.offsetLeft;
        scrollLeft = track.scrollLeft;
        track.classList.add('dragging');
      });

      track.addEventListener('mousemove', function (e) {
        if (!isDragging) return;
        e.preventDefault();
        var x = e.pageX - track.offsetLeft;
        var walk = (x - startX) * 1.5;
        track.scrollLeft = scrollLeft - walk;
      });

      track.addEventListener('mouseup',    stopDrag);
      track.addEventListener('mouseleave', stopDrag);

      function stopDrag() {
        isDragging = false;
        track.classList.remove('dragging');
      }

      /* ---- Touch swipe ---- */
      var touchStartX = 0;
      var touchScrollLeft = 0;

      track.addEventListener('touchstart', function (e) {
        touchStartX = e.touches[0].pageX;
        touchScrollLeft = track.scrollLeft;
      }, { passive: true });

      track.addEventListener('touchmove', function (e) {
        var dx = touchStartX - e.touches[0].pageX;
        track.scrollLeft = touchScrollLeft + dx;
      }, { passive: true });

      /* ---- Update arrow visibility ---- */
      function updateArrows() {
        if (!prevBtn || !nextBtn) return;
        prevBtn.style.opacity = track.scrollLeft <= 0 ? '0.3' : '1';
        nextBtn.style.opacity =
          track.scrollLeft + track.clientWidth >= track.scrollWidth - 1 ? '0.3' : '1';
      }

      track.addEventListener('scroll', updateArrows, { passive: true });
      updateArrows();
    });
  }

  /**
   * Load tutors from JSON and render into carousel.
   */
  function loadTutors() {
    var carousel = document.getElementById('tutor-carousel');
    if (!carousel) return;

    fetch('assets/data/tutors.json')
      .then(function (r) { return r.json(); })
      .then(function (tutors) {
        carousel.innerHTML = tutors.map(function (t) {
          return renderTutorCard(t);
        }).join('');

        /* Attach click handlers */
        carousel.querySelectorAll('.tl-tutor-card').forEach(function (card) {
          card.addEventListener('click', function () {
            var id = parseInt(card.dataset.id, 10);
            var tutor = tutors.find(function (t) { return t.id === id; });
            if (tutor) openTutorModal(tutor);
          });
        });

        /* Re-init arrows after content is loaded */
        initCarousels();
      })
      .catch(function (err) {
        console.error('Failed to load tutors:', err);
        carousel.innerHTML = '<p class="text-muted">Unable to load tutors.</p>';
      });
  }

  function renderTutorCard(t) {
    return (
      '<div class="tl-tutor-card" data-id="' + t.id + '">' +
        '<div class="tl-tutor-card__avatar" style="background:' + t.avatarColor + '">' + t.avatar + '</div>' +
        '<div class="tl-tutor-card__name">' + escHtml(t.name) + '</div>' +
        '<div class="tl-tutor-card__subject">' + t.subjectIcon + ' ' + escHtml(t.subject) + '</div>' +
        '<div class="tl-tutor-card__rating">★ ' + t.rating + '<span class="text-muted">(' + t.reviews + ' reviews)</span></div>' +
        '<div class="tl-tutor-card__meta"><span>💰 ' + escHtml(t.rate) + '</span><span>🌍 ' + escHtml(t.timezone) + '</span></div>' +
        '<button class="btn btn-primary tl-tutor-card__btn">View Profile</button>' +
      '</div>'
    );
  }

  /**
   * Load features from JSON and render into carousel.
   */
  function loadFeatures() {
    var carousel = document.getElementById('features-carousel');
    if (!carousel) return;

    fetch('assets/data/features.json')
      .then(function (r) { return r.json(); })
      .then(function (features) {
        carousel.innerHTML = features.map(function (f) {
          return renderFeatureCard(f);
        }).join('');

        /* Attach expand/collapse click handlers */
        carousel.querySelectorAll('.tl-feature-card').forEach(function (card) {
          card.addEventListener('click', function () {
            var isExpanded = card.classList.contains('expanded');
            /* Collapse all others */
            carousel.querySelectorAll('.tl-feature-card').forEach(function (c) {
              c.classList.remove('expanded');
              var toggle = c.querySelector('.tl-feature-card__toggle');
              if (toggle) toggle.textContent = '+ Read more';
            });
            if (!isExpanded) {
              card.classList.add('expanded');
              var toggle = card.querySelector('.tl-feature-card__toggle');
              if (toggle) toggle.textContent = '− Read less';
            }
          });
        });

        initCarousels();
      })
      .catch(function (err) {
        console.error('Failed to load features:', err);
        carousel.innerHTML = '<p class="text-muted">Unable to load features.</p>';
      });
  }

  function renderFeatureCard(f) {
    return (
      '<div class="tl-feature-card">' +
        '<div class="tl-feature-card__icon">' + f.icon + '</div>' +
        '<div class="tl-feature-card__title">' + escHtml(f.title) + '</div>' +
        '<div class="tl-feature-card__short">' + escHtml(f.shortDesc) + '</div>' +
        '<div class="tl-feature-card__full">' + escHtml(f.fullDesc) + '</div>' +
        '<div class="tl-feature-card__toggle">+ Read more</div>' +
      '</div>'
    );
  }

  /* ---- Tutor Modal ---- */
  function openTutorModal(tutor) {
    var overlay = document.getElementById('tutor-modal-overlay');
    var body    = document.getElementById('tutor-modal-body');
    if (!overlay || !body) return;

    body.innerHTML =
      '<div class="tl-modal__avatar" style="background:' + tutor.avatarColor + '">' + escHtml(tutor.avatar) + '</div>' +
      '<div class="tl-modal__name">'    + escHtml(tutor.name)    + '</div>' +
      '<div class="tl-modal__subject">' + tutor.subjectIcon + ' ' + escHtml(tutor.subject) + '</div>' +
      '<div class="tl-modal__meta-grid">' +
        '<div class="tl-modal__meta-item"><div class="tl-modal__meta-label">Rate</div><div class="tl-modal__meta-value">' + escHtml(tutor.rate) + '</div></div>' +
        '<div class="tl-modal__meta-item"><div class="tl-modal__meta-label">Timezone</div><div class="tl-modal__meta-value">' + escHtml(tutor.timezone) + '</div></div>' +
        '<div class="tl-modal__meta-item"><div class="tl-modal__meta-label">Rating</div><div class="tl-modal__meta-value">★ ' + tutor.rating + ' (' + tutor.reviews + ')</div></div>' +
        '<div class="tl-modal__meta-item"><div class="tl-modal__meta-label">Languages</div><div class="tl-modal__meta-value">' + escHtml(tutor.languages.join(', ')) + '</div></div>' +
      '</div>' +
      '<p class="tl-modal__bio">' + escHtml(tutor.bio) + '</p>' +
      '<div class="tl-modal__tags">' +
        tutor.languages.map(function (l) { return '<span class="tl-tag">' + escHtml(l) + '</span>'; }).join('') +
      '</div>' +
      '<div class="tl-modal__actions">' +
        '<a href="#" class="btn btn-primary">Book Free Demo</a>' +
        '<a href="#" class="btn btn-secondary">Message Tutor</a>' +
      '</div>';

    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeTutorModal() {
    var overlay = document.getElementById('tutor-modal-overlay');
    if (overlay) overlay.classList.remove('open');
    document.body.style.overflow = '';
  }

  /* ---- Utility ---- */
  function escHtml(str) {
    return String(str)
      .replace(/&/g,  '&amp;')
      .replace(/</g,  '&lt;')
      .replace(/>/g,  '&gt;')
      .replace(/"/g,  '&quot;')
      .replace(/'/g,  '&#39;');
  }

  /* ---- Mobile nav toggle ---- */
  function initMobileNav() {
    var hamburger = document.querySelector('.tl-nav__hamburger');
    var nav       = document.querySelector('.tl-nav');
    if (!hamburger || !nav) return;

    hamburger.addEventListener('click', function () {
      nav.classList.toggle('mobile-open');
    });

    /* Close on outside click */
    document.addEventListener('click', function (e) {
      if (!nav.contains(e.target)) {
        nav.classList.remove('mobile-open');
      }
    });
  }

  /* ---- Init on DOM ready ---- */
  document.addEventListener('DOMContentLoaded', function () {
    initMobileNav();
    initCarousels();
    loadTutors();
    loadFeatures();

    /* Modal close button */
    var closeBtn = document.getElementById('tutor-modal-close');
    if (closeBtn) closeBtn.addEventListener('click', closeTutorModal);

    var overlay = document.getElementById('tutor-modal-overlay');
    if (overlay) {
      overlay.addEventListener('click', function (e) {
        if (e.target === overlay) closeTutorModal();
      });
    }

    /* ESC key closes modal */
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeTutorModal();
    });
  });

  /* Expose for external use */
  window.TLCarousel = {
    openTutorModal: openTutorModal,
    closeTutorModal: closeTutorModal
  };
}());
