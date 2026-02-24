/**
 * TutorsLink Ads / Announcements
 * Loads active ads from Firestore and renders them on the page.
 * Depends on firebase-app.js being loaded first.
 */
(function () {
  'use strict';

  function escHtml(str) {
    return String(str)
      .replace(/&/g,  '&amp;')
      .replace(/</g,  '&lt;')
      .replace(/>/g,  '&gt;')
      .replace(/"/g,  '&quot;')
      .replace(/'/g,  '&#39;');
  }

  function formatDate(value) {
    if (!value) return '';
    var d = (value && typeof value.toDate === 'function') ? value.toDate() : new Date(value);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  }

  function renderAd(ad) {
    var sourceLabel = ad.source === 'discord'
      ? '<span style="font-size:0.75rem;color:var(--color-text-muted);background:rgba(88,101,242,0.15);border:1px solid rgba(88,101,242,0.4);border-radius:4px;padding:0.15rem 0.5rem;margin-left:0.5rem;">Discord</span>'
      : '';
    var dateStr = formatDate(ad.createdAt);
    return (
      '<article class="tl-ad-card" aria-label="' + escHtml(ad.title) + '">' +
        '<div class="tl-ad-card__title">' + escHtml(ad.title) + sourceLabel + '</div>' +
        '<p class="tl-ad-card__body">' + escHtml(ad.body) + '</p>' +
        (dateStr ? '<div class="tl-ad-card__date">' + escHtml(dateStr) + '</div>' : '') +
      '</article>'
    );
  }

  function loadAds() {
    var container = document.getElementById('tl-ads-container');
    var loading   = document.getElementById('tl-ads-loading');
    var empty     = document.getElementById('tl-ads-empty');
    if (!container) return;

    window.TLFunctions.onReady(function () {
      window.TLFunctions.listAds(false)
        .then(function (ads) {
          if (loading) loading.style.display = 'none';
          if (!ads || ads.length === 0) {
            if (empty) empty.style.display = 'block';
            return;
          }
          container.innerHTML = ads.map(renderAd).join('');
          container.style.display = 'grid';
        })
        .catch(function (err) {
          console.error('[Ads] Failed to load ads:', err);
          if (loading) loading.style.display = 'none';
          if (empty) empty.style.display = 'block';
        });
    });
  }

  document.addEventListener('DOMContentLoaded', loadAds);

}());
