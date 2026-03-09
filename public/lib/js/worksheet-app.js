// worksheet-app.js — Worksheet App Logic ES Module
// toggleAnswer, localStorage, records panel, canvas init, KaTeX render

import { WritingCanvas } from './writing-canvas.js';

export function initWorksheetApp(storageKey) {

  // ── file:// 프로토콜 감지 (iPad Safari에서 localStorage 차단됨) ──
  if (window.location.protocol === 'file:') {
    var fileWarning = document.createElement('div');
    fileWarning.style.cssText = 'background:#fff3cd;border:1px solid #ffc107;border-radius:8px;padding:12px 16px;margin:8px 0;font-size:14px;color:#856404;line-height:1.5;';
    fileWarning.innerHTML = '\u26A0\uFE0F <b>\uC624\uD504\uB77C\uC778 \uBAA8\uB4DC</b>: \uD604\uC7AC \uD30C\uC77C\uC744 \uC9C1\uC811 \uC5F4\uC5B4 \uC0AC\uC6A9 \uC911\uC785\uB2C8\uB2E4. \uC800\uC7A5/\uBD88\uB7EC\uC624\uAE30 \uAE30\uB2A5\uC744 \uC0AC\uC6A9\uD558\uB824\uBA74 \uC6F9 \uC8FC\uC18C(https://)\uB85C \uC811\uC18D\uD574 \uC8FC\uC138\uC694.';
    var studentInfo = document.querySelector('.student-info');
    if (studentInfo) studentInfo.after(fileWarning);
  }

  // ── 캔버스 필기 시스템 ──
  var canvases = [];
  document.querySelectorAll('.writing-area').forEach(function(area) {
    canvases.push(new WritingCanvas(area));
  });
  // 초기화 완료 후 모든 작성란 접기
  document.querySelectorAll('.writing-area').forEach(function(area) {
    area.classList.add('collapsed');
  });

  // 리사이즈 대응
  var resizeTimer;
  window.addEventListener('resize', function() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function() { canvases.forEach(function(c) { c.resize(); }); }, 300);
  });

  // ── 정답 토글 ──
  var allAnswersOpen = false;

  function toggleAnswer(el) {
    el.classList.toggle('open');
    var content = el.nextElementSibling;
    content.classList.toggle('open');
  }

  function toggleAllAnswers() {
    allAnswersOpen = !allAnswersOpen;
    var btn = document.getElementById('globalAnswerBtn');
    btn.classList.toggle('active', allAnswersOpen);
    btn.innerHTML = allAnswersOpen
      ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg> \uC815\uB2F5 \uC804\uCCB4 \uC228\uAE30\uAE30'
      : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg> \uC815\uB2F5 \uC804\uCCB4 \uBCF4\uAE30';
    document.querySelectorAll('.answer-toggle').forEach(function(t) {
      var isOpen = t.classList.contains('open');
      if (allAnswersOpen && !isOpen) { t.classList.add('open'); t.nextElementSibling.classList.add('open'); }
      if (!allAnswersOpen && isOpen) { t.classList.remove('open'); t.nextElementSibling.classList.remove('open'); }
    });
  }

  // ── localStorage 저장/불러오기 시스템 ──
  function getStorageKey() {
    return storageKey;
  }

  function getAllRecords() {
    try {
      var raw = localStorage.getItem(getStorageKey());
      if (!raw) return [];
      var data = JSON.parse(raw);
      return data.records || [];
    } catch (e) {
      console.warn('\uC800\uC7A5 \uB370\uC774\uD130 \uC77D\uAE30 \uC624\uB958:', e);
      return [];
    }
  }

  function saveAllRecords(records) {
    var data = { version: 1, records: records };
    try {
      localStorage.setItem(getStorageKey(), JSON.stringify(data));
      return true;
    } catch (e) {
      if (window.location.protocol === 'file:') {
        alert('\uC624\uD504\uB77C\uC778(file://) \uD658\uACBD\uC5D0\uC11C\uB294 \uC800\uC7A5\uC774 \uBD88\uAC00\uD569\uB2C8\uB2E4.\n\uC6F9 \uC8FC\uC18C(https://)\uB85C \uC811\uC18D\uD558\uBA74 \uC800\uC7A5\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.');
      } else {
        alert('\uC800\uC7A5 \uACF5\uAC04\uC774 \uBD80\uC871\uD569\uB2C8\uB2E4. \uC774\uC804 \uAE30\uB85D\uC744 \uC0AD\uC81C\uD55C \uD6C4 \uB2E4\uC2DC \uC2DC\uB3C4\uD574 \uC8FC\uC138\uC694.');
      }
      return false;
    }
  }

  // ── 캔버스 유틸리티 ──
  function isCanvasBlank(wc) {
    try {
      var px = wc.ctx.getImageData(0, 0, wc.canvas.width, wc.canvas.height).data;
      for (var i = 3; i < px.length; i += 4) {
        if (px[i] !== 0) return false;
      }
      return true;
    } catch (e) {
      return true;
    }
  }

  function canvasToJpeg(wc) {
    var tmp = document.createElement('canvas');
    tmp.width = wc.canvas.width;
    tmp.height = wc.canvas.height;
    var tc = tmp.getContext('2d');
    tc.fillStyle = '#ffffff';
    tc.fillRect(0, 0, tmp.width, tmp.height);
    tc.drawImage(wc.canvas, 0, 0);
    return tmp.toDataURL('image/jpeg', 0.3);
  }

  function captureCurrentState() {
    var canvasData = canvases.map(function(wc) {
      if (isCanvasBlank(wc)) return null;
      return canvasToJpeg(wc);
    });
    return { canvasData: canvasData };
  }

  // ── 저장/불러오기/삭제 ──
  async function saveRecord() {
    var state = captureCurrentState();
    if (!state) return;

    var record = {
      id: String(Date.now()),
      timestamp: new Date().toISOString(),
      canvasData: state.canvasData
    };

    // 1) Firestore primary save
    var saved = await window.saveToFirestore(record);
    if (saved) {
      showToast('\uC800\uC7A5\uB418\uC5C8\uC2B5\uB2C8\uB2E4.');
    } else {
      showToast('\uC800\uC7A5 \uC2E4\uD328. \uB2E4\uC2DC \uC2DC\uB3C4\uD574\uC8FC\uC138\uC694.');
    }

    // 2) localStorage cache (offline fallback)
    try {
      var local = getAllRecords();
      local.push(record);
      if (local.length > 5) {
        local.sort(function(a, b) { return new Date(a.timestamp) - new Date(b.timestamp); });
        local = local.slice(-5);
      }
      saveAllRecords(local);
    } catch (e) { /* ignore */ }
  }

  function loadRecord(recordId, recordsSource) {
    var records = recordsSource || getAllRecords();
    var record = records.find(function(r) { return r.id === recordId; });
    if (!record) {
      alert('\uC800\uC7A5 \uAE30\uB85D\uC744 \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.');
      return;
    }

    // 캔버스 복원
    if (record.canvasData) {
      record.canvasData.forEach(function(dataUrl, idx) {
        if (idx >= canvases.length) return;
        var wc = canvases[idx];
        wc.ctx.save();
        wc.ctx.setTransform(1, 0, 0, 1, 0, 0);
        wc.ctx.clearRect(0, 0, wc.canvas.width, wc.canvas.height);

        if (dataUrl) {
          var img = new Image();
          img.onload = function() {
            wc.ctx.save();
            wc.ctx.setTransform(1, 0, 0, 1, 0, 0);
            wc.ctx.drawImage(img, 0, 0);
            wc.ctx.restore();
            wc.history = [wc.canvas.toDataURL()];
            wc.historyIndex = 0;
          };
          img.src = dataUrl;
        } else {
          wc.history = [wc.canvas.toDataURL()];
          wc.historyIndex = 0;
        }
        wc.ctx.restore();
      });
    }

    closeRecordsPanel();
    showToast('\uBD88\uB7EC\uC654\uC2B5\uB2C8\uB2E4.');
  }

  async function deleteRecord(recordId) {
    await window.deleteFromFirestore(recordId);
    var records = getAllRecords().filter(function(r) { return r.id !== recordId; });
    saveAllRecords(records);
    openRecordsPanel();
  }

  // ── 기록 패널 ──
  function formatTimestamp(isoString) {
    var d = new Date(isoString);
    var month = d.getMonth() + 1;
    var day = d.getDate();
    var hours = String(d.getHours()).padStart(2, '0');
    var minutes = String(d.getMinutes()).padStart(2, '0');
    return month + '/' + day + ' ' + hours + ':' + minutes;
  }

  async function openRecordsPanel() {
    document.getElementById('recordsOverlay').style.display = 'flex';
    var records = await window.loadFromFirestore();
    if (records.length === 0) {
      records = getAllRecords();
    }
    renderRecordsPanel(records);
  }

  function closeRecordsPanel() {
    document.getElementById('recordsOverlay').style.display = 'none';
  }

  function renderRecordsPanel(records) {
    if (!records) records = getAllRecords();
    var listEl = document.getElementById('recordsList');

    if (records.length === 0) {
      listEl.innerHTML = '<div class="records-empty">\uC800\uC7A5\uB41C \uAE30\uB85D\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.</div>';
      return;
    }

    records.sort(function(a, b) { return new Date(b.timestamp) - new Date(a.timestamp); });
    window._lastLoadedRecords = records;

    listEl.innerHTML = records.map(function(r) {
      var dateStr = formatTimestamp(r.timestamp);
      return '<div class="record-item">' +
        '<div class="record-info">' +
          '<div class="record-date">' + dateStr + '</div>' +
        '</div>' +
        '<div class="record-actions">' +
          '<button class="record-btn load" data-record-id="' + r.id + '">\uBD88\uB7EC\uC624\uAE30</button>' +
          '<button class="record-btn delete" data-record-id="' + r.id + '">\uC0AD\uC81C</button>' +
        '</div>' +
      '</div>';
    }).join('');
  }

  // ── Toast ──
  function showToast(message) {
    var toast = document.getElementById('saveToast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'saveToast';
      toast.className = 'save-toast';
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(function() { toast.classList.remove('show'); }, 2000);
  }

  // ── iOS 호환 이벤트 위임 ──
  document.addEventListener('click', function(e) {
    var toggle = e.target.closest('.answer-toggle');
    if (toggle) { e.preventDefault(); toggleAnswer(toggle); }
  });

  var globalAnswerBtn = document.getElementById('globalAnswerBtn');
  if (globalAnswerBtn) {
    globalAnswerBtn.addEventListener('click', function(e) {
      e.preventDefault(); toggleAllAnswers();
    });
  }

  // 저장/불러오기 이벤트 바인딩
  var btnSave = document.getElementById('btnSave');
  if (btnSave) {
    btnSave.addEventListener('click', function(e) { e.preventDefault(); saveRecord(); });
  }
  var btnRecords = document.getElementById('btnRecords');
  if (btnRecords) {
    btnRecords.addEventListener('click', function(e) { e.preventDefault(); openRecordsPanel(); });
  }
  var btnCloseRecords = document.getElementById('btnCloseRecords');
  if (btnCloseRecords) {
    btnCloseRecords.addEventListener('click', function(e) { e.preventDefault(); closeRecordsPanel(); });
  }
  var recordsOverlay = document.getElementById('recordsOverlay');
  if (recordsOverlay) {
    recordsOverlay.addEventListener('click', function(e) {
      if (e.target === recordsOverlay) closeRecordsPanel();
    });
  }
  var recordsList = document.getElementById('recordsList');
  if (recordsList) {
    recordsList.addEventListener('click', function(e) {
      var btn = e.target.closest('.record-btn');
      if (!btn) return;
      var id = btn.dataset.recordId;
      if (btn.classList.contains('load')) {
        loadRecord(id, window._lastLoadedRecords);
      } else if (btn.classList.contains('delete')) {
        if (confirm('\uC774 \uAE30\uB85D\uC744 \uC0AD\uC81C\uD558\uC2DC\uACA0\uC2B5\uB2C8\uAE4C?')) {
          deleteRecord(id);
        }
      }
    });
  }

  // ── KaTeX auto-render ──
  if (typeof renderMathInElement === 'function') {
    renderMathInElement(document.body, {
      delimiters: [
        { left: '\\(', right: '\\)', display: false },
        { left: '\\[', right: '\\]', display: true }
      ],
      throwOnError: false
    });
  }

  // ── 크로스 모듈 인터페이스: 미저장 상태 확인 ──
  window.hasUnsavedChanges = function() {
    return canvases.some(function(wc) { return !isCanvasBlank(wc); });
  };

  // ── Public API (for game-specific extensions) ──
  return {
    canvases: canvases,
    showToast: showToast,
    captureCurrentState: captureCurrentState,
    getAllRecords: getAllRecords,
    saveAllRecords: saveAllRecords
  };
}
