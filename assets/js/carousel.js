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
        '<button class="btn btn-primary" data-book-demo="' + tutor.id + '" data-tutor-name="' + escHtml(tutor.name) + '">Book Free Demo</button>' +
        '<button class="btn btn-secondary" onclick="window.TLFunctions&&window.TLFunctions.showToast(\'Messaging coming soon!\',\'success\')">Message Tutor</button>' +
      '</div>';

    /* Wire demo booking button */
    var bookBtn = body.querySelector('[data-book-demo]');
    if (bookBtn) {
      bookBtn.addEventListener('click', function () {
        closeTutorModal();
        openBookingConfirmModal(tutor);
      });
    }

    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  /* ---- Demo Booking Confirmation Modal ---- */
  function openBookingConfirmModal(tutor) {
    var overlay = document.getElementById('booking-confirm-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id        = 'booking-confirm-overlay';
      overlay.className = 'tl-modal-overlay';
      overlay.setAttribute('role', 'dialog');
      overlay.setAttribute('aria-modal', 'true');
      overlay.setAttribute('aria-labelledby', 'booking-confirm-title');
      document.body.appendChild(overlay);

      overlay.addEventListener('click', function (e) {
        if (e.target === overlay) closeBookingConfirmModal();
      });
    }

    overlay.innerHTML =
      '<div class="tl-modal" style="max-width:440px;text-align:center;">' +
        '<button class="tl-modal__close" id="booking-confirm-close" aria-label="Cancel booking">&#10005;</button>' +
        '<div style="font-size:3rem;margin-bottom:1rem;">🎓</div>' +
        '<h2 class="tl-section__title" id="booking-confirm-title" style="margin-bottom:0.75rem;">Book Free Demo</h2>' +
        '<p style="color:var(--color-text-muted);margin-bottom:1.5rem;line-height:1.6;">' +
          'You\'re about to book a free 30-minute demo session with<br>' +
          '<strong style="color:var(--color-yellow);">' + escHtml(tutor.name) + '</strong>.' +
        '</p>' +
        '<p style="font-size:0.82rem;color:var(--color-text-muted);margin-bottom:1.5rem;">' +
          'Our team will contact you within 24 hours to confirm a time that works for both of you.' +
        '</p>' +
        '<div style="display:flex;gap:0.75rem;justify-content:center;">' +
          '<button class="btn btn-primary" id="booking-confirm-btn">Confirm Booking</button>' +
          '<button class="btn btn-outline" id="booking-cancel-btn">Cancel</button>' +
        '</div>' +
      '</div>';

    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';

    document.getElementById('booking-confirm-close').addEventListener('click', closeBookingConfirmModal);
    document.getElementById('booking-cancel-btn').addEventListener('click', closeBookingConfirmModal);
    document.getElementById('booking-confirm-btn').addEventListener('click', function () {
      closeBookingConfirmModal();
      /* Notify Cloud Function */
      if (window.TLFunctions && window.TLFunctions.bookDemoClass) {
        window.TLFunctions.bookDemoClass(tutor.id, { tutorName: tutor.name, subject: tutor.subject });
      }
      if (window.TLFunctions && window.TLFunctions.showToast) {
        window.TLFunctions.showToast('🎉 Demo booked! We\'ll be in touch within 24 hours.', 'success');
      }
    });
  }

  function closeBookingConfirmModal() {
    var overlay = document.getElementById('booking-confirm-overlay');
    if (overlay) overlay.classList.remove('open');
    document.body.style.overflow = '';
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

    /* ESC key closes modals */
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        closeTutorModal();
        closeBookingConfirmModal();
      }
    });
  });

  /* Expose for external use */
  window.TLCarousel = {
    openTutorModal: openTutorModal,
    closeTutorModal: closeTutorModal
  };
}());
