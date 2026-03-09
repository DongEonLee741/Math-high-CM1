// firebase-worksheet.js — Student-side Firebase ES Module
// Auth + Firestore CRUD + FocusLock + Heartbeat
// Usage:
//   import { initFirebaseWorksheet } from '.../firebase-worksheet.js';
//   initFirebaseWorksheet('CM1_2차시_다항식', { showAuth: true });

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc, deleteDoc, getDocs,
         collection, query, orderBy, serverTimestamp, onSnapshot, addDoc }
  from "https://www.gstatic.com/firebasejs/11.4.0/firebase-firestore.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword,
         onAuthStateChanged, signOut, setPersistence,
         browserLocalPersistence, browserSessionPersistence }
  from "https://www.gstatic.com/firebasejs/11.4.0/firebase-auth.js";

const app = initializeApp({
  apiKey: "AIzaSyCnNvdo3ozcv3HC1ilMQX_fiwn_fpB5KCM",
  authDomain: "math-class.it.kr",
  projectId: "math-high-cm1",
  storageBucket: "math-high-cm1.firebasestorage.app",
  messagingSenderId: "1097512338605",
  appId: "1:1097512338605:web:c8572e37781be52e9a7224"
});
const db = getFirestore(app);
const auth = getAuth(app);

let currentUser = null;
let _worksheetKey = '';

// Expose currentUser to other modules (worksheet-app.js etc.)
Object.defineProperty(window, 'currentUser', {
  get() { return currentUser; },
  set(v) { currentUser = v; },
  configurable: true
});

function buildEmail(id) {
  return id.toLowerCase() + '@math-worksheet.school';
}

// ── Firestore CRUD ──
async function saveToFirestore(recordData) {
  if (!currentUser) return false;
  try {
    const ref = doc(db, 'students', currentUser.uid, 'worksheets', _worksheetKey, 'records', recordData.id);
    await setDoc(ref, {
      timestamp: recordData.timestamp,
      canvasData: recordData.canvasData,
      gameState: recordData.gameState || null,
      createdAt: serverTimestamp()
    });
    await enforceRecordLimit(currentUser.uid, _worksheetKey, 5);
    return true;
  } catch (e) {
    console.error('Firestore save error:', e);
    return false;
  }
}

async function loadFromFirestore() {
  if (!currentUser) return [];
  try {
    const ref = collection(db, 'students', currentUser.uid, 'worksheets', _worksheetKey, 'records');
    const q = query(ref, orderBy('timestamp', 'desc'));
    const snap = await getDocs(q);
    const records = [];
    snap.forEach(d => records.push({ id: d.id, ...d.data() }));
    return records;
  } catch (e) {
    console.error('Firestore load error:', e);
    return [];
  }
}

async function deleteFromFirestore(recordId) {
  if (!currentUser) return false;
  try {
    await deleteDoc(doc(db, 'students', currentUser.uid, 'worksheets', _worksheetKey, 'records', recordId));
    return true;
  } catch (e) {
    console.error('Firestore delete error:', e);
    return false;
  }
}

async function enforceRecordLimit(uid, worksheetKey, max) {
  const ref = collection(db, 'students', uid, 'worksheets', worksheetKey, 'records');
  const q = query(ref, orderBy('timestamp', 'asc'));
  const snap = await getDocs(q);
  if (snap.size > max) {
    let toDelete = snap.size - max;
    snap.forEach(d => { if (toDelete-- > 0) deleteDoc(d.ref); });
  }
}

// Expose CRUD to non-module scripts
window.saveToFirestore = saveToFirestore;
window.loadFromFirestore = loadFromFirestore;
window.deleteFromFirestore = deleteFromFirestore;

// ── Presentation (Send to Teacher) ──
function captureCardCanvases(card) {
  const canvases = card.querySelectorAll('.writing-area canvas');
  const images = [];
  canvases.forEach(canvas => {
    const w = canvas.width, h = canvas.height;
    const tmp = document.createElement('canvas');
    tmp.width = w; tmp.height = h;
    const tctx = tmp.getContext('2d');
    tctx.fillStyle = '#fff';
    tctx.fillRect(0, 0, w, h);
    tctx.drawImage(canvas, 0, 0);
    images.push(tmp.toDataURL('image/jpeg', 0.5));
  });
  return images;
}

function captureCardProblemHtml(card) {
  const clone = card.cloneNode(true);
  // Keep only .section-title and .problem elements, remove everything else
  Array.from(clone.children).forEach(el => {
    if (!el.classList.contains('section-title') && !el.classList.contains('problem')) {
      el.remove();
    }
  });
  // Remove writing areas, answer reveals, and buttons inside .problem
  clone.querySelectorAll('.writing-area, .answer-reveal, .btn-present, .btn-save, .btn-records').forEach(el => el.remove());
  return clone.innerHTML;
}

function addPresentationButtons(classId) {
  if (document.body.classList.contains('slide')) return;
  document.querySelectorAll('.card').forEach((card, idx) => {
    if (!card.querySelector('.writing-area')) return;
    if (card.querySelector('.btn-present')) return;
    const btn = document.createElement('button');
    btn.className = 'btn-present';
    btn.textContent = '\uD83D\uDCE4 \uBCF4\uB0B4\uAE30';
    btn.addEventListener('click', () => handlePresent(card, idx, btn, classId));
    card.appendChild(btn);
  });
}

async function handlePresent(card, cardIndex, btn, classId) {
  btn.disabled = true;
  btn.textContent = '\u23F3 \uC804\uC1A1 \uC911...';
  try {
    const canvasImages = captureCardCanvases(card);
    const problemHtml = captureCardProblemHtml(card);
    const h2 = card.querySelector('.section-title h2');
    const blockTitle = h2 ? h2.textContent : ('\uBE14\uB85D ' + (cardIndex + 1));
    await addDoc(collection(db, 'classrooms', classId, 'presentations'), {
      studentName: currentUser ? currentUser.username : 'unknown',
      worksheetKey: _worksheetKey,
      blockIndex: cardIndex,
      blockTitle: blockTitle,
      problemHtml: problemHtml,
      canvasImages: canvasImages,
      status: 'pending',
      createdAt: serverTimestamp()
    });
    btn.textContent = '\u2705 \uC804\uC1A1 \uC644\uB8CC';
    setTimeout(() => {
      btn.textContent = '\uD83D\uDCE4 \uBCF4\uB0B4\uAE30';
      btn.disabled = false;
    }, 3000);
  } catch (e) {
    console.error('Presentation send error:', e);
    btn.textContent = '\uD83D\uDCE4 \uBCF4\uB0B4\uAE30';
    btn.disabled = false;
    alert('\uC804\uC1A1\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4. \uB2E4\uC2DC \uC2DC\uB3C4\uD574\uC8FC\uC138\uC694.');
  }
}

// ── Auth Overlay (dynamic injection) ──
function buildAuthOverlayHTML() {
  const savedAutoLogin = localStorage.getItem('autoLogin') !== 'false';
  const checkedAttr = savedAutoLogin ? 'checked' : '';
  return `<div class="auth-overlay" id="authOverlay">
  <div class="auth-panel">
    <div class="auth-panel-header">
      <h2 class="auth-title">\u{1F4DA} \uD559\uC2B5\uC9C0 \uB85C\uADF8\uC778</h2>
    </div>
    <div class="auth-panel-body">
      <div class="auth-tabs" id="authTabs">
        <button class="auth-tab active" data-tab="login">\uB85C\uADF8\uC778</button>
        <button class="auth-tab" data-tab="register">\uACC4\uC815 \uB9CC\uB4E4\uAE30</button>
      </div>
      <div class="auth-form" id="loginForm">
        <div class="auth-row">
          <label>\uC544\uC774\uB514</label>
          <input type="text" id="loginId" placeholder="\uC544\uC774\uB514" autocomplete="username" autocapitalize="none">
        </div>
        <div class="auth-row">
          <label>\uBE44\uBC00\uBC88\uD638</label>
          <input type="password" id="loginPassword" placeholder="\uBE44\uBC00\uBC88\uD638" autocomplete="current-password">
        </div>
        <div class="auth-row" style="display:flex;align-items:center;gap:6px;margin-bottom:8px;">
          <input type="checkbox" id="autoLoginCheck" ${checkedAttr} style="width:16px;height:16px;accent-color:#2563eb;">
          <label for="autoLoginCheck" style="font-size:13px;color:#64748b;margin:0;cursor:pointer;">\uC790\uB3D9\uC73C\uB85C \uB85C\uADF8\uC778 \uD558\uAE30</label>
        </div>
        <button class="auth-submit" id="btnLogin">\uB85C\uADF8\uC778</button>
        <div class="auth-error" id="loginError"></div>
      </div>
      <div class="auth-form" id="registerForm" style="display:none;">
        <div class="auth-row">
          <label>\uC544\uC774\uB514</label>
          <input type="text" id="regId" placeholder="\uC601\uBB38, \uC22B\uC790 4~20\uC790" autocomplete="username" autocapitalize="none">
        </div>
        <div class="auth-row">
          <label>\uBE44\uBC00\uBC88\uD638</label>
          <input type="password" id="regPassword" placeholder="6\uC790 \uC774\uC0C1" autocomplete="new-password">
        </div>
        <div class="auth-row">
          <label>\uBE44\uBC00\uBC88\uD638 \uD655\uC778</label>
          <input type="password" id="regPasswordConfirm" placeholder="\uBE44\uBC00\uBC88\uD638 \uD655\uC778" autocomplete="new-password">
        </div>
        <button class="auth-submit" id="btnRegister">\uACC4\uC815 \uB9CC\uB4E4\uAE30</button>
        <div class="auth-error" id="registerError"></div>
        <p class="auth-hint">\uC544\uC774\uB514\uC640 \uBE44\uBC00\uBC88\uD638\uB97C \uAF2D \uAE30\uC5B5\uD574\uC8FC\uC138\uC694!</p>
      </div>
      <div class="auth-form" id="passwordOnlyForm" style="display:none;">
        <p class="auth-welcome" id="welcomeBack"></p>
        <div class="auth-row">
          <label>\uBE44\uBC00\uBC88\uD638</label>
          <input type="password" id="quickPassword" placeholder="\uBE44\uBC00\uBC88\uD638" autocomplete="current-password">
        </div>
        <button class="auth-submit" id="btnQuickLogin">\uB85C\uADF8\uC778</button>
        <div class="auth-error" id="quickError"></div>
        <button class="auth-link" id="btnSwitchAccount">\uB2E4\uB978 \uACC4\uC815\uC73C\uB85C \uB85C\uADF8\uC778</button>
      </div>
    </div>
  </div>
</div>`;
}

function injectAuthOverlay() {
  document.body.insertAdjacentHTML('afterbegin', buildAuthOverlayHTML());
}

// ── Auth handlers ──
function showAuthError(formType, msg) {
  const ids = { login: 'loginError', register: 'registerError', quick: 'quickError' };
  const el = document.getElementById(ids[formType]);
  if (el) el.textContent = msg;
}

function onLoginSuccess() {
  document.getElementById('authOverlay').style.display = 'none';
  updateStudentInfoDisplay(currentUser.username);
  window._setupHeartbeat && window._setupHeartbeat();
  window._addPresentationButtons && window._addPresentationButtons();
}

function updateStudentInfoDisplay(username) {
  var fields = document.querySelectorAll('.student-info .field');
  fields.forEach(function(f) { f.style.display = 'none'; });
  var display = document.getElementById('studentDisplay');
  if (display) display.textContent = username;
}

function showAuthModal() {
  const lastId = localStorage.getItem('lastLoginId');
  if (lastId) {
    showPasswordOnlyForm(lastId);
  } else {
    showFullAuthForm();
  }
  document.getElementById('authOverlay').style.display = 'flex';
}

function showFullAuthForm() {
  document.getElementById('authTabs').style.display = 'flex';
  document.getElementById('loginForm').style.display = 'block';
  document.getElementById('registerForm').style.display = 'none';
  document.getElementById('passwordOnlyForm').style.display = 'none';
}

function showPasswordOnlyForm(lastId) {
  document.getElementById('authTabs').style.display = 'none';
  document.getElementById('loginForm').style.display = 'none';
  document.getElementById('registerForm').style.display = 'none';
  document.getElementById('passwordOnlyForm').style.display = 'block';
  document.getElementById('welcomeBack').textContent = lastId + ' \uB2D8, \uB2E4\uC2DC \uC624\uC168\uAD70\uC694';
  document.getElementById('quickPassword').value = '';
}

async function handleRegister() {
  const id = document.getElementById('regId').value.trim().toLowerCase();
  const pw = document.getElementById('regPassword').value;
  const pwConfirm = document.getElementById('regPasswordConfirm').value;

  if (!id) return showAuthError('register', '\uC544\uC774\uB514\uB97C \uC785\uB825\uD574\uC8FC\uC138\uC694.');
  if (!/^[a-z0-9]{4,20}$/.test(id))
    return showAuthError('register', '\uC544\uC774\uB514\uB294 \uC601\uBB38 \uC18C\uBB38\uC790, \uC22B\uC790 4~20\uC790\uC785\uB2C8\uB2E4.');
  if (pw.length < 6)
    return showAuthError('register', '\uBE44\uBC00\uBC88\uD638\uB294 6\uC790 \uC774\uC0C1\uC774\uC5B4\uC57C \uD569\uB2C8\uB2E4.');
  if (pw !== pwConfirm)
    return showAuthError('register', '\uBE44\uBC00\uBC88\uD638\uAC00 \uC77C\uCE58\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.');

  try {
    const email = buildEmail(id);
    const cred = await createUserWithEmailAndPassword(auth, email, pw);
    await setDoc(doc(db, 'students', cred.user.uid), {
      username: id,
      createdAt: serverTimestamp()
    });
    localStorage.setItem('lastLoginId', id);
    currentUser = { uid: cred.user.uid, username: id };
    onLoginSuccess();
  } catch (e) {
    if (e.code === 'auth/email-already-in-use') {
      showAuthError('register', '\uC774\uBBF8 \uC0AC\uC6A9 \uC911\uC778 \uC544\uC774\uB514\uC785\uB2C8\uB2E4.');
    } else {
      showAuthError('register', '\uAC00\uC785 \uC2E4\uD328: ' + e.message);
    }
  }
}

async function handleLogin() {
  const id = document.getElementById('loginId').value.trim().toLowerCase();
  const pw = document.getElementById('loginPassword').value;
  if (!id || !pw) return showAuthError('login', '\uC544\uC774\uB514\uC640 \uBE44\uBC00\uBC88\uD638\uB97C \uC785\uB825\uD574\uC8FC\uC138\uC694.');

  try {
    // Auto-login persistence
    const autoLogin = document.getElementById('autoLoginCheck')?.checked ?? true;
    const persistence = autoLogin ? browserLocalPersistence : browserSessionPersistence;
    await setPersistence(auth, persistence);
    localStorage.setItem('autoLogin', String(autoLogin));

    const email = buildEmail(id);
    const cred = await signInWithEmailAndPassword(auth, email, pw);
    localStorage.setItem('lastLoginId', id);
    currentUser = { uid: cred.user.uid, username: id };
    onLoginSuccess();
  } catch (e) {
    if (e.code === 'auth/user-not-found') {
      showAuthError('login', '\uC874\uC7AC\uD558\uC9C0 \uC54A\uB294 \uC544\uC774\uB514\uC785\uB2C8\uB2E4.');
    } else if (e.code === 'auth/wrong-password' || e.code === 'auth/invalid-credential') {
      showAuthError('login', '\uBE44\uBC00\uBC88\uD638\uAC00 \uD2C0\uB838\uC2B5\uB2C8\uB2E4.');
    } else {
      showAuthError('login', '\uC778\uD130\uB137 \uC5F0\uACB0\uC744 \uD655\uC778\uD574\uC8FC\uC138\uC694.');
    }
  }
}

function bindAuthEvents() {
  // Tab switching
  document.querySelectorAll('.auth-tab').forEach(function(tab) {
    tab.addEventListener('click', function() {
      document.querySelectorAll('.auth-tab').forEach(function(t) { t.classList.remove('active'); });
      this.classList.add('active');
      var target = this.dataset.tab;
      document.getElementById('loginForm').style.display = target === 'login' ? 'block' : 'none';
      document.getElementById('registerForm').style.display = target === 'register' ? 'block' : 'none';
    });
  });

  document.getElementById('btnLogin').addEventListener('click', handleLogin);
  document.getElementById('btnRegister').addEventListener('click', handleRegister);

  // Quick login (password only)
  document.getElementById('btnQuickLogin').addEventListener('click', async function() {
    var lastId = localStorage.getItem('lastLoginId');
    var pw = document.getElementById('quickPassword').value;
    if (!pw) return showAuthError('quick', '\uBE44\uBC00\uBC88\uD638\uB97C \uC785\uB825\uD574\uC8FC\uC138\uC694.');
    try {
      // Apply persistence for quick login too
      const autoLogin = localStorage.getItem('autoLogin') !== 'false';
      const persistence = autoLogin ? browserLocalPersistence : browserSessionPersistence;
      await setPersistence(auth, persistence);

      var email = buildEmail(lastId);
      await signInWithEmailAndPassword(auth, email, pw);
      currentUser = { uid: auth.currentUser.uid, username: lastId };
      onLoginSuccess();
    } catch (e) {
      if (e.code === 'auth/wrong-password' || e.code === 'auth/invalid-credential') {
        showAuthError('quick', '\uBE44\uBC00\uBC88\uD638\uAC00 \uD2C0\uB838\uC2B5\uB2C8\uB2E4.');
      } else {
        showAuthError('quick', '\uC778\uD130\uB137 \uC5F0\uACB0\uC744 \uD655\uC778\uD574\uC8FC\uC138\uC694.');
      }
    }
  });

  document.getElementById('btnSwitchAccount').addEventListener('click', function() {
    localStorage.removeItem('lastLoginId');
    showFullAuthForm();
  });

  // Enter key
  document.getElementById('loginPassword').addEventListener('keydown', function(e) { if (e.key === 'Enter') handleLogin(); });
  document.getElementById('regPasswordConfirm').addEventListener('keydown', function(e) { if (e.key === 'Enter') handleRegister(); });
  document.getElementById('quickPassword').addEventListener('keydown', function(e) {
    if (e.key === 'Enter') document.getElementById('btnQuickLogin').click();
  });
}

// ── Logout button ──
function addLogoutButton() {
  const btn = document.createElement('button');
  btn.id = 'logoutBtn';
  btn.textContent = '\uB85C\uADF8\uC544\uC6C3';
  btn.className = 'logout-btn';
  btn.addEventListener('click', async () => {
    if (typeof window.hasUnsavedChanges === 'function' && window.hasUnsavedChanges()) {
      const ok = confirm('\uC800\uC7A5\uB418\uC9C0 \uC54A\uC740 \uB0B4\uC6A9\uC774 \uC788\uC2B5\uB2C8\uB2E4. \uB85C\uADF8\uC544\uC6C3 \uD558\uC2DC\uACA0\uC2B5\uB2C8\uAE4C?');
      if (!ok) return;
    }
    await signOut(auth);
  });
  document.querySelector('.student-info')?.appendChild(btn);
}

// ── FocusLock (block-level) ──
function setupFocusLock(classId) {
  var classRef = doc(db, 'classrooms', classId);
  var banner = null, locked = false, currentBlockIdx = -1;
  var scrollHandler = null, wheelHandler = null, touchHandler = null;
  var scrollMin = 0, scrollMax = 0;
  var highlightedBlock = null;

  // Content block classes — must match slide generation's blockClasses
  var blockClasses = [
    'concept-box', 'inquiry-box', 'example-box', 'self-practice',
    'problem', 'step-simulation', 'flip-card-single', 'formula-flip-grid',
    'algebra-tiles', 'matching-game', 'tutor-game',
    'concept-game', 'padlock-game', 'tablecloth-svg',
    'sim-activity'
  ];

  function isContentBlock(el) {
    for (var i = 0; i < blockClasses.length; i++) {
      if (el.classList.contains(blockClasses[i])) return true;
    }
    if (el.classList.contains('formula') && el.parentElement &&
        el.parentElement.classList.contains('card')) return true;
    return false;
  }

  // Get all content blocks in DOM order (same order as slide generation)
  function getContentBlocks() {
    var blocks = [];
    document.querySelectorAll('.card').forEach(function(card) {
      Array.from(card.children).forEach(function(child) {
        if (child.classList.contains('section-title')) return;
        if (child.classList.contains('divider') || child.tagName === 'HR') return;
        if (child.classList.contains('tip-box')) return;
        if (isContentBlock(child)) blocks.push(child);
      });
    });
    return blocks;
  }

  function centerOnBlock(block) {
    if (!block) return;
    block.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function calcScrollBounds(block) {
    if (!block) return;
    var rect = block.getBoundingClientRect();
    var blockTop = window.scrollY + rect.top;
    var blockBottom = blockTop + rect.height;
    var vh = window.innerHeight;
    scrollMin = Math.max(0, blockTop - vh * 0.15);
    scrollMax = Math.max(scrollMin, blockBottom - vh * 0.85);
  }

  function clampScroll() {
    var y = window.scrollY;
    if (y < scrollMin) window.scrollTo({ top: scrollMin });
    else if (y > scrollMax) window.scrollTo({ top: scrollMax });
  }

  function showBanner(block, persistent) {
    if (!banner) {
      banner = document.createElement('div');
      banner.style.cssText = 'position:fixed;top:0;left:0;right:0;background:#2563eb;color:#fff;text-align:center;padding:10px 16px;font-size:15px;font-weight:700;z-index:100001;transition:opacity .3s;box-shadow:0 2px 8px rgba(0,0,0,.15);';
      document.body.appendChild(banner);
    }
    var title = '';
    if (block) {
      var card = block.closest('.card');
      if (card) {
        var h2 = card.querySelector('.section-title h2');
        title = h2 ? h2.textContent : '';
      }
    }
    banner.textContent = '📌 집중 모드: ' + title;
    banner.style.opacity = '1';
    if (!persistent) {
      setTimeout(function() { if (banner) banner.style.opacity = '0'; setTimeout(function() { if (banner) { banner.remove(); banner = null; } }, 300); }, 3000);
    }
  }

  function dimForBlock(blockIdx) {
    var blocks = getContentBlocks();
    if (blockIdx < 0 || blockIdx >= blocks.length) return;
    var focusedBlock = blocks[blockIdx];
    var focusedCard = focusedBlock.closest('.card');

    // Dim non-focused cards
    var cards = document.querySelectorAll('.card');
    cards.forEach(function(card) {
      if (card === focusedCard) {
        card.style.opacity = '1';
        card.style.pointerEvents = '';
        card.style.position = 'relative';
        card.style.zIndex = '1';
      } else {
        card.style.opacity = '0.12';
        card.style.pointerEvents = 'none';
        card.style.boxShadow = '';
        card.style.position = '';
        card.style.zIndex = '';
      }
    });

    // Remove previous block highlight
    if (highlightedBlock && highlightedBlock !== focusedBlock) {
      highlightedBlock.style.boxShadow = '';
      highlightedBlock.style.outline = '';
    }

    // Highlight the focused block
    focusedBlock.style.boxShadow = '0 0 0 3px #2563eb';
    focusedBlock.style.outline = '2px solid #2563eb';
    highlightedBlock = focusedBlock;
  }

  function restoreAll() {
    var cards = document.querySelectorAll('.card');
    cards.forEach(function(card) {
      card.style.opacity = '';
      card.style.pointerEvents = '';
      card.style.boxShadow = '';
      card.style.position = '';
      card.style.zIndex = '';
    });
    if (highlightedBlock) {
      highlightedBlock.style.boxShadow = '';
      highlightedBlock.style.outline = '';
      highlightedBlock = null;
    }
  }

  function lockUI(blockIdx) {
    var blocks = getContentBlocks();
    if (blocks.length === 0) return;

    // Bounds check
    if (blockIdx < 0) blockIdx = 0;
    if (blockIdx >= blocks.length) blockIdx = blocks.length - 1;

    if (locked && currentBlockIdx === blockIdx) return;

    var targetBlock = blocks[blockIdx];

    if (locked) {
      // Already locked, update to new block
      currentBlockIdx = blockIdx;
      dimForBlock(blockIdx);
      centerOnBlock(targetBlock);
      showBanner(targetBlock, true);
      setTimeout(function() { calcScrollBounds(targetBlock); }, 900);
      return;
    }

    locked = true;
    currentBlockIdx = blockIdx;
    dimForBlock(blockIdx);
    centerOnBlock(targetBlock);
    showBanner(targetBlock, true);

    setTimeout(function() { calcScrollBounds(targetBlock); }, 900);

    // Wheel: allow canvas, clamp scroll at block bounds
    wheelHandler = function(e) {
      if (e.target.tagName === 'CANVAS') return;
      var nextY = window.scrollY + (e.deltaY > 0 ? 60 : -60);
      if (nextY < scrollMin || nextY > scrollMax) {
        e.preventDefault();
      }
    };
    window.addEventListener('wheel', wheelHandler, { passive: false });

    // Touch: allow canvas touch, clamp page scroll
    var touchStartY = 0;
    touchHandler = function(e) {
      if (e.target.tagName === 'CANVAS') return;
      if (e.type === 'touchstart') {
        touchStartY = e.touches[0].clientY;
        return;
      }
      var dy = touchStartY - e.touches[0].clientY;
      var nextY = window.scrollY + dy;
      if (nextY < scrollMin || nextY > scrollMax) {
        e.preventDefault();
      }
    };
    window.addEventListener('touchstart', touchHandler, { passive: true });
    window.addEventListener('touchmove', touchHandler, { passive: false });

    // Safety net: periodic scroll clamp
    scrollHandler = setInterval(function() {
      if (!locked) return;
      clampScroll();
    }, 500);
  }

  function unlockUI() {
    if (!locked) return;
    locked = false;
    currentBlockIdx = -1;
    restoreAll();
    if (banner) { banner.remove(); banner = null; }
    if (wheelHandler) window.removeEventListener('wheel', wheelHandler);
    if (touchHandler) {
      window.removeEventListener('touchstart', touchHandler);
      window.removeEventListener('touchmove', touchHandler);
    }
    if (scrollHandler) clearInterval(scrollHandler);
    wheelHandler = null;
    touchHandler = null;
    scrollHandler = null;
  }

  onSnapshot(classRef, function(snap) {
    var data = snap.data();
    if (!data) return;
    if (data.focusActive) {
      lockUI(data.focusSection || 0);
    } else {
      unlockUI();
    }
  });
}
// ── Heartbeat ──
function setupHeartbeat(classId) {
  var studentName = currentUser ? currentUser.username : 'unknown';
  var visitorId = sessionStorage.getItem('visitorId');
  if (!visitorId) {
    visitorId = Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
    sessionStorage.setItem('visitorId', visitorId);
  }
  var currentSection = 0, currentSectionName = '';
  var cards = document.querySelectorAll('.card');
  if ('IntersectionObserver' in window && cards.length > 0) {
    var visibleSections = {};
    var obs = new IntersectionObserver(function(entries) {
      entries.forEach(function(e) {
        var i = Array.prototype.indexOf.call(cards, e.target);
        if (e.isIntersecting) visibleSections[i] = e.intersectionRatio;
        else delete visibleSections[i];
      });
      var bestIdx = -1, bestR = 0;
      for (var k in visibleSections) {
        if (visibleSections[k] > bestR) { bestR = visibleSections[k]; bestIdx = parseInt(k); }
      }
      if (bestIdx >= 0) {
        currentSection = bestIdx;
        var h2 = cards[bestIdx].querySelector('.section-title h2');
        currentSectionName = h2 ? h2.textContent : ('\uC139\uC158 ' + (bestIdx + 1));
      }
    }, { threshold: [0, 0.25, 0.5, 0.75, 1] });
    cards.forEach(function(c) { obs.observe(c); });
  }
  var studentDocRef = doc(db, 'classrooms', classId, 'students', visitorId);
  function sendHeartbeat() {
    setDoc(studentDocRef, {
      name: studentName,
      section: currentSection,
      sectionName: currentSectionName,
      lastSeen: serverTimestamp()
    }, { merge: true }).catch(function(e) { console.warn('Heartbeat error:', e); });
  }
  sendHeartbeat();
  setInterval(sendHeartbeat, 10000);
  window.addEventListener('beforeunload', function() {
    try { deleteDoc(studentDocRef); } catch(e) {}
  });
}

// ── Main entry point ──
export function initFirebaseWorksheet(worksheetKey, options = {}) {
  _worksheetKey = worksheetKey;
  const showAuth = options.showAuth !== false;

  const urlParams = new URLSearchParams(window.location.search);
  const classId = urlParams.get('class') || 'default';

  // Set default persistence
  setPersistence(auth, browserLocalPersistence);

  if (showAuth) {
    // Inject Auth Overlay into DOM
    injectAuthOverlay();
    bindAuthEvents();

    // Auth observer
    onAuthStateChanged(auth, async (user) => {
      if (user) {
        let snap = await getDoc(doc(db, 'students', user.uid));
        if (!snap.exists()) {
          // Auto-create students doc for users logged in via portal
          const username = user.email ? user.email.split('@')[0] : 'unknown';
          await setDoc(doc(db, 'students', user.uid), {
            username,
            createdAt: serverTimestamp()
          }, { merge: true });
          snap = await getDoc(doc(db, 'students', user.uid));
        }
        currentUser = { uid: user.uid, username: snap.data().username };
        onLoginSuccess();
        addLogoutButton();
      } else {
        currentUser = null;
        showAuthModal();
      }
    });

    // Heartbeat setup after login (deferred)
    window._setupHeartbeat = function() {
      setupHeartbeat(classId);
    };

    // Presentation buttons after login (deferred)
    window._addPresentationButtons = function() {
      addPresentationButtons(classId);
    };
  } else {
    // No Auth — directly start heartbeat with anonymous visitor
    setupHeartbeat(classId);
  }

  // FocusLock always active
  setupFocusLock(classId);
}
