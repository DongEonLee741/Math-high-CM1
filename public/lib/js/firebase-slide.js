// firebase-slide.js — Slide (Teacher) Firebase ES Module
// setupFocusToggle + monitor button

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-app.js";
import { getFirestore, doc, setDoc, serverTimestamp,
         collection, query, orderBy, onSnapshot, deleteDoc, updateDoc }
  from "https://www.gstatic.com/firebasejs/11.4.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCnNvdo3ozcv3HC1ilMQX_fiwn_fpB5KCM",
  authDomain: "math-class.it.kr",
  projectId: "math-high-cm1",
  storageBucket: "math-high-cm1.firebasestorage.app",
  messagingSenderId: "1097512338605",
  appId: "1:1097512338605:web:c8572e37781be52e9a7224"
};

export function initFirebaseSlide(worksheetKey) {
  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);
  const urlParams = new URLSearchParams(window.location.search);
  const classId = urlParams.get('class') || 'default';

  // ── Focus Toggle Button ──
  var focusActive = false, pollTimer = null, lastSyncedIdx = -1;

  var btn = document.createElement('button');
  btn.textContent = '\uD83D\uDCCC \uC9D1\uC911\uD558\uAE30';
  btn.style.cssText = 'position:fixed;top:12px;right:12px;background:#2563eb;color:#fff;border:none;padding:12px 20px;border-radius:12px;font-size:15px;font-weight:700;cursor:pointer;z-index:99999;box-shadow:0 2px 8px rgba(37,99,235,.3);transition:all .3s ease;';
  document.body.appendChild(btn);

  // ── Monitor Button ──
  var monitorBtn = document.createElement('button');
  monitorBtn.textContent = '\uD83D\uDCCA \uD604\uD669\uBCF4\uAE30';
  monitorBtn.style.cssText = 'position:fixed;top:12px;right:150px;background:#3b82f6;color:#fff;border:none;padding:12px 20px;border-radius:12px;font-size:15px;font-weight:700;cursor:pointer;z-index:99999;box-shadow:0 2px 8px rgba(59,130,246,.3);transition:all .3s ease;';
  monitorBtn.addEventListener('click', function() {
    window.open('https://math-class.it.kr/monitor.html?class=' + classId, '_blank');
  });
  document.body.appendChild(monitorBtn);

  // ── Presentation Notification ──
  var presentationQueue = [];

  function escapeHtml(str) {
    var d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
  }

  var presBtn = document.createElement('button');
  presBtn.id = 'presBadge';
  presBtn.style.cssText = 'position:fixed;top:12px;right:288px;background:#f59e0b;color:#fff;border:none;padding:12px 20px;border-radius:12px;font-size:15px;font-weight:700;cursor:pointer;z-index:99999;box-shadow:0 2px 8px rgba(245,158,11,.3);display:none;';
  presBtn.addEventListener('click', function() {
    showPresentationOverlay();
  });
  document.body.appendChild(presBtn);

  var presQuery = query(
    collection(db, 'classrooms', classId, 'presentations'),
    orderBy('createdAt', 'asc')
  );

  onSnapshot(presQuery, function(snapshot) {
    presentationQueue = [];
    snapshot.forEach(function(snap) {
      presentationQueue.push({ id: snap.id, ...snap.data() });
    });
    updatePresBadge();
  });

  function updatePresBadge() {
    var pending = presentationQueue.filter(function(p) { return p.status === 'pending'; });
    if (presentationQueue.length > 0) {
      presBtn.style.display = 'block';
      if (pending.length > 0) {
        presBtn.textContent = '\uD83D\uDE4B \uBC1C\uD45C ' + pending.length + '\uAC74';
        presBtn.style.animation = 'presPulse 2s infinite';
      } else {
        presBtn.textContent = '\uD83D\uDE4B \uBC1C\uD45C ' + presentationQueue.length + '\uAC74';
        presBtn.style.animation = 'none';
      }
    } else {
      presBtn.style.display = 'none';
    }
  }

  function showPresentationOverlay(targetItem) {
    var existing = document.getElementById('presOverlay');
    if (existing) existing.remove();

    if (!targetItem) {
      targetItem = presentationQueue.find(function(p) { return p.status === 'pending'; });
      if (!targetItem && presentationQueue.length > 0) targetItem = presentationQueue[0];
    }
    if (!targetItem) return;

    var queueIdx = presentationQueue.indexOf(targetItem);

    var overlay = document.createElement('div');
    overlay.id = 'presOverlay';
    overlay.className = 'pres-overlay';

    var panel = document.createElement('div');
    panel.className = 'pres-panel';

    // Header
    var header = document.createElement('div');
    header.className = 'pres-header';
    header.innerHTML = '<div class="pres-student-info">' +
      '<span class="pres-student-name">' + escapeHtml(targetItem.studentName) + '</span>' +
      '<span class="pres-block-title">' + escapeHtml(targetItem.blockTitle) + '</span>' +
      '</div>' +
      '<span class="pres-queue-info">' + (queueIdx + 1) + ' / ' + presentationQueue.length + '</span>';
    panel.appendChild(header);

    // Body
    var body = document.createElement('div');
    body.className = 'pres-body';

    if (targetItem.problemHtml) {
      var problemDiv = document.createElement('div');
      problemDiv.className = 'pres-problem';
      problemDiv.innerHTML = targetItem.problemHtml;
      body.appendChild(problemDiv);
    }

    if (targetItem.canvasImages && targetItem.canvasImages.length > 0) {
      var canvasDiv = document.createElement('div');
      canvasDiv.className = 'pres-canvases';
      targetItem.canvasImages.forEach(function(imgData) {
        if (!imgData) return;
        var wrap = document.createElement('div');
        wrap.className = 'pres-canvas-wrap';
        var img = document.createElement('img');
        img.src = imgData;
        img.alt = '\uD559\uC0DD \uD480\uC774';
        wrap.appendChild(img);
        canvasDiv.appendChild(wrap);
      });
      body.appendChild(canvasDiv);
    }

    panel.appendChild(body);

    // Actions
    var actions = document.createElement('div');
    actions.className = 'pres-actions';

    var deleteBtn = document.createElement('button');
    deleteBtn.className = 'pres-btn pres-btn-delete';
    deleteBtn.textContent = '\uD83D\uDDD1 \uC0AD\uC81C';
    deleteBtn.addEventListener('click', function() {
      deleteDoc(doc(db, 'classrooms', classId, 'presentations', targetItem.id))
        .then(function() {
          var nextItem = presentationQueue.find(function(p) { return p.id !== targetItem.id; });
          if (nextItem) showPresentationOverlay(nextItem);
          else closePresentationOverlay();
        });
    });
    actions.appendChild(deleteBtn);

    if (presentationQueue.length > 1) {
      var nextBtn = document.createElement('button');
      nextBtn.className = 'pres-btn pres-btn-next';
      nextBtn.textContent = '\u25B6 \uB2E4\uC74C';
      nextBtn.addEventListener('click', function() {
        var nextIdx = (queueIdx + 1) % presentationQueue.length;
        showPresentationOverlay(presentationQueue[nextIdx]);
      });
      actions.appendChild(nextBtn);
    }

    var backBtn = document.createElement('button');
    backBtn.className = 'pres-btn pres-btn-back';
    backBtn.textContent = '\u21A9 \uB3CC\uC544\uAC00\uAE30';
    backBtn.addEventListener('click', closePresentationOverlay);
    actions.appendChild(backBtn);

    panel.appendChild(actions);
    overlay.appendChild(panel);
    document.body.appendChild(overlay);

    // KaTeX re-render
    if (window.renderMathInElement) {
      try {
        renderMathInElement(body, {
          delimiters: [
            { left: '$$', right: '$$', display: true },
            { left: '$', right: '$', display: false },
            { left: '\\(', right: '\\)', display: false },
            { left: '\\[', right: '\\]', display: true }
          ],
          throwOnError: false
        });
      } catch (e) { console.warn('KaTeX render error:', e); }
    }

    // Mark as viewed
    if (targetItem.status === 'pending') {
      updateDoc(doc(db, 'classrooms', classId, 'presentations', targetItem.id), {
        status: 'viewed'
      }).catch(function(e) { console.warn('Status update error:', e); });
    }
  }

  function closePresentationOverlay() {
    var el = document.getElementById('presOverlay');
    if (el) el.remove();
  }

  // ── Section Detection (slide index → content block index) ──
  function getCurrentSection() {
    var slides = document.querySelectorAll('.slide');
    if (!slides.length) return 0;

    // Find active slide index
    var activeIdx = 0;
    slides.forEach(function(s, i) { if (s.classList.contains('active')) activeIdx = i; });

    // Build list of content slide indices
    // (excluding title-slide and section-header-slide on .slide-content)
    var contentSlideIndices = [];
    slides.forEach(function(s, i) {
      var sc = s.querySelector('.slide-content');
      if (sc && !sc.classList.contains('title-slide') && !sc.classList.contains('section-header-slide')) {
        contentSlideIndices.push(i);
      }
    });

    if (contentSlideIndices.length === 0) return 0;

    // Map active slide to content block index:
    // - If active IS a content slide → return its position among content slides
    // - If active is title/header → return the next content slide's position
    for (var i = 0; i < contentSlideIndices.length; i++) {
      if (contentSlideIndices[i] >= activeIdx) return i;
    }

    // Fallback: last content block
    return contentSlideIndices.length - 1;
  }

  // ── Firestore Sync ──
  function syncSection(idx) {
    if (!focusActive) return;
    setDoc(doc(db, 'classrooms', classId), {
      focusActive: true, focusSection: idx, updatedAt: serverTimestamp()
    }, { merge: true });
  }

  // ── Polling (replaces MutationObserver for reliability) ──
  function startPolling() {
    lastSyncedIdx = getCurrentSection();
    pollTimer = setInterval(function() {
      if (!focusActive) return;
      var newIdx = getCurrentSection();
      if (newIdx !== lastSyncedIdx) {
        lastSyncedIdx = newIdx;
        syncSection(newIdx);
      }
    }, 400);
  }

  function stopPolling() {
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
    lastSyncedIdx = -1;
  }

  // ── Toggle Click ──
  btn.addEventListener('click', async function() {
    focusActive = !focusActive;
    if (focusActive) {
      var initIdx = getCurrentSection();
      lastSyncedIdx = initIdx;
      await setDoc(doc(db, 'classrooms', classId), {
        focusActive: true, focusSection: initIdx, updatedAt: serverTimestamp()
      }, { merge: true });
      btn.textContent = '\uD83D\uDD13 \uC9D1\uC911 \uD574\uC81C';
      btn.style.background = '#ef4444';
      btn.style.boxShadow = '0 2px 8px rgba(239,68,68,.3)';
      startPolling();
    } else {
      stopPolling();
      await setDoc(doc(db, 'classrooms', classId), {
        focusActive: false, updatedAt: serverTimestamp()
      }, { merge: true });
      btn.textContent = '\uD83D\uDCCC \uC9D1\uC911\uD558\uAE30';
      btn.style.background = '#2563eb';
      btn.style.boxShadow = '0 2px 8px rgba(37,99,235,.3)';
    }
  });
}
