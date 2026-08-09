/**
 * KAI Manager - Karate Academy India CRM
 * Production Application Controller & Admin Control Panel Engine
 */

let appState = {
  activeTab: 'dashboard',
  activeAdminSec: 'branding', // 'branding' | 'users' | 'fees'
  activeStudentDetailTab: 'profile', // 'profile' | 'fees' | 'idcard' | 'attendance'
  currentDetailStudentId: null,
  currentUser: null,
  userRole: 'viewer', // 'admin' | 'manager' | 'receptionist' | 'viewer'
  config: {
    appTitle: 'KAI Manager',
    appSubtitle: 'Karate Academy India',
    appVersion: 'v1.0',
    logoUrl: 'https://www.karateacademyindia.com/logo.png',
    faviconUrl: 'https://www.karateacademyindia.com/logo.png',
    defaultUsername: 'admin',
    regFee: 1000,
    monthlyFee: 2500,
    quarterlyFee: 7000,
    halfYearlyFee: 13000,
    uniformFee: 2500,
    invoicePrefix: 'INV-',
    receiptHeader: 'KARATE ACADEMY INDIA',
    receiptFooter: 'Thank you for training with Karate Academy India! For queries contact +917040925257.',
    contactPhone: '+917040925257',
    contactEmail: 'support@conzex.com'
  },
  users: [],
  students: [],
  classes: [],
  financials: [],
  attendance: [],
  activityLogs: [],
  isAuthenticated: false
};

const syncChannel = 'BroadcastChannel' in window ? new BroadcastChannel('kai_manager_sync') : null;
let cameraStream = null;
let animFrameId = null;
let currentPhotoBase64 = '';
let searchDebounceTimer = null;
let currentLogFilter = 'all';

const DEFAULT_AVATAR = 'https://images.unsplash.com/photo-1555597673-b21d5c935865?w=100&auto=format&fit=crop&q=80';
const DEFAULT_LOGO = 'https://www.karateacademyindia.com/logo.png';

document.addEventListener('DOMContentLoaded', async () => {
  setupBrowserHistoryNavigation();
  setupSyncChannel();
  setupNavigation();
  setupAuthHandlers();
  setupAdminProfileDropdown();
  setupResetPasswordModal();
  setupUserProfileModal();
  setupManagerSecurityModal();
  setupStudentDetailsModal();
  setupActivityLogsModal();
  setupLightboxSystem();
  setupGlobalPopupDismissal();
  setupGlobalSearchDropdown();
  setupLogoRefreshHandler();
  setupKioskScanner();
  setupPhotoUploader();
  setupFormsAndCalculators();
  setupAdminSettingsForms();
  setupPaymentStudentSearch();
  setupInactivityWatchdog();
  setupAdmissionsHandlers();
  setupCsvImportExportHandlers();
  setupDirectorySearchAndFilters();
  setupAttendanceTrackerEvents();
  setupSendEmailModalEvents();
  setupHolidayNoticeFormHandler();
  setupStaffInvoiceFormHandler();

  // Restore session AFTER all UI handlers are wired up
  await checkAuth();
  if (appState.isAuthenticated) {
    await loadDatabase();
    await renderAllViews();
    if (appState.userRole === 'admin' || appState.userRole === 'manager') {
      loadPendingAdmissions();
    }
  }
});

// ==========================================
// CENTRALIZED SYSTEM ACTIVITY LOGGING ENGINE
// ==========================================
function logActivity(title, subtitle, type = 'system') {
  const logEntry = {
    id: Date.now(),
    title,
    subtitle: subtitle || `${appState.currentUser ? appState.currentUser.username : 'system'} • ${new Date().toLocaleTimeString()}`,
    timestamp: new Date().toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' }),
    type // 'enrollment' | 'attendance' | 'payment' | 'idcard' | 'user' | 'system'
  };

  appState.activityLogs.unshift(logEntry);
  if (appState.activityLogs.length > 200) {
    appState.activityLogs = appState.activityLogs.slice(0, 200);
  }

  updateHeaderLogsBadge();
}

function updateHeaderLogsBadge() {
  const count = appState.activityLogs.length;
  const badge = document.getElementById('header-logs-badge');
  const mobBadge = document.getElementById('mobile-logs-count-badge');
  if (badge) badge.textContent = count;
  if (mobBadge) mobBadge.textContent = count;
}

// ==========================================
// SYSTEM ACTIVITY LOGS MODAL CONTROLLER (STABLE DIMENSIONS)
// ==========================================
function setupActivityLogsModal() {
  const closeBtn = document.getElementById('close-logs-modal');
  const btnClose = document.getElementById('btn-close-logs-modal');
  const modal = document.getElementById('activity-logs-modal');

  const closeModal = () => modal?.classList.add('hidden');
  closeBtn?.addEventListener('click', closeModal);
  btnClose?.addEventListener('click', closeModal);

  // Filter Buttons
  const filterBtns = document.querySelectorAll('.log-filter-btn');
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      currentLogFilter = btn.getAttribute('data-log-filter') || 'all';

      filterBtns.forEach(b => {
        b.className = 'log-filter-btn px-3 py-1.5 rounded-lg bg-white text-slate-600 hover:bg-slate-200 transition';
      });
      btn.className = 'log-filter-btn px-3 py-1.5 rounded-lg bg-slate-900 text-white font-bold transition';

      renderActivityLogsList();
    });
  });
}

function openActivityLogsModal() {
  if (appState.userRole !== 'admin' && appState.userRole !== 'manager') {
    showLightbox({ title: 'Access Restricted', message: 'System Activity Logs are restricted to Manager and Admin roles only.', type: 'warning' });
    return;
  }
  const modal = document.getElementById('activity-logs-modal');
  if (!modal) return;
  renderActivityLogsList();
  modal.classList.remove('hidden');
}

function renderActivityLogsList() {
  const container = document.getElementById('logs-modal-container');
  if (!container) return;

  let filtered = appState.activityLogs;
  if (currentLogFilter !== 'all') {
    filtered = filtered.filter(l => l.type === currentLogFilter);
  }

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="h-full flex flex-col items-center justify-center text-center text-slate-400 space-y-2 py-12">
        <span class="material-symbols-outlined text-4xl text-slate-300">notifications_off</span>
        <div class="font-bold text-slate-600">No activity logs recorded</div>
        <p class="text-[11px]">System operations will appear here automatically.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map(log => {
    let icon = 'notifications';
    let iconBg = 'bg-slate-100 text-slate-700';

    switch (log.type) {
      case 'enrollment':
        icon = 'person_add'; iconBg = 'bg-red-100 text-red-600'; break;
      case 'attendance':
        icon = 'fact_check'; iconBg = 'bg-emerald-100 text-emerald-700'; break;
      case 'payment':
        icon = 'payments'; iconBg = 'bg-emerald-100 text-emerald-800'; break;
      case 'idcard':
        icon = 'badge'; iconBg = 'bg-blue-100 text-blue-700'; break;
      case 'user':
        icon = 'manage_accounts'; iconBg = 'bg-amber-100 text-amber-800'; break;
      case 'system':
        icon = 'tune'; iconBg = 'bg-slate-200 text-slate-800'; break;
    }

    return `
      <div class="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-start gap-3 transition hover:bg-slate-100/80">
        <div class="w-9 h-9 rounded-xl ${iconBg} flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
          <span class="material-symbols-outlined text-lg">${icon}</span>
        </div>
        <div class="overflow-hidden flex-1 space-y-0.5">
          <div class="font-extrabold text-xs text-slate-900 flex items-center justify-between">
            <span class="truncate pr-2">${log.title}</span>
            <span class="text-[10px] text-slate-400 font-mono font-normal shrink-0">${log.timestamp}</span>
          </div>
          <div class="text-[11px] text-slate-600 font-medium">${log.subtitle}</div>
        </div>
      </div>
    `;
  }).join('');
}

// ==========================================
// BROWSER BACK BUTTON NAVIGATION PROTECTION
// ==========================================
function setupBrowserHistoryNavigation() {
  const hash = (window.location.hash || '').replace(/^#/, '');
  if (hash && hash !== 'login') {
    appState.activeTab = hash;
  }

  if (window.history && window.history.replaceState) {
    window.history.replaceState({ tab: appState.activeTab, sec: appState.activeAdminSec }, '', '#' + appState.activeTab);
  }

  window.addEventListener('popstate', (event) => {
    const visibleModal = getVisibleModal();
    if (visibleModal) {
      visibleModal.classList.add('hidden');
      if (lightboxCallback && typeof lightboxCallback === 'function') {
        lightboxCallback(false);
        lightboxCallback = null;
      }
      return;
    }

    if (event.state && event.state.tab) {
      if (event.state.tab === 'admin-settings' && event.state.sec) {
        switchAdminSection(event.state.sec, false);
      } else {
        switchTab(event.state.tab, false);
      }
    } else {
      const currentHash = (window.location.hash || '').replace(/^#/, '');
      if (currentHash && currentHash !== 'login') {
        switchTab(currentHash, false);
      } else {
        switchTab('dashboard', false);
      }
    }
  });
}

function getVisibleModal() {
  const modals = [
    document.getElementById('activity-logs-modal'),
    document.getElementById('global-search-results-dropdown'),
    document.getElementById('mobile-search-dropdown'),
    document.getElementById('reset-password-modal'),
    document.getElementById('student-details-modal'),
    document.getElementById('kai-lightbox-modal'),
    document.getElementById('payment-receipt-modal'),
    document.getElementById('record-payment-modal'),
    document.getElementById('add-student-modal'),
    document.getElementById('user-profile-modal'),
    document.getElementById('manager-verify-modal'),
    document.getElementById('admin-profile-dropdown')
  ];
  return modals.find(m => m && !m.classList.contains('hidden')) || null;
}

// ==========================================
// UNIVERSAL POPUP DISMISSAL ENGINE
// ==========================================
function setupGlobalPopupDismissal() {
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeTopmostModal();
    }
  });

  document.addEventListener('click', (e) => {
    const backdrop = e.target.closest('.modal-backdrop-container');
    if (backdrop && e.target === backdrop && backdrop.getAttribute('data-dismissible') === 'true') {
      backdrop.classList.add('hidden');
    }

    const deskDropdown = document.getElementById('global-search-results-dropdown');
    const mobDropdown = document.getElementById('mobile-search-dropdown');
    const deskInput = document.getElementById('global-search-input');
    const mobInput = document.getElementById('mobile-search-input');

    if (deskDropdown && !deskDropdown.contains(e.target) && deskInput && !deskInput.contains(e.target)) {
      deskDropdown.classList.add('hidden');
    }
    if (mobDropdown && !mobDropdown.contains(e.target) && mobInput && !mobInput.contains(e.target)) {
      mobDropdown.classList.add('hidden');
    }
  });
}

function closeTopmostModal() {
  const topModal = getVisibleModal();
  if (topModal) {
    topModal.classList.add('hidden');
    if (lightboxCallback && typeof lightboxCallback === 'function') {
      lightboxCallback(false);
      lightboxCallback = null;
    }
  }
}

// ==========================================
// STANDARD OPEN SOURCE FREE QR CODE GENERATOR
// ==========================================
function generateFallbackQRCodeCanvasDataURL(text) {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 160;
    canvas.height = 160;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, 160, 160);

    ctx.fillStyle = '#000000';
    ctx.fillRect(10, 10, 140, 140);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(16, 16, 128, 128);

    function drawFinder(x, y) {
      ctx.fillStyle = '#000000'; ctx.fillRect(x, y, 32, 32);
      ctx.fillStyle = '#FFFFFF'; ctx.fillRect(x + 5, y + 5, 22, 22);
      ctx.fillStyle = '#000000'; ctx.fillRect(x + 10, y + 10, 12, 12);
    }
    drawFinder(24, 24);
    drawFinder(104, 24);
    drawFinder(24, 104);

    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      hash = ((hash << 5) - hash) + text.charCodeAt(i);
      hash |= 0;
    }

    ctx.fillStyle = '#000000';
    const gridSize = 12;
    const cellSize = 6;
    for (let r = 0; r < gridSize; r++) {
      for (let c = 0; c < gridSize; c++) {
        const val = Math.abs(Math.sin(hash * (r * gridSize + c + 1))) * 100;
        if (val > 45) {
          ctx.fillRect(40 + c * cellSize, 65 + r * cellSize, cellSize - 1, cellSize - 1);
        }
      }
    }

    ctx.fillStyle = '#d90429';
    ctx.font = 'bold 9px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(text, 80, 148);

    return canvas.toDataURL('image/png');
  } catch (err) {
    console.error('Fallback QR Generation Error:', err);
    return null;
  }
}

async function generateStudentQRCodeBase64(studentId) {
  if (!studentId) return null;
  const strId = String(studentId).trim();

  const openQrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(strId)}`;

  if (typeof QRCode !== 'undefined' && QRCode.toDataURL) {
    try {
      const url = await QRCode.toDataURL(strId, {
        width: 160,
        margin: 1,
        color: { dark: '#000000', light: '#ffffff' }
      });
      if (url && url.length > 50) return url;
    } catch (e) {
      console.warn(`QRCode.toDataURL error for ${strId}:`, e);
    }
  }

  return openQrApiUrl || generateFallbackQRCodeCanvasDataURL(strId);
}

// ==========================================
// GLOBAL SEARCH & LIVE SUGGESTIONS ENGINE
// ==========================================
function clearGlobalSearch() {
  const deskInput = document.getElementById('global-search-input');
  const mobInput = document.getElementById('mobile-search-input');
  const deskDropdown = document.getElementById('global-search-results-dropdown');
  const mobDropdown = document.getElementById('mobile-search-dropdown');
  const deskClear = document.getElementById('global-search-clear-btn');
  const mobClear = document.getElementById('mobile-search-clear-btn');

  if (deskInput) deskInput.value = '';
  if (mobInput) mobInput.value = '';
  if (deskDropdown) {
    deskDropdown.classList.add('hidden');
    deskDropdown.innerHTML = '';
  }
  if (mobDropdown) {
    mobDropdown.classList.add('hidden');
    mobDropdown.innerHTML = '';
  }
  if (deskClear) deskClear.classList.add('hidden');
  if (mobClear) mobClear.classList.add('hidden');
}

function setupGlobalSearchDropdown() {
  const deskInput = document.getElementById('global-search-input');
  const mobInput = document.getElementById('mobile-search-input');
  const deskDropdown = document.getElementById('global-search-results-dropdown');
  const mobDropdown = document.getElementById('mobile-search-dropdown');
  const deskClear = document.getElementById('global-search-clear-btn');
  const mobClear = document.getElementById('mobile-search-clear-btn');

  const handleInput = (inputEl, dropdownEl, clearBtn) => {
    if (!inputEl || !dropdownEl) return;
    const query = inputEl.value.trim();

    if (clearBtn) {
      if (query.length > 0) clearBtn.classList.remove('hidden');
      else clearBtn.classList.add('hidden');
    }

    if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
    if (!query || query.length < 1) {
      dropdownEl.classList.add('hidden');
      dropdownEl.innerHTML = '';
      return;
    }

    searchDebounceTimer = setTimeout(() => {
      renderSearchSuggestions(query, dropdownEl);
    }, 150);
  };

  deskInput?.addEventListener('input', () => handleInput(deskInput, deskDropdown, deskClear));
  mobInput?.addEventListener('input', () => handleInput(mobInput, mobDropdown, mobClear));

  deskClear?.addEventListener('click', (e) => {
    e.stopPropagation();
    clearGlobalSearch();
    deskInput?.focus();
  });

  mobClear?.addEventListener('click', (e) => {
    e.stopPropagation();
    clearGlobalSearch();
    mobInput?.focus();
  });

  deskInput?.addEventListener('focus', () => {
    if (deskInput.value.trim().length >= 1 && deskDropdown) {
      renderSearchSuggestions(deskInput.value.trim(), deskDropdown);
    }
  });

  mobInput?.addEventListener('focus', () => {
    if (mobInput.value.trim().length >= 1 && mobDropdown) {
      renderSearchSuggestions(mobInput.value.trim(), mobDropdown);
    }
  });

  // Global Shortcut ⌘K / Ctrl+K to focus search
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      deskInput?.focus();
      deskInput?.select();
    }
  });

  // Dismiss on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      clearGlobalSearch();
    }
  });

  // Dismiss on click outside
  document.addEventListener('click', (e) => {
    if (deskInput && !deskInput.contains(e.target) && deskDropdown && !deskDropdown.contains(e.target)) {
      deskDropdown.classList.add('hidden');
    }
    if (mobInput && !mobInput.contains(e.target) && mobDropdown && !mobDropdown.contains(e.target)) {
      mobDropdown.classList.add('hidden');
    }
  });
}

function highlightMatchText(text, query) {
  if (!text) return '';
  const str = String(text);
  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  return str.replace(regex, '<mark class="bg-amber-100 text-red-600 font-bold px-0.5 rounded">$1</mark>');
}

function renderSearchSuggestions(query, dropdownEl) {
  const q = query.toLowerCase();

  const studentMatches = appState.students.filter(s =>
    s.name?.toLowerCase().includes(q) ||
    s.studentId?.toLowerCase().includes(q) ||
    s.phone?.toLowerCase().includes(q) ||
    s.contactPhone?.toLowerCase().includes(q) ||
    s.email?.toLowerCase().includes(q) ||
    s.contactEmail?.toLowerCase().includes(q) ||
    s.belt?.toLowerCase().includes(q)
  );

  const invoiceMatches = appState.financials.filter(f =>
    f.id?.toLowerCase().includes(q) ||
    f.studentName?.toLowerCase().includes(q) ||
    f.studentId?.toLowerCase().includes(q) ||
    f.paymentMethod?.toLowerCase().includes(q)
  );

  const userMatches = appState.users.filter(u =>
    u.name?.toLowerCase().includes(q) ||
    u.username?.toLowerCase().includes(q) ||
    u.email?.toLowerCase().includes(q) ||
    u.role?.toLowerCase().includes(q)
  );

  const totalCount = studentMatches.length + invoiceMatches.length + userMatches.length;

  if (totalCount === 0) {
    dropdownEl.innerHTML = `
      <div class="p-4 text-center text-slate-500 font-medium space-y-1">
        <span class="material-symbols-outlined text-2xl text-slate-300">search_off</span>
        <div class="font-bold text-slate-700">No matching records found</div>
        <div class="text-[11px] text-slate-400">No results found for "${query}"</div>
      </div>
    `;
    dropdownEl.classList.remove('hidden');
    return;
  }

  let html = '';

  if (studentMatches.length > 0) {
    html += `
      <div class="px-3 pb-1 border-b border-slate-100">
        <div class="text-[10px] font-bold text-red-600 uppercase tracking-wider mb-1 px-1 flex items-center gap-1">
          <span class="material-symbols-outlined text-xs">groups</span>
          <span>Students (${studentMatches.length})</span>
        </div>
        <div class="space-y-0.5">
          ${studentMatches.slice(0, 5).map(s => `
            <div onclick="selectSearchStudent('${s.id}')" class="p-2 hover:bg-slate-50 rounded-xl cursor-pointer transition flex items-center gap-3">
              <img class="w-8 h-8 rounded-full object-cover border border-slate-200" src="${s.avatar || DEFAULT_AVATAR}" alt="${s.name}"/>
              <div class="overflow-hidden flex-1">
                <div class="font-bold text-slate-900 flex items-center gap-1.5">
                  <span>${highlightMatchText(s.name, query)}</span>
                  <span class="belt-badge ${getBeltClass(s.belt)} text-[9px] py-0 px-1 font-normal">${s.belt}</span>
                </div>
                <div class="text-[10px] text-slate-500 font-mono">
                  ${highlightMatchText(s.studentId, query)} • Phone: ${highlightMatchText(s.phone || s.contactPhone || 'N/A', query)}
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  if (invoiceMatches.length > 0 && appState.userRole !== 'receptionist') {
    html += `
      <div class="px-3 pb-1 border-b border-slate-100 pt-1">
        <div class="text-[10px] font-bold text-emerald-600 uppercase tracking-wider mb-1 px-1 flex items-center gap-1">
          <span class="material-symbols-outlined text-xs">receipt_long</span>
          <span>Invoices & Payments (${invoiceMatches.length})</span>
        </div>
        <div class="space-y-0.5">
          ${invoiceMatches.slice(0, 4).map(f => `
            <div onclick="selectSearchInvoice('${f.id}')" class="p-2 hover:bg-slate-50 rounded-xl cursor-pointer transition flex items-center justify-between">
              <div>
                <div class="font-bold text-slate-900 flex items-center gap-2">
                  <span class="font-mono text-red-600">${highlightMatchText(f.id, query)}</span>
                  <span>${highlightMatchText(f.studentName, query)}</span>
                </div>
                <div class="text-[10px] text-slate-500">${highlightMatchText(f.paymentMethod, query)} • Date: ${f.dueDate || 'Today'}</div>
              </div>
              <div class="text-right">
                <span class="font-extrabold text-emerald-700 text-xs">₹${(f.finalPaid || f.amount || 0).toLocaleString('en-IN')}</span>
                <div class="status-badge status-paid text-[9px] py-0 px-1">Paid</div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  if (userMatches.length > 0 && appState.userRole !== 'receptionist') {
    html += `
      <div class="px-3 pt-1">
        <div class="text-[10px] font-bold text-blue-600 uppercase tracking-wider mb-1 px-1 flex items-center gap-1">
          <span class="material-symbols-outlined text-xs">manage_accounts</span>
          <span>Staff Accounts (${userMatches.length})</span>
        </div>
        <div class="space-y-0.5">
          ${userMatches.slice(0, 3).map(u => `
            <div onclick="selectSearchUser('${u.username}')" class="p-2 hover:bg-slate-50 rounded-xl cursor-pointer transition flex items-center justify-between">
              <div>
                <div class="font-bold text-slate-900">${highlightMatchText(u.name, query)}</div>
                <div class="text-[10px] text-slate-500 font-mono">@${highlightMatchText(u.username, query)} • ${highlightMatchText(u.email, query)}</div>
              </div>
              <span class="role-badge role-${u.role}">${u.role.toUpperCase()}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  dropdownEl.innerHTML = html;
  dropdownEl.classList.remove('hidden');
}

function selectSearchStudent(studentIdStr) {
  clearGlobalSearch();
  openStudentDetailsModal(studentIdStr);
}

function selectSearchInvoice(invoiceId) {
  if (appState.userRole === 'receptionist') return;
  clearGlobalSearch();
  switchTab('financials');
  openReceiptModal(invoiceId);
}

function selectSearchUser(username) {
  if (appState.userRole === 'receptionist') return;
  clearGlobalSearch();

  if (appState.userRole === 'admin') {
    switchAdminSection('users');
  } else if (appState.userRole === 'manager') {
    handleManagerUserManagementClick();
  }
}

// ==========================================
// LOGO REFRESH HANDLER
// ==========================================
function setupLogoRefreshHandler() {
  const logoContainer = document.getElementById('sidebar-logo-container');
  logoContainer?.addEventListener('click', async () => {
    await loadDatabase();
    await renderAllViews();
    showToast('Portal data synchronized and refreshed');
  });
}

function clearSessionStore() {
  const token = localStorage.getItem('kai_token') || sessionStorage.getItem('kai_token');
  if (token) {
    fetch('/api/logout', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    }).catch(() => { });
  }

  localStorage.clear();
  sessionStorage.clear();

  // Clear all cookies
  try {
    const cookies = document.cookie.split(";");
    for (let i = 0; i < cookies.length; i++) {
      const cookie = cookies[i];
      const eqPos = cookie.indexOf("=");
      const name = eqPos > -1 ? cookie.substr(0, eqPos) : cookie;
      document.cookie = name.trim() + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/";
    }
  } catch (e) { }

  // Complete memory state wipe
  appState.currentUser = null;
  appState.userRole = 'viewer';
  appState.isAuthenticated = false;
  appState.students = [];
  appState.financials = [];
  appState.attendance = [];
  appState.classes = [];
  appState.users = [];
  appState.activityLogs = [];
  appState.activeTab = 'dashboard';

  // Complete DOM tab activation purge
  document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
  document.querySelectorAll('.admin-tab-area').forEach(sec => sec.classList.add('hidden'));

  // Reset login form inputs & errors
  const userIn = document.getElementById('login-username');
  const passIn = document.getElementById('login-password');
  const loginErr = document.getElementById('login-error');
  if (userIn) userIn.value = '';
  if (passIn) passIn.value = '';
  if (loginErr) loginErr.classList.add('hidden');
}

// ==========================================
// FIXED: AUTH CHECK WITH BETTER SESSION RESTORATION
// ==========================================
function checkAuth() {
  const token = localStorage.getItem('kai_token') || sessionStorage.getItem('kai_token');
  const storedUser = localStorage.getItem('kai_user') || sessionStorage.getItem('kai_user');

  if (token && storedUser) {
    try {
      const user = JSON.parse(storedUser);
      appState.currentUser = user;
      appState.userRole = (user.role || 'viewer').toLowerCase();
      appState.isAuthenticated = true;

      // Ensure session is stored in both storage types for consistency
      localStorage.setItem('kai_session', 'authenticated_' + Date.now());
      localStorage.setItem('kai_token', token);
      localStorage.setItem('kai_user', JSON.stringify(user));
      sessionStorage.setItem('kai_session', 'authenticated_' + Date.now());
      sessionStorage.setItem('kai_token', token);
      sessionStorage.setItem('kai_user', JSON.stringify(user));

      // Show app, hide login
      const viewLogin = document.getElementById('view-login');
      const appWrapper = document.getElementById('app-wrapper');
      if (viewLogin) viewLogin.classList.add('hidden');
      if (appWrapper) appWrapper.classList.remove('hidden');

      updateHeaderUserInfo();
      applyRolePermissions();

      const currentHash = window.location.hash ? window.location.hash.replace('#', '') : '';
      if (!currentHash || currentHash === 'login') {
        if (appState.userRole === 'admin') {
          switchAdminSection('branding', false);
        } else {
          switchTab('dashboard', false);
        }
      } else if (currentHash === 'admin-settings') {
        switchAdminSection(appState.activeAdminSec || 'branding', false);
      } else {
        switchTab(currentHash, false);
      }
      return true;
    } catch (e) {
      console.error('Session restoration error:', e);
    }
  }

  appState.isAuthenticated = false;
  appState.currentUser = null;
  appState.userRole = 'viewer';
  document.getElementById('view-login')?.classList.remove('hidden');
  document.getElementById('app-wrapper')?.classList.add('hidden');
  return false;
}

function triggerLogout(isInactivity = false) {
  if (inactivityTimer) clearTimeout(inactivityTimer);
  clearSessionStore();

  if (window.history && window.history.pushState) {
    window.history.pushState(null, '', '#login');
  }

  const inactAlert = document.getElementById('inactivity-logout-alert');
  if (inactAlert) {
    if (isInactivity) inactAlert.classList.remove('hidden');
    else inactAlert.classList.add('hidden');
  }

  document.getElementById('view-login')?.classList.remove('hidden');
  document.getElementById('app-wrapper')?.classList.add('hidden');

  const dropdown = document.getElementById('admin-profile-dropdown');
  if (dropdown) dropdown.classList.add('hidden');

  // Close any open modals
  document.querySelectorAll('.modal-backdrop-container').forEach(m => m.classList.add('hidden'));

  if (isInactivity) {
    showToast('Automatic logout: 10 minutes of inactivity');
  } else {
    showToast('Signed out of portal.');
  }
}

function updateHeaderUserInfo() {
  if (!appState.currentUser) return;
  const user = appState.currentUser;

  const headerName = document.getElementById('header-user-display');
  if (headerName) headerName.textContent = user.username || user.name || 'user';

  const roleBadge = document.getElementById('header-role-badge');
  if (roleBadge) {
    roleBadge.textContent = user.role.toUpperCase();
    roleBadge.className = `role-badge role-${user.role}`;
  }

  const dropdownName = document.getElementById('dropdown-user-name');
  if (dropdownName) dropdownName.textContent = user.name || user.username;

  const dropdownEmail = document.getElementById('dropdown-user-email');
  if (dropdownEmail) dropdownEmail.textContent = user.email || 'support@conzex.com';

  const dropdownBadge = document.getElementById('dropdown-user-role-badge');
  if (dropdownBadge) {
    dropdownBadge.textContent = user.role.toUpperCase();
    dropdownBadge.className = `role-badge role-${user.role}`;
  }
}

function applyRolePermissions() {
  const role = appState.userRole; // 'admin' | 'manager' | 'receptionist' | 'viewer'
  const adminSecNav = document.getElementById('administrative-sidebar-section');
  const operationalSecNav = document.getElementById('operational-sidebar-nav');
  const bottomMgrBox = document.getElementById('bottom-manager-users-box');
  const financialsLink = document.getElementById('nav-financials-link');
  const idcardsLink = document.getElementById('nav-idcards-link');

  // Dashboard Stats Cards
  const totalStudentsCard = document.getElementById('stat-total-students-card');
  const attendanceCard = document.getElementById('stat-attendance-card');
  const newAdmissionsCard = document.getElementById('stat-new-admissions-card');
  const pendingAdmissionsCard = document.getElementById('stat-pending-admissions-card');
  const revenueCard = document.getElementById('stat-revenue-card');
  const duesCard = document.getElementById('stat-dues-card');
  const beltCard = document.getElementById('stat-belt-card');

  // Action Buttons
  const addStudentBtns = document.querySelectorAll('.open-add-student-modal');
  const recordPayBtns = document.querySelectorAll('.open-record-payment-modal');
  const logsBtns = [document.getElementById('header-logs-btn'), document.getElementById('mobile-logs-btn')];
  const admissionsBtns = [document.getElementById('header-admissions-btn'), document.getElementById('mobile-admissions-btn')];
  const sendEmailBtns = [document.getElementById('header-send-email-btn'), document.getElementById('mobile-send-email-btn')];

  if (role === 'admin') {
    // Admin sees System Administration + Logs + Admissions + Send Email
    adminSecNav?.classList.remove('hidden');
    operationalSecNav?.classList.add('hidden');
    bottomMgrBox?.classList.add('hidden');
    financialsLink?.classList.remove('hidden');
    idcardsLink?.classList.remove('hidden');

    // Admin sees all cards
    totalStudentsCard?.classList.remove('hidden');
    attendanceCard?.classList.remove('hidden');
    newAdmissionsCard?.classList.remove('hidden');
    pendingAdmissionsCard?.classList.remove('hidden');
    revenueCard?.classList.remove('hidden');
    duesCard?.classList.remove('hidden');
    beltCard?.classList.remove('hidden');

    addStudentBtns.forEach(btn => btn.classList.remove('hidden'));
    recordPayBtns.forEach(btn => btn.classList.remove('hidden'));
    logsBtns.forEach(btn => btn?.classList.remove('hidden'));
    admissionsBtns.forEach(btn => btn?.classList.remove('hidden'));
    sendEmailBtns.forEach(btn => btn?.classList.remove('hidden'));
  } else if (role === 'manager') {
    // Manager: Operational Console + Staff User Management + Logs + Send Email
    // Per requirements: Remove cards: New Admissions, Pending Admissions, Belt Candidates
    adminSecNav?.classList.add('hidden');
    operationalSecNav?.classList.remove('hidden');
    bottomMgrBox?.classList.remove('hidden');
    financialsLink?.classList.remove('hidden');
    idcardsLink?.classList.remove('hidden');

    totalStudentsCard?.classList.remove('hidden');
    attendanceCard?.classList.remove('hidden');
    newAdmissionsCard?.classList.add('hidden'); // HIDDEN for Manager
    pendingAdmissionsCard?.classList.add('hidden'); // HIDDEN for Manager
    revenueCard?.classList.remove('hidden');
    duesCard?.classList.remove('hidden');
    beltCard?.classList.add('hidden'); // HIDDEN for Manager

    addStudentBtns.forEach(btn => btn.classList.remove('hidden'));
    recordPayBtns.forEach(btn => btn.classList.remove('hidden'));
    logsBtns.forEach(btn => btn?.classList.remove('hidden'));
    admissionsBtns.forEach(btn => btn?.classList.remove('hidden'));
    sendEmailBtns.forEach(btn => btn?.classList.remove('hidden'));
  } else if (role === 'receptionist') {
    // Receptionist: Operational Console + Send Email
    // Per requirements: Remove cards: Total Students, New Admissions, Belt Candidates (and financial cards)
    adminSecNav?.classList.add('hidden');
    operationalSecNav?.classList.remove('hidden');
    bottomMgrBox?.classList.add('hidden');
    financialsLink?.classList.add('hidden');
    idcardsLink?.classList.add('hidden');

    totalStudentsCard?.classList.add('hidden'); // HIDDEN for Receptionist
    attendanceCard?.classList.remove('hidden'); // Visible
    newAdmissionsCard?.classList.add('hidden'); // HIDDEN for Receptionist
    pendingAdmissionsCard?.classList.add('hidden'); // HIDDEN for Receptionist
    revenueCard?.classList.add('hidden'); // HIDDEN for Receptionist
    duesCard?.classList.add('hidden'); // HIDDEN for Receptionist
    beltCard?.classList.add('hidden'); // HIDDEN for Receptionist

    addStudentBtns.forEach(btn => btn.classList.add('hidden'));
    recordPayBtns.forEach(btn => btn.classList.add('hidden'));
    logsBtns.forEach(btn => btn?.classList.add('hidden'));
    admissionsBtns.forEach(btn => btn?.classList.add('hidden'));
    sendEmailBtns.forEach(btn => btn?.classList.remove('hidden')); // Send Email visible for Receptionist
  } else {
    // Viewer: Read-only
    adminSecNav?.classList.add('hidden');
    operationalSecNav?.classList.remove('hidden');
    bottomMgrBox?.classList.add('hidden');
    financialsLink?.classList.remove('hidden');
    idcardsLink?.classList.remove('hidden');

    totalStudentsCard?.classList.remove('hidden');
    attendanceCard?.classList.remove('hidden');
    newAdmissionsCard?.classList.add('hidden');
    pendingAdmissionsCard?.classList.add('hidden');
    revenueCard?.classList.add('hidden');
    duesCard?.classList.add('hidden');
    beltCard?.classList.remove('hidden');

    addStudentBtns.forEach(btn => btn.classList.add('hidden'));
    recordPayBtns.forEach(btn => btn.classList.add('hidden'));
    logsBtns.forEach(btn => btn?.classList.add('hidden'));
    admissionsBtns.forEach(btn => btn?.classList.add('hidden'));
    sendEmailBtns.forEach(btn => btn?.classList.add('hidden'));
  }

  const isViewer = (role === 'viewer');
  document.querySelectorAll('.action-btn-write').forEach(el => {
    if (isViewer) el.classList.add('hidden');
    else el.classList.remove('hidden');
  });

  const adminRoleOpt = document.getElementById('usr-role-admin-option');
  if (adminRoleOpt) {
    if (role === 'manager' || role === 'receptionist') adminRoleOpt.classList.add('hidden');
    else adminRoleOpt.classList.remove('hidden');
  }
}

// ==========================================
// FIXED: LOGIN FORM HANDLER
// ==========================================
function setupAuthHandlers() {
  const loginForm = document.getElementById('login-form');
  const loginErr = document.getElementById('login-error');

  loginForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const userVal = document.getElementById('login-username').value.trim();
    const passVal = document.getElementById('login-password').value.trim();

    // Clear previous error
    if (loginErr) {
      loginErr.classList.add('hidden');
    }

    try {
      console.log('Attempting login for:', userVal);

      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: userVal, password: passVal })
      });

      const data = await res.json();
      console.log('Login response:', data);

      if (res.ok && data.success && data.token && data.user) {
        // Store session tokens
        localStorage.setItem('kai_session', 'authenticated_' + Date.now());
        localStorage.setItem('kai_token', data.token);
        localStorage.setItem('kai_user', JSON.stringify(data.user));

        sessionStorage.setItem('kai_session', 'authenticated_' + Date.now());
        sessionStorage.setItem('kai_token', data.token);
        sessionStorage.setItem('kai_user', JSON.stringify(data.user));
        sessionStorage.removeItem('kai_manager_verified');

        appState.currentUser = data.user;
        appState.userRole = (data.user.role || 'viewer').toLowerCase();
        appState.isAuthenticated = true;

        loginErr?.classList.add('hidden');
        document.getElementById('view-login')?.classList.add('hidden');
        document.getElementById('app-wrapper')?.classList.remove('hidden');

        updateHeaderUserInfo();
        applyRolePermissions();

        logActivity(`User Logged In: ${data.user.username}`, `Role: ${data.user.role.toUpperCase()}`, 'system');

        await loadDatabase();

        // Route to appropriate view
        const currentHash = (window.location.hash || '').replace(/^#/, '');
        if (!currentHash || currentHash === 'login') {
          if (appState.userRole === 'admin') {
            switchAdminSection('branding', true);
          } else {
            switchTab('dashboard', true);
            if (appState.userRole === 'manager') {
              loadPendingAdmissions();
            }
          }
        } else if (currentHash === 'admin-settings') {
          switchAdminSection(appState.activeAdminSec || 'branding', true);
        } else {
          switchTab(currentHash, true);
        }

        await renderAllViews();
        showToast(`Signed in as ${data.user.username} (${data.user.role.toUpperCase()})`);
      } else {
        if (loginErr) {
          loginErr.textContent = data.error || 'Invalid username or password.';
          loginErr.classList.remove('hidden');
        }
      }
    } catch (err) {
      console.error('Login error:', err);
      if (loginErr) {
        loginErr.textContent = err.message || 'Login failed due to connection error. Please check your internet connection.';
        loginErr.classList.remove('hidden');
      }
    }
  });
}

function setupAdminProfileDropdown() {
  const profileBtn = document.getElementById('admin-profile-btn');
  const mobileProfileBtn = document.getElementById('mobile-profile-btn');
  const dropdown = document.getElementById('admin-profile-dropdown');

  function toggleDropdown(e) {
    e.stopPropagation();
    dropdown?.classList.toggle('hidden');
  }

  profileBtn?.addEventListener('click', toggleDropdown);
  mobileProfileBtn?.addEventListener('click', () => openUserProfileModal());

  document.addEventListener('click', (e) => {
    if (dropdown && !dropdown.contains(e.target) && profileBtn && !profileBtn.contains(e.target)) {
      dropdown.classList.add('hidden');
    }
  });

  document.getElementById('menu-view-profile')?.addEventListener('click', (e) => {
    e.preventDefault();
    dropdown?.classList.add('hidden');
    openUserProfileModal();
  });

  document.getElementById('menu-reset-password')?.addEventListener('click', (e) => {
    e.preventDefault();
    dropdown?.classList.add('hidden');
    openResetPasswordModal();
  });

  document.getElementById('menu-logout')?.addEventListener('click', (e) => {
    e.preventDefault();
    dropdown?.classList.add('hidden');
    triggerLogout();
  });
}

// ==========================================
// RESET PASSWORD MODAL CONTROLLER
// ==========================================
function setupResetPasswordModal() {
  const modal = document.getElementById('reset-password-modal');
  const closeBtn = document.getElementById('close-reset-pass-modal');
  const cancelBtn = document.getElementById('btn-cancel-reset-pass');
  const form = document.getElementById('reset-password-form');

  closeBtn?.addEventListener('click', () => modal?.classList.add('hidden'));
  cancelBtn?.addEventListener('click', () => modal?.classList.add('hidden'));

  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!appState.currentUser) return;

    const oldPass = document.getElementById('reset-old-pass').value.trim();
    const newPass = document.getElementById('reset-new-pass').value.trim();
    const confirmPass = document.getElementById('reset-confirm-pass').value.trim();

    if (newPass !== confirmPass) {
      showLightbox({ title: 'Password Mismatch', message: 'New password and confirmation do not match.', type: 'warning' });
      return;
    }

    if (newPass.length < 4) {
      showLightbox({ title: 'Weak Password', message: 'New password must be at least 4 characters long.', type: 'warning' });
      return;
    }

    appState.currentUser.password = newPass;
    sessionStorage.setItem('kai_user', JSON.stringify(appState.currentUser));

    const userRecord = appState.users.find(u => u.username === appState.currentUser.username);
    if (userRecord) {
      userRecord.password = newPass;
      saveDatabase();
    }

    logActivity(`Password Reset: ${appState.currentUser.username}`, 'User updated account password', 'user');

    modal?.classList.add('hidden');
    form.reset();
    showLightbox({ title: 'Password Updated', message: 'Account password has been reset successfully!', type: 'success' });
  });
}

function openResetPasswordModal() {
  const modal = document.getElementById('reset-password-modal');
  if (!modal) return;
  document.getElementById('reset-password-form')?.reset();
  modal.classList.remove('hidden');
}

// ==========================================
// MANAGER SECURITY VERIFICATION
// ==========================================
function setupManagerSecurityModal() {
  const modal = document.getElementById('manager-verify-modal');
  const closeBtn = document.getElementById('close-mgr-verify-modal');
  const cancelBtn = document.getElementById('btn-cancel-mgr-verify');
  const form = document.getElementById('mgr-verify-form');
  const errDiv = document.getElementById('mgr-verify-error');

  closeBtn?.addEventListener('click', () => modal?.classList.add('hidden'));
  cancelBtn?.addEventListener('click', () => modal?.classList.add('hidden'));

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const passInput = document.getElementById('mgr-verify-password').value.trim();

    if (!appState.currentUser) return;

    let verified = false;
    if (appState.currentUser.password && appState.currentUser.password === passInput) {
      verified = true;
    } else {
      try {
        const res = await fetch('/api/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: appState.currentUser.username, password: passInput })
        });
        const data = await res.json();
        if (res.ok && data.success) verified = true;
      } catch (err) { }
    }

    if (verified) {
      sessionStorage.setItem('kai_manager_verified', 'true');
      errDiv?.classList.add('hidden');
      modal?.classList.add('hidden');
      document.getElementById('mgr-verify-password').value = '';
      switchTab('manager-users');
      showToast('Manager identity verified successfully');
    } else {
      errDiv?.classList.remove('hidden');
    }
  });
}

function handleManagerUserManagementClick() {
  if (appState.userRole === 'receptionist') {
    showLightbox({ title: 'Access Restricted', message: 'Staff User Management is accessible by Manager and Admin accounts only.', type: 'warning' });
    return;
  }
  if (appState.userRole === 'manager') {
    const isVerified = sessionStorage.getItem('kai_manager_verified') === 'true';
    if (!isVerified) {
      document.getElementById('mgr-verify-error')?.classList.add('hidden');
      document.getElementById('mgr-verify-password').value = '';
      document.getElementById('manager-verify-modal')?.classList.remove('hidden');
      return;
    }
  }
  switchTab('manager-users');
}

// ==========================================
// ENTERPRISE LIGHTBOX FEEDBACK SYSTEM
// ==========================================
let lightboxCallback = null;

function setupLightboxSystem() {
  const modal = document.getElementById('kai-lightbox-modal');
  const confirmBtn = document.getElementById('lb-btn-confirm');
  const cancelBtn = document.getElementById('lb-btn-cancel');

  confirmBtn?.addEventListener('click', () => {
    modal?.classList.add('hidden');
    if (lightboxCallback && typeof lightboxCallback === 'function') {
      lightboxCallback(true);
      lightboxCallback = null;
    }
  });

  cancelBtn?.addEventListener('click', () => {
    modal?.classList.add('hidden');
    if (lightboxCallback && typeof lightboxCallback === 'function') {
      lightboxCallback(false);
      lightboxCallback = null;
    }
  });
}

function showLightbox(opts = {}) {
  const {
    title = 'System Message',
    message = '',
    type = 'info',
    confirmText = 'OK',
    cancelText = 'Cancel',
    onResult = null
  } = opts;

  lightboxCallback = onResult;

  const modal = document.getElementById('kai-lightbox-modal');
  const titleEl = document.getElementById('lb-title');
  const msgEl = document.getElementById('lb-message');
  const iconEl = document.getElementById('lb-icon');
  const iconBox = document.getElementById('lb-icon-box');
  const confirmBtn = document.getElementById('lb-btn-confirm');
  const cancelBtn = document.getElementById('lb-btn-cancel');

  if (!modal || !titleEl || !msgEl) return;

  titleEl.textContent = title;
  msgEl.textContent = message;
  confirmBtn.textContent = confirmText;
  cancelBtn.textContent = cancelText;

  if (type === 'confirm' || typeof onResult === 'function') {
    cancelBtn.classList.remove('hidden');
  } else {
    cancelBtn.classList.add('hidden');
  }

  switch (type) {
    case 'warning':
      iconEl.textContent = 'warning';
      iconBox.className = 'w-12 h-12 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center shrink-0';
      confirmBtn.className = 'px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl shadow transition font-bold text-xs';
      break;
    case 'success':
      iconEl.textContent = 'check_circle';
      iconBox.className = 'w-12 h-12 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0';
      confirmBtn.className = 'px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow transition font-bold text-xs';
      break;
    case 'error':
      iconEl.textContent = 'error';
      iconBox.className = 'w-12 h-12 rounded-xl bg-red-100 text-red-600 flex items-center justify-center shrink-0';
      confirmBtn.className = 'px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl shadow transition font-bold text-xs';
      break;
    case 'confirm':
      iconEl.textContent = 'help';
      iconBox.className = 'w-12 h-12 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center shrink-0';
      confirmBtn.className = 'px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl shadow transition font-bold text-xs';
      break;
    default:
      iconEl.textContent = 'info';
      iconBox.className = 'w-12 h-12 rounded-xl bg-red-100 text-red-600 flex items-center justify-center shrink-0';
      confirmBtn.className = 'px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl shadow transition font-bold text-xs';
      break;
  }

  modal.classList.remove('hidden');
}

// ==========================================
// USER PROFILE MODAL CONTROLLER
// ==========================================
function setupUserProfileModal() {
  const modal = document.getElementById('user-profile-modal');
  const closeBtn = document.getElementById('close-user-profile-modal');
  const cancelBtn = document.getElementById('btn-cancel-profile');
  const form = document.getElementById('user-profile-form');

  closeBtn?.addEventListener('click', () => modal?.classList.add('hidden'));
  cancelBtn?.addEventListener('click', () => modal?.classList.add('hidden'));

  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!appState.currentUser) return;

    const newName = document.getElementById('prof-input-name').value.trim();
    const newEmail = document.getElementById('prof-input-email').value.trim();

    appState.currentUser.name = newName;
    appState.currentUser.email = newEmail;
    sessionStorage.setItem('kai_user', JSON.stringify(appState.currentUser));

    const userRecord = appState.users.find(u => u.username === appState.currentUser.username);
    if (userRecord) {
      userRecord.name = newName;
      userRecord.email = newEmail;
      saveDatabase();
    }

    logActivity(`Profile Updated: ${appState.currentUser.username}`, `Name: ${newName}`, 'user');

    updateHeaderUserInfo();
    modal?.classList.add('hidden');
    showLightbox({ title: 'Profile Updated', message: 'User profile updated successfully!', type: 'success' });
  });
}

function openUserProfileModal() {
  const user = appState.currentUser;
  if (!user) return;

  const modal = document.getElementById('user-profile-modal');
  if (!modal) return;

  document.getElementById('prof-display-name').textContent = user.name || user.username;
  document.getElementById('prof-display-username').textContent = `@${user.username}`;

  const roleBadge = document.getElementById('prof-role-badge');
  if (roleBadge) {
    roleBadge.textContent = user.role.toUpperCase();
    roleBadge.className = `role-badge role-${user.role}`;
  }

  document.getElementById('prof-input-name').value = user.name || user.username;
  document.getElementById('prof-input-email').value = user.email || 'support@conzex.com';
  document.getElementById('prof-input-username').value = user.username;

  modal.classList.remove('hidden');
}

// ==========================================
// REALTIME DATABASE MANAGEMENT
// ==========================================
async function loadDatabase() {
  const token = localStorage.getItem('kai_token') || sessionStorage.getItem('kai_token');
  if (!token) return;

  try {
    const res = await fetch('/api/db', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.ok) {
      const data = await res.json();
      localStorage.setItem('kai_db_cache', JSON.stringify(data));
      applyLoadedData(data);
      return;
    } else if (res.status === 401) {
      // Check cached database before forcing logout
      const cached = localStorage.getItem('kai_db_cache');
      if (cached) {
        try {
          applyLoadedData(JSON.parse(cached));
          return;
        } catch (e) { }
      }
      clearSessionStore();
      checkAuth();
      return;
    }
  } catch (e) {
    console.warn('Network error loading DB, attempting cached fallback:', e.message);
  }

  const cached = localStorage.getItem('kai_db_cache');
  if (cached) {
    try {
      applyLoadedData(JSON.parse(cached));
    } catch (e) { }
  }
}

function applyLoadedData(data) {
  if (data.config) appState.config = { ...appState.config, ...data.config };
  appState.users = data.users || [];
  appState.students = data.students || [];
  appState.classes = data.classes || [];
  appState.financials = data.financials || [];
  appState.attendance = data.attendance || [];
  appState.activityLogs = data.activityLogs || [];

  updateDynamicBrandingUI();
  updateHeaderLogsBadge();
  renderAdminUsersTable();
}

async function saveDatabase() {
  if (appState.userRole === 'viewer') {
    showLightbox({ title: 'Permission Denied', message: 'Viewer role is read-only.', type: 'error' });
    return;
  }

  localStorage.setItem('kai_db_cache', JSON.stringify({
    config: appState.config,
    users: appState.users,
    students: appState.students,
    classes: appState.classes,
    financials: appState.financials,
    attendance: appState.attendance,
    activityLogs: appState.activityLogs
  }));

  if (syncChannel) {
    syncChannel.postMessage({ type: 'KAI_DB_UPDATE', payload: appState });
  }

  const token = localStorage.getItem('kai_token') || sessionStorage.getItem('kai_token');
  if (!token) return;

  try {
    await fetch('/api/db', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        config: appState.config,
        users: appState.users,
        students: appState.students,
        classes: appState.classes,
        financials: appState.financials,
        attendance: appState.attendance,
        activityLogs: appState.activityLogs
      })
    });
  } catch (e) { }
}

function setupSyncChannel() {
  if (!syncChannel) return;
  syncChannel.onmessage = async (event) => {
    if (event.data && event.data.type === 'KAI_DB_UPDATE') {
      applyLoadedData(event.data.payload);
      await renderAllViews();
    }
  };
}

// ==========================================
// DYNAMIC BRANDING & CONFIG RENDERER
// ==========================================
function updateDynamicBrandingUI() {
  const cfg = appState.config;
  const title = cfg.appTitle || 'KAI Manager';
  const subtitle = cfg.appSubtitle || 'Karate Academy India';
  const version = cfg.appVersion || 'v1.0';
  const logo = cfg.logoUrl || DEFAULT_LOGO;

  document.title = `${title} - ${subtitle}`;
  const fav = document.getElementById('html-favicon');
  if (fav) fav.href = cfg.faviconUrl || logo;

  document.querySelectorAll('#nav-app-title, #dash-title, #login-app-title').forEach(el => el.textContent = title);
  document.querySelectorAll('#nav-app-subtitle, #dash-subtitle, #login-app-subtitle').forEach(el => el.textContent = subtitle);
  document.querySelectorAll('#app-version-badge, #login-app-version').forEach(el => el.textContent = version);

  document.querySelectorAll('#nav-logo, #login-logo').forEach(el => el.src = logo);

  const tEl = document.getElementById('cfg-app-title'); if (tEl) tEl.value = title;
  const sEl = document.getElementById('cfg-app-subtitle'); if (sEl) sEl.value = subtitle;
  const vEl = document.getElementById('cfg-app-version'); if (vEl) vEl.value = version;
  const lEl = document.getElementById('cfg-logo-url'); if (lEl) lEl.value = logo;

  const rfEl = document.getElementById('cfg-reg-fee'); if (rfEl) rfEl.value = cfg.regFee || 1000;
  const mfEl = document.getElementById('cfg-monthly-fee'); if (mfEl) mfEl.value = cfg.monthlyFee || 2500;
  const qfEl = document.getElementById('cfg-quarterly-fee'); if (qfEl) qfEl.value = cfg.quarterlyFee || 7000;
  const hfEl = document.getElementById('cfg-halfyearly-fee'); if (hfEl) hfEl.value = cfg.halfYearlyFee || 13000;
}

// ==========================================
// NAVIGATION & UI ROUTING
// ==========================================
function setupNavigation() {
  const navLinks = document.querySelectorAll('[data-tab]');
  navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const targetTab = link.getAttribute('data-tab');
      const adminSec = link.getAttribute('data-admin-sec');

      if (targetTab === 'admin-settings' && appState.userRole !== 'admin') {
        showLightbox({ title: 'Access Restricted', message: 'Admin Control Panel is accessible by Root Admin only.', type: 'warning' });
        return;
      }

      if (targetTab === 'financials' && appState.userRole === 'receptionist') {
        showLightbox({ title: 'Access Restricted', message: 'Financial Ledger is restricted to Manager and Admin roles.', type: 'warning' });
        return;
      }

      if (targetTab === 'idcards' && appState.userRole === 'receptionist') {
        showLightbox({ title: 'Access Restricted', message: 'Student ID Cards module is not accessible by the Receptionist role.', type: 'warning' });
        return;
      }

      if (targetTab === 'manager-users' && (appState.userRole === 'manager' || appState.userRole === 'receptionist')) {
        handleManagerUserManagementClick();
        return;
      }

      if (adminSec && targetTab === 'admin-settings') {
        switchAdminSection(adminSec, true);
      } else {
        switchTab(targetTab, true);
      }
    });
  });

}

function updateSidebarNavHighlight(tabId, adminSec) {
  // Operational Console
  const opLinks = document.querySelectorAll('#operational-sidebar-nav [data-tab]');
  opLinks.forEach(link => {
    const isTarget = link.getAttribute('data-tab') === tabId;
    link.className = isTarget
      ? 'sidebar-nav-item sidebar-nav-active flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-xs transition'
      : 'sidebar-nav-item sidebar-nav-inactive flex items-center gap-3 px-4 py-3 rounded-xl font-semibold text-xs transition';
  });

  // Manager Users Link (Distinctive Staff User Management Styling)
  const mgrLinks = document.querySelectorAll('#bottom-manager-users-box [data-tab]');
  mgrLinks.forEach(link => {
    const isTarget = tabId === 'manager-users';
    link.className = isTarget
      ? 'sidebar-nav-item sidebar-nav-staff-active flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-xs transition'
      : 'sidebar-nav-item sidebar-nav-staff-inactive flex items-center gap-3 px-4 py-3 rounded-xl font-semibold text-xs transition';
  });

  // Root Admin System Administration Subsections
  const adminLinks = document.querySelectorAll('#administrative-sidebar-section [data-admin-sec]');
  adminLinks.forEach(link => {
    const isTarget = (tabId === 'admin-settings' && link.getAttribute('data-admin-sec') === adminSec);
    link.className = isTarget
      ? 'sidebar-nav-item sidebar-nav-active flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-xs transition'
      : 'sidebar-nav-item sidebar-nav-inactive flex items-center gap-3 px-4 py-3 rounded-xl font-semibold text-xs transition';
  });

  // Mobile Bottom Nav Highlight
  const mobLinks = document.querySelectorAll('nav.lg\\:hidden [data-mob-tab]');
  mobLinks.forEach(link => {
    const isTarget = link.getAttribute('data-mob-tab') === tabId;
    link.className = isTarget
      ? 'flex flex-col items-center gap-1 p-2 rounded-xl text-red-600 font-extrabold'
      : 'flex flex-col items-center gap-1 p-2 rounded-xl text-slate-500 font-medium hover:text-slate-900';
  });
}

function switchTab(tabId, pushHistory = true) {
  if (tabId !== 'kiosk') stopCamera();

  appState.activeTab = tabId;

  if (pushHistory && window.history && window.history.pushState) {
    window.history.pushState({ tab: tabId, sec: appState.activeAdminSec }, '', '#' + tabId);
  }

  const contents = document.querySelectorAll('.tab-content');
  contents.forEach(content => {
    if (content.id === `view-${tabId}`) {
      content.classList.add('active');
    } else {
      content.classList.remove('active');
    }
  });

  updateSidebarNavHighlight(tabId, appState.activeAdminSec);

  window.scrollTo({ top: 0, behavior: 'smooth' });
  renderAllViews();

  if (tabId === 'kiosk') {
    setTimeout(() => {
      startAutoKioskCamera();
    }, 150);
  }
}

function switchAdminSection(secName, pushHistory = true) {
  appState.activeAdminSec = secName;
  switchTab('admin-settings', pushHistory);

  document.querySelectorAll('.admin-tab-area').forEach(el => el.classList.add('hidden'));
  const targetArea = document.getElementById(`admin-sec-${secName}`);
  if (targetArea) {
    targetArea.classList.remove('hidden');
  }

  const titleMap = {
    branding: 'Branding & Application Configuration',
    users: 'RBAC Staff Management',
    students: 'RBAC Student Management (Root Roster)',
    fees: 'Tuition Fees Management',
    smtp: 'SMTP Email Configuration & Dispatch Manager',
    emails: 'Email Delivery Logs, Queue & History Console',
    logs: 'System Activity & Audit Logs Manager'
  };

  const titleEl = document.getElementById('admin-section-title');
  if (titleEl) titleEl.textContent = titleMap[secName] || 'Admin Control Panel';

  updateSidebarNavHighlight('admin-settings', secName);

  try {
    if (secName === 'users') renderAdminUsersTable();
    if (secName === 'students') renderAdminStudentsTable();
    if (secName === 'logs') renderAdminLogsTable();
    if (secName === 'smtp') loadSmtpConfigForm();
    if (secName === 'emails') loadAdminEmailLogs();
  } catch (err) {
    console.error('Error rendering admin section:', secName, err);
  }
}

// ==========================================
// MASTER VIEW RENDERERS (FAIL-SAFE ERROR BOUNDARIES)
// ==========================================
async function renderAllViews() {
  try { updateDynamicBrandingUI(); } catch (e) { console.error('Branding UI error:', e); }
  try { updateHeaderLogsBadge(); } catch (e) { console.error('Logs badge error:', e); }
  try { applyRolePermissions(); } catch (e) { console.error('Permissions error:', e); }
  try { renderDashboard(); } catch (e) { console.error('Dashboard error:', e); }
  try { renderAttendance(); } catch (e) { console.error('Attendance error:', e); }
  try { renderKioskLogs(); } catch (e) { console.error('Kiosk error:', e); }
  try { renderDirectory(); } catch (e) { console.error('Directory error:', e); }
  try { await renderIDCards(); } catch (e) { console.error('ID Cards error:', e); }
  try { renderFinancials(); } catch (e) { console.error('Financials error:', e); }
  try { renderAdminUsersTable(); } catch (e) { console.error('Users table error:', e); }
  try { renderAdminStudentsTable(); } catch (e) { console.error('Admin students error:', e); }
  try { renderAdminLogsTable(); } catch (e) { console.error('Admin logs error:', e); }
  try { if (appState.activeAdminSec === 'emails') loadAdminEmailLogs(); } catch (e) { }
}

// 1. Executive Dashboard
function renderDashboard() {
  const activeStudents = appState.students.filter(s => s.accountStatus !== 'inactive');
  const totalStudents = activeStudents.length;

  const totalEl = document.getElementById('stat-total-students');
  if (totalEl) totalEl.textContent = totalStudents;

  const topStatus = document.getElementById('top-status-enrolled');
  if (topStatus) topStatus.textContent = `Active (${totalStudents} Enrolled)`;

  const present = activeStudents.filter(s => s.status === 'present').length;
  const excused = activeStudents.filter(s => s.status === 'excused').length;
  const absent = activeStudents.filter(s => s.status === 'absent' || !s.status).length;
  const rate = totalStudents > 0 ? Math.round((present / totalStudents) * 100) : 0;

  const rateEl = document.getElementById('stat-attendance-rate');
  if (rateEl) rateEl.textContent = `${rate}%`;

  const countsEl = document.getElementById('stat-attendance-counts');
  if (countsEl) countsEl.textContent = `${present} Present • ${absent} Absent`;

  const presEl = document.getElementById('stat-present-count');
  if (presEl) presEl.textContent = `${present} Present`;

  const absEl = document.getElementById('stat-absent-count');
  if (absEl) absEl.textContent = `${absent} Absent`;

  // New Admissions This Month
  const currentMonthPrefix = new Date().toISOString().slice(0, 7);
  const newAdmissionsCount = appState.students.filter(s => s.joinDate && s.joinDate.startsWith(currentMonthPrefix)).length;
  const newAdmEl = document.getElementById('stat-new-admissions');
  if (newAdmEl) newAdmEl.textContent = newAdmissionsCount;

  // Pending Online Admissions
  const pendingCount = (appState.pendingAdmissions || []).filter(a => a.status === 'pending').length;
  const pendAdmEl = document.getElementById('stat-pending-admissions');
  if (pendAdmEl) pendAdmEl.textContent = pendingCount;

  const totalRev = appState.financials.reduce((sum, f) => sum + (f.finalPaid || f.amount || 0), 0);
  const revEl = document.getElementById('stat-monthly-revenue');
  if (revEl) revEl.textContent = `₹${totalRev.toLocaleString('en-IN')}`;

  let totalDues = 0;
  activeStudents.forEach(s => {
    const studentInvoices = appState.financials.filter(f => String(f.studentId) === String(s.studentId));
    const paid = studentInvoices.reduce((sum, f) => sum + (f.finalPaid || f.amount || 0), 0);
    const expected = (s.monthlyFee || 2500);
    if (paid < expected) {
      totalDues += (expected - paid);
    }
  });
  const duesEl = document.getElementById('stat-total-dues-display');
  if (duesEl) duesEl.textContent = `₹${totalDues.toLocaleString('en-IN')}`;

  const dashList = document.getElementById('dash-attendance-list');
  if (dashList) {
    if (appState.students.length === 0) {
      dashList.innerHTML = `
        <div class="py-8 text-center text-xs text-slate-500 space-y-2">
          <span class="material-symbols-outlined text-4xl text-slate-300">groups</span>
          <p class="font-bold text-slate-700">No students registered yet</p>
          <p>Click "Register Student" to enroll the first athlete into ${appState.config.appSubtitle}.</p>
        </div>
      `;
    } else {
      dashList.innerHTML = appState.students.slice(0, 8).map(s => `
        <div class="py-3 flex items-center justify-between gap-3">
          <div class="flex items-center gap-3">
            <img class="w-9 h-9 rounded-full object-cover border border-slate-200" src="${s.avatar || DEFAULT_AVATAR}" alt="${s.name}"/>
            <div>
              <div class="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                <span>${s.name}</span>
                ${s.accountStatus === 'inactive' ? `<span class="status-badge status-inactive text-[9px] py-0 px-1">Inactive</span>` : ''}
              </div>
              <div class="text-[10px] text-slate-500 font-mono">${s.studentId} • ${s.belt}</div>
            </div>
          </div>
          <span class="status-badge status-${s.status || 'present'}">${s.status || 'present'}</span>
        </div>
      `).join('');
    }
  }
}

// 2. Attendance Tracker Engine
function getTodayDateStr() {
  return new Date().toISOString().split('T')[0];
}

function getStudentAttendanceStatus(student, dateStr) {
  if (!student) return 'unmarked';
  const targetDate = dateStr || getTodayDateStr();
  const rec = appState.attendance.find(a => String(a.studentId) === String(student.studentId) && a.date === targetDate);
  if (rec && rec.status) return rec.status;
  return 'unmarked';
}

function renderAttendance() {
  const tbody = document.getElementById('attendance-table-body');
  if (!tbody) return;

  const dateInput = document.getElementById('attendance-date');
  let selectedDate = dateInput?.value;
  if (!selectedDate) {
    selectedDate = getTodayDateStr();
    if (dateInput) dateInput.value = selectedDate;
  }

  const query = (document.getElementById('attendance-search-input')?.value || '').toLowerCase().trim();
  const beltFilter = document.getElementById('attendance-belt-filter')?.value || 'all';

  if (appState.students.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="py-12 text-center text-xs text-slate-500 space-y-2">
          <span class="material-symbols-outlined text-4xl text-slate-300 block mb-1">fact_check</span>
          <strong class="text-slate-700 block">No student attendance records found</strong>
          <p>Register students to track daily mat check-ins.</p>
        </td>
      </tr>
    `;
    updateAttendanceCounters(selectedDate);
    return;
  }

  const isViewer = (appState.userRole === 'viewer');

  let filteredStudents = appState.students.filter(s => {
    if (beltFilter !== 'all' && s.belt !== beltFilter) return false;
    if (query) {
      const matchName = String(s.name || '').toLowerCase().includes(query);
      const matchId = String(s.studentId || '').toLowerCase().includes(query);
      const matchPhone = String(s.contact?.phone || s.phone || '').includes(query);
      if (!matchName && !matchId && !matchPhone) return false;
    }
    return true;
  });

  if (filteredStudents.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="py-8 text-center text-xs text-slate-500">
          <span class="material-symbols-outlined text-3xl text-slate-300 block mb-1">search_off</span>
          <span>No students match the current search / belt filter.</span>
        </td>
      </tr>
    `;
    updateAttendanceCounters(selectedDate);
    return;
  }

  tbody.innerHTML = filteredStudents.map(s => {
    const currStatus = getStudentAttendanceStatus(s, selectedDate);
    return `
    <tr class="hover:bg-slate-50 transition ${s.accountStatus === 'inactive' ? 'opacity-60 bg-slate-50/50' : ''}" data-searchable>
      <td class="py-3.5 px-6">
        <div class="flex items-center gap-3">
          <img class="w-8 h-8 rounded-full object-cover border border-slate-200" src="${s.avatar || DEFAULT_AVATAR}" alt="${s.name}"/>
          <div>
            <div class="font-bold text-xs text-slate-900">${s.name}</div>
            ${s.accountStatus === 'inactive' ? `<span class="text-[9px] font-bold text-slate-400">ACCOUNT DEACTIVATED</span>` : ''}
          </div>
        </div>
      </td>
      <td class="py-3.5 px-6 font-mono font-bold text-slate-900 text-xs">${s.studentId}</td>
      <td class="py-3.5 px-6">
        <span class="belt-badge ${getBeltClass(s.belt)}">${s.belt}</span>
      </td>
      <td class="py-3.5 px-6">
        <span class="status-badge status-${currStatus}">${currStatus}</span>
      </td>
      <td class="py-3.5 px-6 text-right">
        ${isViewer ? `
          <span class="text-[10px] text-slate-400 font-bold uppercase">Read-Only</span>
        ` : s.accountStatus === 'inactive' ? `
          <span class="text-[10px] text-slate-400 font-bold uppercase">Inactive</span>
        ` : `
          <div class="inline-flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
            <button onclick="setStudentStatus('${s.id}', 'present', '${selectedDate}')" class="px-2.5 py-1 rounded-lg text-[10px] font-bold transition ${currStatus === 'present' ? 'bg-emerald-600 text-white shadow' : 'text-slate-600 hover:bg-slate-200'}">Present</button>
            <button onclick="setStudentStatus('${s.id}', 'excused', '${selectedDate}')" class="px-2.5 py-1 rounded-lg text-[10px] font-bold transition ${currStatus === 'excused' ? 'bg-amber-500 text-white shadow' : 'text-slate-600 hover:bg-slate-200'}">Excused</button>
            <button onclick="setStudentStatus('${s.id}', 'absent', '${selectedDate}')" class="px-2.5 py-1 rounded-lg text-[10px] font-bold transition ${currStatus === 'absent' ? 'bg-red-600 text-white shadow' : 'text-slate-600 hover:bg-slate-200'}">Absent</button>
          </div>
        `}
      </td>
    </tr>
  `}).join('');

  updateAttendanceCounters(selectedDate);
}

function setStudentStatus(idStr, status, targetDate) {
  if (appState.userRole === 'viewer') {
    showLightbox({ title: 'Permission Denied', message: 'Viewer role is read-only.', type: 'error' });
    return;
  }
  const student = appState.students.find(s => String(s.id) === String(idStr));
  if (!student) return;

  if (student.accountStatus === 'inactive') {
    showToast('Cannot mark attendance for inactive student account.');
    return;
  }

  const dateInput = document.getElementById('attendance-date');
  const dateStr = targetDate || (dateInput?.value ? dateInput.value : getTodayDateStr());

  let record = appState.attendance.find(a => String(a.studentId) === String(student.studentId) && a.date === dateStr);
  if (record) {
    record.status = status;
    record.timestamp = new Date().toLocaleTimeString();
  } else {
    appState.attendance.unshift({
      id: Date.now(),
      studentId: student.studentId,
      studentName: student.name,
      date: dateStr,
      timestamp: new Date().toLocaleTimeString(),
      status: status
    });
  }

  if (dateStr === getTodayDateStr()) {
    student.status = status;
  }

  // Automated Attendance Email Notification
  const studentEmail = student.contactEmail || student.contact?.email || student.email || '';
  if (studentEmail && (status === 'present' || status === 'absent')) {
    const token = localStorage.getItem('kai_token') || sessionStorage.getItem('kai_token');
    fetch('/api/attendance/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({
        studentId: student.studentId,
        studentName: student.name,
        studentEmail,
        status,
        date: dateStr,
        time: new Date().toLocaleTimeString('en-IN', { timeStyle: 'short' })
      })
    }).catch(() => { });
  }

  logActivity(`Attendance Marked (${dateStr}): ${student.name}`, `${student.studentId} marked ${status.toUpperCase()}`, 'attendance');
  saveDatabase();
  renderAllViews();
  showToast(`Attendance updated: ${student.name} marked ${status} for ${dateStr}`);
}

function markBulkAttendance(status) {
  if (appState.userRole === 'viewer') {
    showLightbox({ title: 'Permission Denied', message: 'Viewer role is read-only.', type: 'error' });
    return;
  }

  const dateInput = document.getElementById('attendance-date');
  const selectedDate = (dateInput && dateInput.value) ? dateInput.value : getTodayDateStr();

  const query = (document.getElementById('attendance-search-input')?.value || '').toLowerCase().trim();
  const beltFilter = document.getElementById('attendance-belt-filter')?.value || 'all';

  let targets = appState.students.filter(s => {
    if (s.accountStatus === 'inactive') return false;
    if (beltFilter !== 'all' && s.belt !== beltFilter) return false;
    if (query) {
      const matchName = String(s.name || '').toLowerCase().includes(query);
      const matchId = String(s.studentId || '').toLowerCase().includes(query);
      if (!matchName && !matchId) return false;
    }
    return true;
  });

  if (targets.length === 0) {
    showToast('No active students to update.');
    return;
  }

  targets.forEach(student => {
    let record = appState.attendance.find(a => String(a.studentId) === String(student.studentId) && a.date === selectedDate);
    if (record) {
      record.status = status;
      record.timestamp = new Date().toLocaleTimeString();
    } else {
      appState.attendance.unshift({
        id: Date.now() + Math.random(),
        studentId: student.studentId,
        studentName: student.name,
        date: selectedDate,
        timestamp: new Date().toLocaleTimeString(),
        status: status
      });
    }

    if (selectedDate === getTodayDateStr()) {
      student.status = status;
    }
  });

  logActivity(`Bulk Attendance Marked (${selectedDate})`, `${targets.length} athletes marked ${status.toUpperCase()}`, 'attendance');
  saveDatabase();
  renderAllViews();
  showToast(`Bulk attendance updated: ${targets.length} students marked ${status} for ${selectedDate}`);
}

function updateAttendanceCounters(dateStr) {
  const selectedDate = dateStr || getTodayDateStr();
  const activeStudents = appState.students.filter(s => s.accountStatus !== 'inactive');

  let present = 0;
  let excused = 0;
  let absent = 0;

  activeStudents.forEach(s => {
    const st = getStudentAttendanceStatus(s, selectedDate);
    if (st === 'present') present++;
    else if (st === 'excused') excused++;
    else absent++;
  });

  const pEl = document.getElementById('count-present');
  const eEl = document.getElementById('count-excused');
  const aEl = document.getElementById('count-absent');

  if (pEl) pEl.textContent = present;
  if (eEl) eEl.textContent = excused;
  if (aEl) aEl.textContent = absent;
}

function exportAttendanceCSV() {
  const dateInput = document.getElementById('attendance-date');
  const selectedDate = (dateInput && dateInput.value) ? dateInput.value : getTodayDateStr();

  const activeStudents = appState.students.filter(s => s.accountStatus !== 'inactive');
  if (activeStudents.length === 0) {
    showToast('No student records to export.');
    return;
  }

  const rows = [
    ['Student ID', 'Student Name', 'Belt Rank', 'Status', 'Attendance Date', 'Check-In Timestamp']
  ];

  activeStudents.forEach(s => {
    const st = getStudentAttendanceStatus(s, selectedDate);
    const rec = appState.attendance.find(a => String(a.studentId) === String(s.studentId) && a.date === selectedDate);
    const time = rec?.timestamp || (st === 'present' ? '08:00 AM' : '-');
    rows.push([
      `"${s.studentId}"`,
      `"${(s.name || '').replace(/"/g, '""')}"`,
      `"${s.belt}"`,
      `"${st.toUpperCase()}"`,
      `"${selectedDate}"`,
      `"${time}"`
    ]);
  });

  const csvContent = 'data:text/csv;charset=utf-8,' + rows.map(r => r.join(',')).join('\n');
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', `KAI_Attendance_${selectedDate}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  showToast(`Attendance CSV for ${selectedDate} exported successfully.`);
}

function setupAttendanceTrackerEvents() {
  const dateInput = document.getElementById('attendance-date');
  dateInput?.addEventListener('change', () => {
    renderAttendance();
  });

  const todayBtn = document.getElementById('btn-attendance-today');
  todayBtn?.addEventListener('click', () => {
    if (dateInput) dateInput.value = getTodayDateStr();
    renderAttendance();
  });

  const searchInput = document.getElementById('attendance-search-input');
  searchInput?.addEventListener('input', () => {
    renderAttendance();
  });

  const beltFilter = document.getElementById('attendance-belt-filter');
  beltFilter?.addEventListener('change', () => {
    renderAttendance();
  });

  const markPresentBtn = document.getElementById('mark-all-present-btn');
  markPresentBtn?.addEventListener('click', () => {
    markBulkAttendance('present');
  });

  const markAbsentBtn = document.getElementById('mark-all-absent-btn');
  markAbsentBtn?.addEventListener('click', () => {
    markBulkAttendance('absent');
  });

  const exportBtn = document.getElementById('export-attendance-csv');
  exportBtn?.addEventListener('click', () => {
    exportAttendanceCSV();
  });
}

// ==========================================
// SEND EMAIL MODAL CONTROLLER (FOR ALL ROLES)
// ==========================================
window.openSendEmailModal = function (studentId = null, defaultCategory = null) {
  const role = appState.userRole;
  if (role === 'viewer') {
    showLightbox({ title: 'Permission Denied', message: 'Viewer role is restricted from dispatching emails.', type: 'error' });
    return;
  }

  const modal = document.getElementById('send-email-modal');
  if (!modal) return;

  const studentSelect = document.getElementById('send-email-student-select');
  const categorySelect = document.getElementById('send-email-category-select');
  const targetNameInput = document.getElementById('send-email-target-name');
  const targetEmailInput = document.getElementById('send-email-target-email');
  const subjectInput = document.getElementById('send-email-subject');
  const bodyTextarea = document.getElementById('send-email-body');

  // Populate student dropdown
  if (studentSelect) {
    studentSelect.innerHTML = `
      <option value="">-- Choose Athlete / Parent --</option>
      <option value="__custom__">Custom Recipient Email</option>
      ${appState.students.filter(s => s.accountStatus !== 'inactive').map(s => `
        <option value="${s.id}" data-name="${s.name}" data-email="${s.contact?.email || s.email || ''}" data-id="${s.studentId}">
          ${s.name} (${s.studentId}) • ${s.contact?.email || s.email || 'No email registered'}
        </option>
      `).join('')}
    `;
    if (studentId) {
      studentSelect.value = String(studentId);
    }
  }

  // Populate categories tailored by role
  if (categorySelect) {
    let categoriesHtml = '';
    if (role === 'receptionist') {
      categoriesHtml = `
        <option value="attendance_present">Attendance Check-In Confirmation (Present)</option>
        <option value="attendance_absent">Attendance Absence Alert (Absent Notice)</option>
        <option value="inquiry">Program & Trial Class Information</option>
        <option value="announcement">General Academy Notice</option>
        <option value="custom">Custom Message</option>
      `;
    } else {
      // Manager & Admin
      categoriesHtml = `
        <option value="receipt">Official Fee Payment Receipt</option>
        <option value="due">Tuition Fee Due Reminder</option>
        <option value="overdue">URGENT: Fee Payment Overdue Notice</option>
        <option value="id_card">Official Student ID Card Delivery</option>
        <option value="attendance_present">Attendance Check-In Confirmation</option>
        <option value="attendance_absent">Attendance Absence Alert</option>
        <option value="belt_exam">Belt Promotion & Assessment Notice</option>
        <option value="announcement">General Academy Announcement</option>
        <option value="custom">Custom Message / Notification</option>
      `;
    }
    categorySelect.innerHTML = categoriesHtml;
    if (defaultCategory) {
      categorySelect.value = defaultCategory;
    }
  }

  // Sync recipient fields based on selected student
  const syncRecipientAndTemplate = () => {
    const selectedOpt = studentSelect?.options[studentSelect.selectedIndex];
    const isCustom = studentSelect?.value === '__custom__';
    const selStudent = appState.students.find(s => String(s.id) === studentSelect?.value);

    const athleteName = selStudent ? selStudent.name : (targetNameInput?.value || 'Athlete');
    const athleteEmail = selStudent ? (selStudent.contact?.email || selStudent.email || '') : '';
    const cat = categorySelect?.value || 'announcement';

    if (selStudent) {
      if (targetNameInput) targetNameInput.value = selStudent.name;
      if (targetEmailInput) targetEmailInput.value = athleteEmail;
    } else if (isCustom) {
      if (targetNameInput && !targetNameInput.value) targetNameInput.value = 'Athlete / Parent';
      if (targetEmailInput && !targetEmailInput.value) targetEmailInput.value = '';
    }

    // Populate standard templates based on category
    if (cat === 'receipt') {
      if (subjectInput) subjectInput.value = `Official Fee Payment Receipt - Karate Academy India`;
      if (bodyTextarea) bodyTextarea.value = `Dear ${athleteName},\n\nWe have successfully received your membership fee payment. Your official payment receipt has been recorded in the portal.\n\nThank you for training with Karate Academy India!\n\nBest Regards,\nAcademy Administration`;
    } else if (cat === 'due') {
      if (subjectInput) subjectInput.value = `Upcoming Tuition Fee Payment Due - Karate Academy India`;
      if (bodyTextarea) bodyTextarea.value = `Dear ${athleteName},\n\nThis is a polite reminder that your monthly tuition fee is upcoming. Please complete your fee settlement on or before the due date to ensure continuous mat access.\n\nBest Regards,\nKarate Academy India`;
    } else if (cat === 'overdue') {
      if (subjectInput) subjectInput.value = `URGENT: Fee Payment Overdue Notice - Karate Academy India`;
      if (bodyTextarea) bodyTextarea.value = `Dear ${athleteName},\n\nOur records indicate that your karate tuition fee payment is currently OVERDUE. Please clear your outstanding balance immediately at the reception desk or via UPI to maintain active membership.\n\nBest Regards,\nKarate Academy India`;
    } else if (cat === 'id_card') {
      if (subjectInput) subjectInput.value = `Official Digital ID Card & Mat Pass - Karate Academy India`;
      if (bodyTextarea) bodyTextarea.value = `Dear ${athleteName},\n\nWelcome to Karate Academy India! Your official student registration is confirmed and your Digital Mat Pass is now active.\n\nBest Regards,\nKarate Academy India Administration`;
    } else if (cat === 'attendance_present') {
      if (subjectInput) subjectInput.value = `Attendance Confirmation: Present on Mat - Karate Academy India`;
      if (bodyTextarea) bodyTextarea.value = `Dear Parent / Guardian,\n\nThis is to confirm that ${athleteName} has safely checked in and is PRESENT for today's karate training session on the mat.\n\nBest Regards,\nKarate Academy India Reception`;
    } else if (cat === 'attendance_absent') {
      if (subjectInput) subjectInput.value = `Attendance Notice: Absent from Session - Karate Academy India`;
      if (bodyTextarea) bodyTextarea.value = `Dear Parent / Guardian,\n\nThis is a notification that ${athleteName} was marked ABSENT for today's scheduled training session. If this was due to illness or personal reasons, please let our reception team know.\n\nBest Regards,\nKarate Academy India Reception`;
    } else if (cat === 'belt_exam') {
      if (subjectInput) subjectInput.value = `Belt Promotion Evaluation Notice - Karate Academy India`;
      if (bodyTextarea) bodyTextarea.value = `Dear ${athleteName},\n\nCongratulations! You have been selected as an eligible candidate for the upcoming Belt Promotion Evaluation. Please ensure your Kata, Kihon, and Kumite forms are practiced thoroughly.\n\nBest Regards,\nHead Instructor, Karate Academy India`;
    } else if (cat === 'inquiry') {
      if (subjectInput) subjectInput.value = `Welcome to Karate Academy India - Trial Session Information`;
      if (bodyTextarea) bodyTextarea.value = `Dear ${athleteName},\n\nThank you for reaching out to Karate Academy India! We invite you to experience our traditional martial arts training program. Our reception team looks forward to meeting you on the mat.\n\nBest Regards,\nKarate Academy India Team`;
    } else {
      if (subjectInput) subjectInput.value = `Official Notification from Karate Academy India`;
      if (bodyTextarea) bodyTextarea.value = `Dear ${athleteName},\n\nPlease take note of the latest update from the academy administration.\n\nBest Regards,\nKarate Academy India Management`;
    }
  };

  studentSelect?.addEventListener('change', syncRecipientAndTemplate);
  categorySelect?.addEventListener('change', syncRecipientAndTemplate);
  syncRecipientAndTemplate();

  modal.classList.remove('hidden');
};

window.closeSendEmailModal = function () {
  const modal = document.getElementById('send-email-modal');
  if (modal) modal.classList.add('hidden');
};

function setupSendEmailModalEvents() {
  const form = document.getElementById('header-send-email-form');
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const targetEmail = document.getElementById('send-email-target-email')?.value.trim();
    const targetName = document.getElementById('send-email-target-name')?.value.trim();
    const customSubject = document.getElementById('send-email-subject')?.value.trim();
    const customBody = document.getElementById('send-email-body')?.value.trim();
    const category = document.getElementById('send-email-category-select')?.value || 'custom';

    if (!targetEmail || !targetName || !customSubject || !customBody) {
      showToast('Please fill in all email fields before dispatching.');
      return;
    }

    const submitBtn = document.getElementById('btn-dispatch-email-submit');
    const labelEl = document.getElementById('btn-dispatch-email-label');

    if (submitBtn) submitBtn.disabled = true;
    if (labelEl) labelEl.textContent = 'Dispatching Email...';
    showToast('Connecting to SMTP server and dispatching email...');

    try {
      const token = localStorage.getItem('kai_token') || sessionStorage.getItem('kai_token');
      const res = await fetch('/api/send-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          category,
          targetEmail,
          targetName,
          customSubject,
          customBody
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        showLightbox({
          title: 'Email Dispatched Successfully',
          message: data.message || `Email sent successfully to ${targetEmail}`,
          type: 'success'
        });
        closeSendEmailModal();
        if (appState.activeAdminSec === 'emails') {
          loadAdminEmailLogs();
        }
      } else {
        showLightbox({
          title: 'Email Dispatch Failed',
          message: data.error || 'Could not send email. Please verify SMTP configuration in Admin settings.',
          type: 'error'
        });
        if (appState.activeAdminSec === 'emails') {
          loadAdminEmailLogs();
        }
      }
    } catch (err) {
      showLightbox({
        title: 'Dispatch Network Error',
        message: err.message,
        type: 'error'
      });
    } finally {
      if (submitBtn) submitBtn.disabled = false;
      if (labelEl) labelEl.textContent = 'Dispatch Email';
    }
  });
}

// ==========================================
// ADMIN EMAIL LOGS & QUEUE CONSOLE CONTROLLER
// ==========================================
let allAdminEmailLogs = [];

async function loadAdminEmailLogs() {
  const tbody = document.getElementById('admin-email-logs-table-body');
  if (!tbody) return;

  try {
    const token = localStorage.getItem('kai_token') || sessionStorage.getItem('kai_token');
    const res = await fetch('/api/emails/logs', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();

    if (res.ok && data.success) {
      allAdminEmailLogs = data.logs || [];
      const stats = data.stats || { total: 0, sent: 0, failed: 0, pending: 0 };

      const totalEl = document.getElementById('email-stat-total');
      const sentEl = document.getElementById('email-stat-sent');
      const failedEl = document.getElementById('email-stat-failed');
      const rateEl = document.getElementById('email-stat-rate');

      if (totalEl) totalEl.textContent = stats.total;
      if (sentEl) sentEl.textContent = stats.sent;
      if (failedEl) failedEl.textContent = stats.failed;
      if (rateEl) {
        const rate = stats.total > 0 ? Math.round((stats.sent / stats.total) * 100) : 100;
        rateEl.textContent = `${rate}%`;
      }

      filterAdminEmailLogs();
    }
  } catch (err) {
    console.error('Error fetching email logs:', err);
  }
}

function filterAdminEmailLogs() {
  const tbody = document.getElementById('admin-email-logs-table-body');
  if (!tbody) return;

  const statusFilter = document.getElementById('email-filter-status')?.value || 'all';
  const categoryFilter = document.getElementById('email-filter-category')?.value || 'all';
  const query = (document.getElementById('email-search-input')?.value || '').toLowerCase().trim();

  let filtered = allAdminEmailLogs;

  if (statusFilter !== 'all') {
    filtered = filtered.filter(l => l.status === statusFilter);
  }

  if (categoryFilter !== 'all') {
    filtered = filtered.filter(l => l.category === categoryFilter);
  }

  if (query) {
    filtered = filtered.filter(l =>
      l.recipientName?.toLowerCase().includes(query) ||
      l.recipientEmail?.toLowerCase().includes(query) ||
      l.subject?.toLowerCase().includes(query) ||
      l.category?.toLowerCase().includes(query)
    );
  }

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="py-8 text-center text-slate-400">
          <span class="material-symbols-outlined text-3xl text-slate-300">mail_outline</span>
          <div class="font-bold text-slate-600 mt-1">No email dispatch logs found</div>
          <div class="text-[11px] text-slate-400">Outbound emails will be logged here in real-time.</div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filtered.map(log => {
    let statusBadge = '';
    if (log.status === 'sent') {
      statusBadge = `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">Sent</span>`;
    } else if (log.status === 'failed') {
      statusBadge = `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-800 border border-red-200" title="${log.error || 'Delivery Error'}">Failed</span>`;
    } else {
      statusBadge = `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">Pending</span>`;
    }

    const catBadge = `<span class="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-slate-100 text-slate-700 border border-slate-200">${(log.category || 'general').toUpperCase()}</span>`;

    return `
      <tr class="hover:bg-slate-50 transition border-b border-slate-100">
        <td class="py-3 px-4 font-mono text-[11px] text-slate-500 whitespace-nowrap">${log.timestamp || 'N/A'}</td>
        <td class="py-3 px-4">
          <div class="font-bold text-slate-900">${log.recipientName || 'Athlete'}</div>
          <div class="text-[11px] text-slate-400 font-mono">${log.recipientEmail}</div>
        </td>
        <td class="py-3 px-4">${catBadge}</td>
        <td class="py-3 px-4 font-medium text-slate-800 max-w-xs truncate">${log.subject || 'Notice'}</td>
        <td class="py-3 px-4">${statusBadge}</td>
        <td class="py-3 px-4 text-right space-x-1 whitespace-nowrap">
          <button type="button" onclick="openEmailPreviewModal('${log.id}')" class="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] rounded-lg transition inline-flex items-center gap-1 shadow-sm">
            <span class="material-symbols-outlined text-xs">preview</span>
            <span>Preview</span>
          </button>
          ${log.status === 'failed' ? `
            <button type="button" onclick="retryFailedEmail('${log.id}')" class="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 font-bold text-[11px] rounded-lg transition inline-flex items-center gap-1 shadow-sm">
              <span class="material-symbols-outlined text-xs">replay</span>
              <span>Retry</span>
            </button>
          ` : ''}
        </td>
      </tr>
    `;
  }).join('');
}

window.openEmailPreviewModal = function (logId) {
  const log = allAdminEmailLogs.find(l => String(l.id) === String(logId));
  if (!log) return;

  const modal = document.getElementById('email-preview-modal');
  const subjectHeader = document.getElementById('email-preview-subject-header');
  const container = document.getElementById('email-preview-container');
  const metaInfo = document.getElementById('email-preview-meta-info');

  if (subjectHeader) subjectHeader.textContent = log.subject || 'Email Notification';
  if (metaInfo) metaInfo.textContent = `To: ${log.recipientName} (${log.recipientEmail}) • ${log.timestamp} • Status: ${(log.status || '').toUpperCase()}`;

  if (container) {
    container.innerHTML = `
      <div style="max-width: 520px; width: 100%; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 16px rgba(0,0,0,0.05); font-family: -apple-system, BlinkMacSystemFont, sans-serif;">
        <div style="background-color: #ffffff; padding: 20px; text-align: center; border-top: 4px solid #dc2626; border-bottom: 1px solid #f1f5f9;">
          <img src="https://www.karateacademyindia.com/logo.png" style="height: 40px; margin-bottom: 6px;" alt="KAI Logo"/>
          <h4 style="color: #0f172a; font-size: 16px; margin: 0; font-weight: 900; text-transform: uppercase;">KARATE ACADEMY INDIA</h4>
          <p style="color: #dc2626; font-size: 10px; margin: 4px 0 0 0; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">${log.subtitle || 'Official Portal Notification'}</p>
        </div>
        <div style="padding: 20px; color: #334155; font-size: 12px; line-height: 1.6;">
          <div style="font-size: 14px; font-weight: 700; color: #0f172a; margin-bottom: 10px;">Dear ${log.recipientName},</div>
          <div>${log.contentHtml || '<p>No content preview available.</p>'}</div>
        </div>
        <div style="background-color: #f8fafc; padding: 14px; text-align: center; font-size: 10px; color: #64748b; border-top: 1px solid #e2e8f0; line-height: 1.5;">
          <strong>Karate Academy India Management Portal</strong><br/>
          Official Headquarters: Connaught Place, New Delhi, India<br/>
          Support: +91 70409 25257 • info@karateacademyindia.com
        </div>
      </div>
    `;
  }

  modal?.classList.remove('hidden');
};

window.closeEmailPreviewModal = function () {
  const modal = document.getElementById('email-preview-modal');
  modal?.classList.add('hidden');
};

window.retryFailedEmail = async function (logId) {
  showToast('Retrying email dispatch...');
  try {
    const token = localStorage.getItem('kai_token') || sessionStorage.getItem('kai_token');
    const res = await fetch('/api/emails/retry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ logId })
    });

    const data = await res.json();
    if (res.ok && data.success) {
      showLightbox({ title: 'Retry Succeeded', message: data.message || 'Email successfully sent on retry.', type: 'success' });
      await loadAdminEmailLogs();
    } else {
      showLightbox({ title: 'Retry Failed', message: data.error || 'Could not dispatch email.', type: 'error' });
      await loadAdminEmailLogs();
    }
  } catch (err) {
    showLightbox({ title: 'Retry Error', message: err.message, type: 'error' });
  }
};

window.clearAllEmailLogs = async function () {
  if (!confirm('Are you sure you want to clear all email history logs? This action cannot be undone.')) return;
  try {
    const token = localStorage.getItem('kai_token') || sessionStorage.getItem('kai_token');
    const res = await fetch('/api/emails/clear-logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    if (res.ok && data.success) {
      showToast('Email logs cleared.');
      await loadAdminEmailLogs();
    }
  } catch (err) {
    showToast('Failed to clear logs.');
  }
};

// 3. Scan for Attendance
function setupKioskScanner() {
  const toggleBtn = document.getElementById('toggle-camera-btn');
  toggleBtn?.addEventListener('click', toggleCameraScanner);

  document.getElementById('manual-qr-submit')?.addEventListener('click', () => {
    if (appState.userRole === 'viewer') {
      showLightbox({ title: 'Permission Denied', message: 'Viewer role is read-only.', type: 'error' });
      return;
    }
    const inputVal = document.getElementById('manual-qr-input')?.value.trim();
    if (inputVal) {
      processScannedQR(inputVal);
      document.getElementById('manual-qr-input').value = '';
    }
  });
}

async function startAutoKioskCamera() {
  if (cameraStream) return;
  await toggleCameraScanner();
}

async function toggleCameraScanner() {
  const video = document.getElementById('qr-video');
  const placeholder = document.getElementById('camera-placeholder');
  const btn = document.getElementById('toggle-camera-btn');
  const statusText = document.getElementById('camera-status-text');
  const retryBtn = document.getElementById('retry-camera-btn');

  if (cameraStream) {
    stopCamera();
    if (btn) btn.innerHTML = `<span class="material-symbols-outlined text-sm">videocam</span><span>Toggle Camera Scanner</span>`;
    return;
  }

  try {
    if (statusText) statusText.textContent = 'Initializing device camera stream...';
    retryBtn?.classList.add('hidden');

    cameraStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    if (video) {
      video.srcObject = cameraStream;
      video.classList.remove('hidden');
      placeholder?.classList.add('hidden');
      if (btn) btn.innerHTML = `<span class="material-symbols-outlined text-sm">videocam_off</span><span>Stop Camera Scanner</span>`;

      startLiveQRFrameScanner();
    }
  } catch (err) {
    if (statusText) statusText.textContent = 'Camera permission denied or unavailable.';
    retryBtn?.classList.remove('hidden');
    showToast('Camera stream could not start. Use manual Student ID log or click Retry.');
  }
}

function stopCamera() {
  if (cameraStream) {
    cameraStream.getTracks().forEach(track => track.stop());
    cameraStream = null;
  }
  if (animFrameId) {
    cancelAnimationFrame(animFrameId);
    animFrameId = null;
  }
  const video = document.getElementById('qr-video');
  const placeholder = document.getElementById('camera-placeholder');
  video?.classList.add('hidden');
  placeholder?.classList.remove('hidden');
}

function startLiveQRFrameScanner() {
  const video = document.getElementById('qr-video');
  const canvas = document.getElementById('qr-canvas');
  if (!video || !canvas) return;

  const ctx = canvas.getContext('2d');

  function scanFrame() {
    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      canvas.height = video.videoHeight;
      canvas.width = video.videoWidth;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

      if (typeof jsQR !== 'undefined') {
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'dontInvert'
        });

        if (code && code.data) {
          processScannedQR(code.data);
        }
      }
    }
    if (cameraStream) {
      animFrameId = requestAnimationFrame(scanFrame);
    }
  }

  animFrameId = requestAnimationFrame(scanFrame);
}

function processScannedQR(qrCodeStr) {
  if (appState.userRole === 'viewer') {
    showLightbox({ title: 'Permission Denied', message: 'Viewer role is read-only.', type: 'error' });
    return;
  }

  const cleanCode = qrCodeStr.trim().toUpperCase();
  const lastResultBox = document.getElementById('kiosk-last-result');

  const student = appState.students.find(s => String(s.studentId).toUpperCase() === cleanCode || String(s.id) === cleanCode);

  if (!student) {
    if (lastResultBox) {
      lastResultBox.innerHTML = `
        <div class="p-4 bg-red-50 border border-red-200 rounded-xl space-y-1 text-center">
          <span class="material-symbols-outlined text-red-600 text-3xl">cancel</span>
          <h4 class="font-extrabold text-sm text-red-800">Unrecognized / Invalid Student ID</h4>
          <p class="text-xs text-red-600 font-mono">ID: ${cleanCode} does not exist in roster.</p>
        </div>
      `;
    }
    showLightbox({
      title: 'Scan Error: Unrecognized QR Payload',
      message: `Student ID "${cleanCode}" was not found in the student database. QR access denied.`,
      type: 'error'
    });
    return;
  }

  if (student.accountStatus === 'inactive') {
    if (lastResultBox) {
      lastResultBox.innerHTML = `
        <div class="p-4 bg-slate-100 border border-slate-300 rounded-xl space-y-1 text-center">
          <span class="material-symbols-outlined text-slate-500 text-3xl">block</span>
          <h4 class="font-extrabold text-sm text-slate-800">Access Denied: Account Deactivated</h4>
          <p class="text-xs text-slate-600 font-bold">${student.name} (${student.studentId}) account is INACTIVE.</p>
        </div>
      `;
    }
    showLightbox({
      title: 'Access Denied: Account Deactivated',
      message: `Athlete "${student.name}" (${student.studentId}) is currently inactive. QR attendance scan rejected.`,
      type: 'warning'
    });
    return;
  }

  const today = new Date().toISOString().split('T')[0];
  const alreadyScanned = appState.attendance.some(a => String(a.studentId) === String(student.studentId) && a.date === today);

  if (alreadyScanned && student.status === 'present') {
    if (lastResultBox) {
      lastResultBox.innerHTML = `
        <div class="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-2 text-center">
          <span class="material-symbols-outlined text-amber-600 text-3xl">info</span>
          <h4 class="font-extrabold text-sm text-amber-900">Duplicate Check-In Protection</h4>
          <p class="text-xs text-amber-800 font-bold">${student.name} (${student.studentId}) is already marked PRESENT today!</p>
        </div>
      `;
    }
    showToast(`Notice: ${student.name} already checked-in today.`);
    return;
  }

  student.status = 'present';
  appState.attendance.unshift({
    id: Date.now(),
    studentId: student.studentId,
    studentName: student.name,
    date: today,
    timestamp: new Date().toLocaleTimeString(),
    status: 'present'
  });

  logActivity(`QR Scan Check-In: ${student.name}`, `Scanned ID ${student.studentId} • ${student.belt}`, 'attendance');

  saveDatabase();
  renderAllViews();

  if (lastResultBox) {
    lastResultBox.innerHTML = `
      <div class="p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-3 text-center">
        <div class="flex justify-center">
          <img class="w-16 h-16 rounded-full object-cover border-2 border-emerald-500 shadow" src="${student.avatar || DEFAULT_AVATAR}" alt="${student.name}"/>
        </div>
        <div>
          <h4 class="font-extrabold text-base text-emerald-950">${student.name}</h4>
          <span class="belt-badge ${getBeltClass(student.belt)} text-[10px] mt-1">${student.belt}</span>
        </div>
        <div class="text-xs font-mono font-bold text-emerald-700 bg-emerald-100 py-1 px-3 rounded-lg inline-flex items-center gap-1">
          <span class="material-symbols-outlined text-xs text-emerald-700">verified</span>
          <span>ATTENDANCE VERIFIED (${student.studentId})</span>
        </div>
      </div>
    `;
  }

  showToast(`Attendance verified: ${student.name} (${student.studentId}) marked Present!`);
}

function renderKioskLogs() {
  const container = document.getElementById('kiosk-recent-list');
  if (!container) return;

  if (appState.attendance.length === 0) {
    container.innerHTML = `<div class="py-4 text-center text-slate-400 text-xs">No scan records today.</div>`;
    return;
  }

  container.innerHTML = appState.attendance.slice(0, 5).map(a => `
    <div class="py-2.5 flex items-center justify-between">
      <div>
        <div class="font-bold text-slate-900">${a.studentName}</div>
        <div class="text-[10px] text-slate-400 font-mono">${a.studentId} • ${a.timestamp}</div>
      </div>
      <span class="status-badge status-present">Present</span>
    </div>
  `).join('');
}

// 4. Student Directory
function setupDirectorySearchAndFilters() {
  const searchInput = document.getElementById('dir-search-input');
  const beltFilter = document.getElementById('dir-belt-filter');
  const statusFilter = document.getElementById('dir-status-filter');

  searchInput?.addEventListener('input', () => renderDirectory());
  beltFilter?.addEventListener('change', () => renderDirectory());
  statusFilter?.addEventListener('change', () => renderDirectory());
}

function renderDirectory() {
  const tbody = document.getElementById('student-directory-table-body');
  if (!tbody) return;

  const isViewer = (appState.userRole === 'viewer');
  const isAdmin = (appState.userRole === 'admin');
  const isManager = (appState.userRole === 'manager');
  const isReceptionist = (appState.userRole === 'receptionist');

  const searchInput = document.getElementById('dir-search-input');
  const beltFilter = document.getElementById('dir-belt-filter');
  const statusFilter = document.getElementById('dir-status-filter');

  const query = (searchInput?.value || '').trim().toLowerCase();
  const selectedBelt = beltFilter?.value || 'all';
  const selectedStatus = statusFilter?.value || 'all';

  let filtered = appState.students;

  if (query) {
    filtered = filtered.filter(s =>
      s.name?.toLowerCase().includes(query) ||
      s.studentId?.toLowerCase().includes(query) ||
      s.phone?.toLowerCase().includes(query) ||
      s.contactPhone?.toLowerCase().includes(query) ||
      s.email?.toLowerCase().includes(query) ||
      s.contactEmail?.toLowerCase().includes(query)
    );
  }

  if (selectedBelt !== 'all') {
    filtered = filtered.filter(s => s.belt === selectedBelt);
  }

  if (selectedStatus === 'active') {
    filtered = filtered.filter(s => s.accountStatus !== 'inactive');
  } else if (selectedStatus === 'inactive') {
    filtered = filtered.filter(s => s.accountStatus === 'inactive');
  }

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="py-16 text-center text-xs text-slate-500 space-y-3">
          <span class="material-symbols-outlined text-5xl text-slate-300 block mb-1">groups</span>
          <strong class="text-slate-700 text-sm block">No Registered Students Found</strong>
          <p>${query || selectedBelt !== 'all' || selectedStatus !== 'all' ? 'Try adjusting your search query or filters.' : `Click below to register the first athlete into ${appState.config.appSubtitle}.`}</p>
          ${(!isViewer && !isReceptionist && !query && selectedBelt === 'all' && selectedStatus === 'all') ? `
            <button class="open-add-student-modal action-btn-write px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl shadow transition inline-flex items-center gap-1.5 mt-2">
              <span class="material-symbols-outlined text-sm">person_add</span>
              <span>+ Register First Student</span>
            </button>
          ` : ''}
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filtered.map(s => {
    const isInactive = s.accountStatus === 'inactive';

    return `
      <tr class="hover:bg-slate-50 transition ${isInactive ? 'opacity-60 bg-slate-50/50' : ''}" data-searchable>
        <td class="py-3 px-3 sm:px-4 font-mono font-bold text-red-600 text-xs">${s.studentId}</td>
        <td class="py-3 px-3 sm:px-4">
          <div class="flex items-center gap-2.5 cursor-pointer" onclick="openStudentDetailsModal('${s.id}')">
            <img class="w-8 h-8 rounded-full object-cover border border-slate-200 shadow-sm shrink-0" src="${s.avatar || DEFAULT_AVATAR}" alt="${s.name}"/>
            <div class="overflow-hidden">
              <div class="font-bold text-xs text-slate-900 hover:text-red-600 transition truncate">${s.name}</div>
              <div class="text-[10px] text-slate-400 hidden sm:block">Joined: ${s.joinDate || '2026'}</div>
            </div>
          </div>
        </td>
        <td class="py-3 px-3 sm:px-4">
          <span class="belt-badge ${getBeltClass(s.belt)} text-[10px] py-0.5 px-2">${s.belt}</span>
        </td>
        <td class="py-3 px-3 sm:px-4 text-xs text-slate-600 hidden md:table-cell">
          <div class="font-mono font-bold text-slate-900 text-[11px]">${s.contactPhone || s.phone || 'N/A'}</div>
          <div class="text-[10px] text-slate-400 truncate max-w-[140px]">${s.contactEmail || s.email || ''}</div>
        </td>
        <td class="py-3 px-3 sm:px-4">
          <span class="status-badge ${isInactive ? 'status-inactive' : 'status-active'} text-[10px]">${isInactive ? 'Inactive' : 'Active'}</span>
        </td>
        <td class="py-3 px-3 sm:px-4 text-right">
          <div class="inline-flex items-center gap-1">
            <button onclick="openStudentDetailsModal('${s.id}')" class="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-[10px] rounded-lg transition flex items-center gap-1 shrink-0">
              <span class="material-symbols-outlined text-xs">visibility</span>
              <span class="hidden sm:inline">Details</span>
            </button>
            ${(isAdmin || isManager) ? `
              <button onclick="openEditStudentModal('${s.id}')" class="px-2.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-[10px] rounded-lg transition flex items-center gap-1 shrink-0" title="Edit Student Profile">
                <span class="material-symbols-outlined text-xs">edit</span>
                <span class="hidden sm:inline">Edit</span>
              </button>
            ` : ''}
            ${isAdmin ? `
              <button onclick="deleteStudent('${s.id}')" class="px-2 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 font-bold text-[10px] rounded-lg transition flex items-center gap-1 shrink-0" title="Delete Student Profile">
                <span class="material-symbols-outlined text-xs">delete</span>
                <span class="hidden md:inline">Delete</span>
              </button>
            ` : !isReceptionist ? `
              <button onclick="showAdminDeleteNotice('${s.name}', '${s.studentId}')" class="px-2 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-500 font-bold text-[10px] rounded-lg transition border border-slate-200 shrink-0" title="Contact Admin to Delete">
                <span class="hidden sm:inline">Ask Admin to Delete</span>
                <span class="sm:hidden">Admin Only</span>
              </button>
            ` : ''}
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function showAdminDeleteNotice(studentName, studentId) {
  const displayStr = studentId ? `${studentName} (${studentId})` : studentName;
  showLightbox({
    title: 'Admin Permission Required',
    message: `Student deletion is restricted to Root Admin accounts. Please contact info@conzex.com to request deletion of student "${displayStr}".`,
    type: 'info',
    confirmText: 'Understood'
  });
}

// 5. Complete Student Details Lightbox Modal Logic
function setupStudentDetailsModal() {
  const modal = document.getElementById('student-details-modal');
  const closeBtn = document.getElementById('close-sd-modal');
  const closeBtnFooter = document.getElementById('btn-close-sd-modal');

  closeBtn?.addEventListener('click', () => modal?.classList.add('hidden'));
  closeBtnFooter?.addEventListener('click', () => modal?.classList.add('hidden'));

  const tabBtns = document.querySelectorAll('.sd-tab-btn');
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.getAttribute('data-sd-tab');
      if (target === 'fees' && appState.userRole === 'receptionist') {
        showLightbox({ title: 'Access Restricted', message: 'Fees & Payment history is restricted to Manager and Admin roles.', type: 'warning' });
        return;
      }
      switchStudentDetailTab(target);
    });
  });
}

function switchStudentDetailTab(tabKey) {
  if (tabKey === 'fees' && appState.userRole === 'receptionist') {
    tabKey = 'profile';
  }

  appState.activeStudentDetailTab = tabKey;

  document.querySelectorAll('.sd-tab-btn').forEach(btn => {
    if (btn.getAttribute('data-sd-tab') === tabKey) {
      btn.className = 'sd-tab-btn px-4 py-3 border-b-2 border-red-600 text-red-600 flex items-center gap-1.5 font-bold';
    } else {
      btn.className = 'sd-tab-btn px-4 py-3 border-b-2 border-transparent text-slate-600 hover:text-slate-900 flex items-center gap-1.5 font-bold';
    }
  });

  document.querySelectorAll('.sd-tab-content').forEach(content => {
    if (content.id === `sd-tab-${tabKey}`) {
      content.classList.remove('hidden');
    } else {
      content.classList.add('hidden');
    }
  });
}

async function openStudentDetailsModal(studentIdStr) {
  const student = appState.students.find(s => String(s.id) === String(studentIdStr) || s.studentId === studentIdStr);
  if (!student) return;

  appState.currentDetailStudentId = student.id;

  const modal = document.getElementById('student-details-modal');
  if (!modal) return;

  const isInactive = student.accountStatus === 'inactive';
  const logo = appState.config.logoUrl || DEFAULT_LOGO;
  const headerText = appState.config.receiptHeader || 'KARATE ACADEMY INDIA';

  document.getElementById('sd-header-photo').src = student.avatar || DEFAULT_AVATAR;
  document.getElementById('sd-header-name').textContent = student.name;
  document.getElementById('sd-header-id').textContent = student.studentId;

  const beltEl = document.getElementById('sd-header-belt');
  if (beltEl) {
    beltEl.textContent = student.belt;
    beltEl.className = `belt-badge ${getBeltClass(student.belt)} text-[10px] py-0.5 px-2`;
  }

  const statusEl = document.getElementById('sd-header-status');
  if (statusEl) {
    statusEl.textContent = isInactive ? 'Inactive' : 'Active';
    statusEl.className = `status-badge ${isInactive ? 'status-inactive' : 'status-active'} text-[9px]`;
  }

  document.getElementById('sd-gender').textContent = student.gender || 'N/A';
  document.getElementById('sd-dob').textContent = student.dob || 'N/A';
  document.getElementById('sd-joindate').textContent = student.joinDate || '2026-01-10';
  document.getElementById('sd-account-status').textContent = isInactive ? 'DEACTIVATED' : 'ACTIVE';

  document.getElementById('sd-contact-name').textContent = student.contactName || student.name;
  document.getElementById('sd-phone').textContent = student.contactPhone || student.phone || 'N/A';
  document.getElementById('sd-email').textContent = student.contactEmail || student.email || 'N/A';

  const fullAddress = [student.address, student.city, student.state, student.pincode].filter(Boolean).join(', ') || 'No residential address recorded.';
  document.getElementById('sd-full-address').textContent = fullAddress;

  document.getElementById('sd-emerg-name').textContent = student.emergName || 'Parent / Guardian';
  document.getElementById('sd-emerg-phone').textContent = student.emergPhone || 'N/A';

  // HIDE FEES TAB BUTTON FOR RECEPTIONIST
  const feesTabBtn = document.getElementById('sd-tab-btn-fees');
  if (feesTabBtn) {
    if (appState.userRole === 'receptionist') feesTabBtn.classList.add('hidden');
    else feesTabBtn.classList.remove('hidden');
  }

  document.getElementById('sd-plan-fee').textContent = `₹${(student.monthlyFee || 2500).toLocaleString('en-IN')}`;

  const studentInvoices = appState.financials.filter(f => String(f.studentId) === String(student.studentId));
  const totalPaid = studentInvoices.reduce((sum, f) => sum + (f.finalPaid || f.amount || 0), 0);
  document.getElementById('sd-total-paid').textContent = `₹${totalPaid.toLocaleString('en-IN')}`;

  const invListBody = document.getElementById('sd-invoices-list');
  if (invListBody) {
    if (studentInvoices.length === 0) {
      invListBody.innerHTML = `<tr><td colspan="5" class="py-4 text-center text-slate-400">No payment invoices found.</td></tr>`;
    } else {
      invListBody.innerHTML = studentInvoices.map(inv => `
        <tr class="hover:bg-slate-50">
          <td class="py-2.5 px-4 font-mono font-bold text-red-600">${inv.id}</td>
          <td class="py-2.5 px-4 text-slate-500">${inv.dueDate || 'Today'}</td>
          <td class="py-2.5 px-4 font-bold text-slate-800">${inv.paymentMethod}</td>
          <td class="py-2.5 px-4 font-extrabold text-emerald-700">₹${(inv.finalPaid || inv.amount).toLocaleString('en-IN')}</td>
          <td class="py-2.5 px-4 text-right">
            <button onclick="openReceiptModal('${inv.id}')" class="px-2.5 py-1 bg-red-50 text-red-600 font-bold text-[10px] rounded-lg">Receipt</button>
          </td>
        </tr>
      `).join('');
    }
  }

  const qrDataBase64 = await generateStudentQRCodeBase64(student.studentId);
  const cardMount = document.getElementById('sd-idcard-mount');

  if (cardMount) {
    cardMount.innerHTML = `
      <div class="id-card-printable p-5 rounded-2xl bg-white border-2 border-slate-200 shadow-md space-y-3 relative overflow-hidden flex flex-col justify-between w-full max-w-sm" id="idcard-element-${student.id}">
        <div>
          <!-- CLEAN HEADER WITHOUT ACTIVE/INACTIVE BADGE AND WITHOUT OFFICIAL ATHLETE ID SUBTITLE -->
          <div class="flex items-center gap-3 border-b border-slate-200 pb-3 mb-3">
            <img src="${logo}" alt="KAI Logo" class="w-9 h-9 object-contain shrink-0" onerror="this.onerror=null; this.src='${DEFAULT_AVATAR}';"/>
            <h4 class="font-extrabold text-sm text-slate-900 tracking-tight leading-tight flex-1 uppercase">${headerText}</h4>
          </div>

          <div class="flex items-center gap-3.5 mb-3">
            <img class="w-16 h-16 rounded-xl object-cover border-2 border-red-500 shadow-sm shrink-0" src="${student.avatar || DEFAULT_AVATAR}" alt="${student.name}"/>
            <div class="overflow-hidden space-y-1 flex-1">
              <h3 class="font-extrabold text-sm text-slate-900 leading-tight break-words">${student.name}</h3>
              <div class="flex items-center gap-2">
                <span class="text-xs font-mono font-extrabold text-red-600 bg-red-50 py-0.5 px-2 rounded border border-red-100 inline-block">${student.studentId}</span>
                <span class="belt-badge ${getBeltClass(student.belt)} text-[9px] py-0.5 px-2">${student.belt}</span>
              </div>
              <div class="text-[10px] text-slate-500 font-medium">Gender: <strong class="text-slate-800">${student.gender || 'N/A'}</strong> • DOB: <strong class="text-slate-800">${student.dob || 'N/A'}</strong></div>
            </div>
          </div>

          <!-- CLEAN ALL-REQUIRED-FIELDS CARD BODY -->
          <div class="space-y-1.5 text-[10px] text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-200 mb-3">
            <div><strong class="text-slate-800">Primary Contact Phone:</strong> <span class="font-mono font-bold text-slate-900">${student.contactPhone || student.phone || 'N/A'}</span></div>
            <div><strong class="text-slate-800">Primary Contact Email:</strong> <span class="font-medium text-slate-900 truncate block max-w-full">${student.contactEmail || student.email || 'N/A'}</span></div>
            <div><strong class="text-slate-800">Full Address:</strong> <span class="break-words font-medium text-slate-800 block">${fullAddress}</span></div>
          </div>
        </div>

        <div class="pt-2 border-t border-slate-100 flex items-center justify-between">
          <div class="text-[9px] text-slate-400 font-mono">
            <div class="font-bold text-slate-700">KARATE ACADEMY INDIA</div>
            <div>Official Athlete Pass</div>
          </div>
          <div class="w-16 h-16 bg-white p-0.5 border border-slate-200 rounded-lg flex items-center justify-center shadow-sm shrink-0">
            ${qrDataBase64 ? `
              <img src="${qrDataBase64}" alt="QR Code: ${student.studentId}" class="w-full h-full object-contain rounded"/>
            ` : `
              <button onclick="openStudentDetailsModal('${student.id}')" class="text-[8px] font-bold text-red-600 hover:underline text-center">Retry QR</button>
            `}
          </div>
        </div>

        <div class="pt-3 border-t border-slate-100 flex items-center justify-center no-print">
          <button onclick="downloadIDCardPNG('${student.id}')" class="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl transition text-center flex items-center justify-center gap-1.5 shadow text-xs">
            <span class="material-symbols-outlined text-sm">download</span><span>Download PNG</span>
          </button>
        </div>
      </div>
    `;
  }

  const studentAttendance = appState.attendance.filter(a => String(a.studentId) === String(student.studentId));
  const attListBody = document.getElementById('sd-attendance-list');
  if (attListBody) {
    if (studentAttendance.length === 0) {
      attListBody.innerHTML = `<tr><td colspan="3" class="py-4 text-center text-slate-400">No attendance check-ins logged yet.</td></tr>`;
    } else {
      attListBody.innerHTML = studentAttendance.map(att => `
        <tr class="hover:bg-slate-50">
          <td class="py-2.5 px-4 font-bold text-slate-900">${att.date}</td>
          <td class="py-2.5 px-4 text-slate-500 font-mono">${att.timestamp}</td>
          <td class="py-2.5 px-4"><span class="status-badge status-present">Present</span></td>
        </tr>
      `).join('');
    }
  }

  const toggleBox = document.getElementById('sd-status-toggle-box');
  if (toggleBox) {
    if (appState.userRole !== 'viewer' && appState.userRole !== 'receptionist') {
      toggleBox.innerHTML = `
        <button onclick="toggleStudentActive('${student.id}'); openStudentDetailsModal('${student.id}');" class="px-4 py-2 ${isInactive ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-amber-600 hover:bg-amber-700'} text-white font-bold text-xs rounded-xl shadow transition">
          ${isInactive ? 'Reactivate Student Account' : 'Deactivate Student Account'}
        </button>
      `;
    } else {
      toggleBox.innerHTML = '';
    }
  }

  switchStudentDetailTab('profile');
  modal.classList.remove('hidden');
}

function toggleStudentActive(idStr) {
  if (appState.userRole === 'viewer' || appState.userRole === 'receptionist') return;
  const student = appState.students.find(s => String(s.id) === String(idStr));
  if (student) {
    if (student.accountStatus === 'inactive') {
      student.accountStatus = 'active';
      logActivity(`Student Account Reactivated: ${student.name}`, `ID ${student.studentId} active`, 'enrollment');
      showToast(`Account Reactivated: ${student.name}`);
    } else {
      student.accountStatus = 'inactive';
      logActivity(`Student Account Deactivated: ${student.name}`, `ID ${student.studentId} deactivated`, 'enrollment');
      showToast(`Account Deactivated: ${student.name}`);
    }
    saveDatabase();
    renderAllViews();
  }
}

function deleteStudent(idStr) {
  if (appState.userRole !== 'admin') {
    showLightbox({
      title: 'Admin Permission Required',
      message: 'Only Root Admin accounts can delete student records. Please contact info@conzex.com.',
      type: 'info'
    });
    return;
  }

  const student = appState.students.find(s => String(s.id) === String(idStr));
  if (!student) return;

  showLightbox({
    title: 'Delete Student Record (Admin Action)',
    message: `Are you sure you want to permanently delete athlete "${student.name}" (${student.studentId}) from the database?`,
    type: 'confirm',
    confirmText: 'Permanently Delete',
    onResult: (confirmed) => {
      if (confirmed) {
        appState.students = appState.students.filter(s => String(s.id) !== String(idStr));
        appState.financials = appState.financials.filter(f => String(f.studentId) !== String(student.studentId));
        appState.attendance = appState.attendance.filter(a => String(a.studentId) !== String(student.studentId));

        logActivity(`Student Record Deleted: ${student.name}`, `Purged ID ${student.studentId} permanently`, 'enrollment');

        saveDatabase();
        renderAllViews();
        document.getElementById('student-details-modal')?.classList.add('hidden');
        showToast(`Student record for ${student.name} permanently deleted.`);
      }
    }
  });
}

// 6. Dynamic Student Digital ID Cards & PNG Download Engine (Clean Layout, All Fields, No Overlap)
async function renderIDCards() {
  const container = document.getElementById('id-cards-container');
  if (!container) return;

  const logo = appState.config.logoUrl || DEFAULT_LOGO;
  const headerText = appState.config.receiptHeader || 'KARATE ACADEMY INDIA';

  if (appState.students.length === 0) {
    container.innerHTML = `
      <div class="col-span-full py-16 bg-white rounded-3xl border border-slate-200 text-center space-y-3 p-8">
        <span class="material-symbols-outlined text-5xl text-slate-300">badge</span>
        <h3 class="font-extrabold text-lg text-slate-900">No Student ID Cards</h3>
        <p class="text-xs text-slate-500">Register students or approve online admissions to auto-generate digital ID cards.</p>
      </div>
    `;
    return;
  }

  const studentCardsHtml = await Promise.all(appState.students.map(async (s) => {
    const fullAddress = [s.address, s.city, s.state, s.pincode].filter(Boolean).join(', ') || 'N/A';
    const qrDataBase64 = await generateStudentQRCodeBase64(s.studentId);

    return `
      <div class="kai-idcard-light id-card-printable p-6 rounded-3xl bg-white border-2 border-slate-200 shadow-lg space-y-4 relative overflow-hidden flex flex-col justify-between w-full max-w-sm" id="idcard-element-${s.id}">
        <div>
          <!-- HEADER BANNER WITH RED ACCENT -->
          <div class="flex items-center gap-3 border-b-2 border-slate-100 pb-3.5 mb-4">
            <div class="w-10 h-10 rounded-xl bg-slate-50 p-1 border border-slate-200 flex items-center justify-center shrink-0 shadow-sm">
              <img src="${logo}" alt="KAI Logo" class="max-w-full max-h-full object-contain" onerror="this.onerror=null; this.src='${DEFAULT_AVATAR}';"/>
            </div>
            <div class="flex-1 overflow-hidden">
              <h4 class="font-extrabold text-xs text-slate-900 tracking-tight leading-tight uppercase truncate">${headerText}</h4>
              <p class="text-[10px] text-red-600 font-bold uppercase tracking-wider">Official Athlete Mat Pass</p>
            </div>
          </div>

          <!-- ATHLETE PROFILE SECTION -->
          <div class="flex items-center gap-4 mb-4">
            <img class="w-20 h-20 rounded-2xl object-cover border-2 border-red-500 shadow-md shrink-0 bg-white" src="${s.avatar || DEFAULT_AVATAR}" alt="${s.name}"/>
            <div class="overflow-hidden space-y-1.5 flex-1">
              <h3 class="font-extrabold text-base text-slate-900 leading-tight break-words">${s.name}</h3>
              <div class="flex items-center gap-2 flex-wrap">
                <span class="text-xs font-mono font-extrabold text-red-600 bg-red-50 py-0.5 px-2 rounded-lg border border-red-200 inline-block">${s.studentId}</span>
                <span class="belt-badge ${getBeltClass(s.belt)} text-[10px] py-0.5 px-2">${s.belt}</span>
              </div>
              <div class="text-[10px] text-slate-500 font-medium">
                Gender: <strong class="text-slate-800">${s.gender || 'N/A'}</strong> • DOB: <strong class="text-slate-800">${s.dob || 'N/A'}</strong>
              </div>
            </div>
          </div>

          <!-- ATHLETE DETAILS BOX -->
          <div class="space-y-1.5 text-[11px] text-slate-600 bg-slate-50 p-3.5 rounded-2xl border border-slate-200 mb-4">
            <div><strong class="text-slate-800 font-bold">Contact Phone:</strong> <span class="font-mono font-bold text-slate-900">${s.contactPhone || s.phone || 'N/A'}</span></div>
            <div><strong class="text-slate-800 font-bold">Contact Email:</strong> <span class="font-medium text-slate-900 truncate block max-w-full">${s.contactEmail || s.email || 'N/A'}</span></div>
            <div><strong class="text-slate-800 font-bold">Address:</strong> <span class="break-words font-medium text-slate-700 block">${fullAddress}</span></div>
          </div>
        </div>

        <!-- BOTTOM QR CODE & DOJO METADATA -->
        <div class="pt-3 border-t-2 border-dashed border-slate-200 flex items-center justify-between">
          <div class="space-y-0.5">
            <div class="text-[10px] font-extrabold text-slate-800 uppercase tracking-wider">DOJO SCAN PASS</div>
            <div class="text-[9px] text-slate-400 font-mono">KAI Kiosk Check-In</div>
            <div class="text-[9px] text-red-600 font-mono font-bold">${s.studentId}</div>
          </div>
          <div class="w-16 h-16 bg-white p-1 border-2 border-slate-200 rounded-xl flex items-center justify-center shadow-sm shrink-0">
            ${qrDataBase64 ? `
              <img src="${qrDataBase64}" alt="QR Code: ${s.studentId}" class="w-full h-full object-contain rounded" id="qr-img-${s.id}"/>
            ` : `
              <button onclick="renderAllViews()" class="text-[8px] font-bold text-red-600 hover:underline text-center">Retry QR</button>
            `}
          </div>
        </div>

        <div class="pt-3 border-t border-slate-100 flex items-center justify-center no-print">
          <button onclick="downloadIDCardPNG('${s.id}')" class="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl transition text-center flex items-center justify-center gap-1.5 shadow text-xs">
            <span class="material-symbols-outlined text-sm">download</span><span>Download PNG</span>
          </button>
        </div>
      </div>
    `;
  }));

  container.innerHTML = studentCardsHtml.join('');
}

// PNG EXPORT ENGINE FOR STUDENT ID CARDS (LIGHT THEME + UNIFIED QR CODE)
async function downloadIDCardPNG(studentIdStr) {
  const student = appState.students.find(s => String(s.id) === String(studentIdStr) || String(s.studentId) === String(studentIdStr));
  if (!student) return;

  if (typeof html2canvas === 'undefined') {
    showToast('Image capture library not loaded.');
    return;
  }

  const logo = appState.config.logoUrl || DEFAULT_LOGO;
  const qrDataBase64 = await generateStudentQRCodeBase64(student.studentId);
  const fullAddress = [student.address, student.city, student.state, student.pincode].filter(Boolean).join(', ') || 'Pune, MH';

  const mount = document.createElement('div');
  mount.style.position = 'fixed';
  mount.style.left = '-9999px';
  mount.style.top = '-9999px';
  mount.style.width = '420px';
  mount.style.height = '660px';
  mount.style.backgroundColor = '#ffffff';
  mount.style.zIndex = '-9999';

  mount.innerHTML = `
    <div style="width: 420px; height: 660px; background: #ffffff; border-radius: 24px; overflow: hidden; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #0f172a; padding: 24px; box-sizing: border-box; display: flex; flex-direction: column; justify-content: space-between; border: 2px solid #cbd5e1; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.1);">
      
      <!-- TOP HEADER WITH RED ACCENT -->
      <div style="border-bottom: 2px solid #e2e8f0; padding-bottom: 14px; display: flex; align-items: center; gap: 12px;">
        <div style="width: 44px; height: 44px; background: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0; display: flex; align-items: center; justify-content: center; padding: 4px;">
          <img src="${logo}" alt="Logo" style="max-width: 100%; max-height: 100%; object-fit: contain;" onerror="this.onerror=null; this.src='https://www.karateacademyindia.com/logo.png';"/>
        </div>
        <div style="flex: 1;">
          <h2 style="margin: 0; font-size: 15px; font-weight: 900; color: #0f172a; letter-spacing: 0.5px; text-transform: uppercase;">KARATE ACADEMY INDIA</h2>
          <p style="margin: 2px 0 0 0; font-size: 10px; color: #dc2626; font-weight: 800; text-transform: uppercase; letter-spacing: 1px;">Official Athlete Training Pass</p>
        </div>
      </div>

      <!-- ATHLETE PROFILE SECTION -->
      <div style="display: flex; align-items: center; gap: 16px; margin-top: 8px;">
        <div style="width: 96px; height: 96px; border-radius: 20px; border: 3px solid #dc2626; overflow: hidden; background-color: #f1f5f9; flex-shrink: 0; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
          <img src="${student.avatar || DEFAULT_AVATAR}" alt="${student.name}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.onerror=null; this.src='${DEFAULT_AVATAR}';"/>
        </div>
        <div style="flex: 1; overflow: hidden;">
          <h3 style="margin: 0; font-size: 18px; font-weight: 900; color: #0f172a; line-height: 1.2;">${student.name}</h3>
          <div style="display: inline-block; font-family: monospace; font-size: 12px; color: #dc2626; font-weight: 900; background: #fef2f2; border: 1px solid #fecaca; border-radius: 6px; padding: 2px 8px; margin-top: 4px;">${student.studentId}</div>
          <div style="margin-top: 4px;">
            <span style="display: inline-block; background: #0f172a; color: #ffffff; font-size: 10px; font-weight: 800; padding: 2px 8px; border-radius: 6px; text-transform: uppercase;">${student.belt || 'White Belt'}</span>
          </div>
        </div>
      </div>

      <!-- ATHLETE DETAILS BOX -->
      <div style="background-color: #f8fafc; border-radius: 16px; padding: 14px 16px; border: 1px solid #e2e8f0; font-size: 11px; color: #334155; line-height: 1.6;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
          <span style="color: #64748b; font-weight: 700;">Gender / DOB:</span>
          <strong style="color: #0f172a;">${student.gender || 'Male'} • ${student.dob || 'N/A'}</strong>
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
          <span style="color: #64748b; font-weight: 700;">Primary Phone:</span>
          <strong style="color: #0f172a; font-family: monospace;">${student.contactPhone || student.phone || 'N/A'}</strong>
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
          <span style="color: #64748b; font-weight: 700;">Primary Email:</span>
          <strong style="color: #0f172a;">${student.contactEmail || student.email || 'N/A'}</strong>
        </div>
        <div style="display: flex; justify-content: space-between;">
          <span style="color: #64748b; font-weight: 700;">Address:</span>
          <strong style="color: #0f172a; max-width: 240px; text-align: right; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${fullAddress}</strong>
        </div>
      </div>

      <!-- BOTTOM SCAN SECTION -->
      <div style="border-top: 2px dashed #cbd5e1; padding-top: 14px; display: flex; align-items: center; justify-content: space-between;">
        <div>
          <div style="font-size: 11px; font-weight: 900; color: #0f172a; text-transform: uppercase;">DOJO KIOSK SCAN PASS</div>
          <div style="font-size: 9px; color: #64748b; margin-top: 2px;">Karate Academy India Honbu Portal</div>
          <div style="font-size: 9px; color: #dc2626; font-family: monospace; font-weight: 800; margin-top: 2px;">${student.studentId}</div>
        </div>
        <div style="width: 70px; height: 70px; background: #ffffff; border: 2px solid #e2e8f0; border-radius: 12px; padding: 4px; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
          <img src="${qrDataBase64}" alt="QR Code" style="width: 100%; height: 100%; object-fit: contain;"/>
        </div>
      </div>

    </div>
  `;

  document.body.appendChild(mount);

  html2canvas(mount, {
    scale: 3,
    useCORS: true,
    allowTaint: true,
    backgroundColor: '#ffffff',
    logging: false
  }).then(canvas => {
    document.body.removeChild(mount);

    const filename = `${student.studentId}_IDCard.png`;
    const link = document.createElement('a');
    link.download = filename;
    link.href = canvas.toDataURL('image/png');
    link.click();

    logActivity(`ID Card PNG Exported: ${student.name}`, `File: ${filename}`, 'idcard');
    showToast(`Digital ID Card saved: ${filename}`);
  }).catch(err => {
    if (document.body.contains(mount)) document.body.removeChild(mount);
    console.error('PNG Export Error:', err);
    showToast('Failed to export PNG ID card.');
  });
}

// 7. Financial Ledger & DYNAMIC AUTO-HEIGHT RECEIPT GENERATOR
function renderFinancials() {
  // Calculate Total Earnings and Total Dues
  const totalEarnings = appState.financials.reduce((sum, f) => sum + (f.finalPaid || f.amount || 0), 0);

  let totalDues = 0;
  const activeStudents = appState.students.filter(s => s.accountStatus !== 'inactive');

  activeStudents.forEach(s => {
    const studentInvoices = appState.financials.filter(f => String(f.studentId) === String(s.studentId));
    const paid = studentInvoices.reduce((sum, f) => sum + (f.finalPaid || f.amount || 0), 0);
    const expected = (s.monthlyFee || 2500);
    if (paid < expected) {
      totalDues += (expected - paid);
    }
  });

  appState.financials.forEach(f => {
    if (f.status === 'Unpaid' || f.status === 'Pending') {
      totalDues += Math.max(0, (f.origAmount || 0) - (f.finalPaid || 0));
    }
  });

  const earningsEl = document.getElementById('ledger-total-earnings');
  if (earningsEl) earningsEl.textContent = `₹${totalEarnings.toLocaleString('en-IN')}`;

  const duesEl = document.getElementById('ledger-total-dues');
  if (duesEl) duesEl.textContent = `₹${totalDues.toLocaleString('en-IN')}`;

  const tbody = document.getElementById('financials-table-body');
  if (!tbody) return;

  if (appState.financials.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="py-12 text-center text-xs text-slate-500 space-y-2">
          <span class="material-symbols-outlined text-4xl text-slate-300 block mb-1">payments</span>
          <strong class="text-slate-700 block">No financial transactions recorded</strong>
          <p>Click "Record Payment" to log tuition fee collections.</p>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = appState.financials.map(f => `
    <tr class="hover:bg-slate-50 transition" data-searchable>
      <td class="py-3.5 px-6 font-mono font-bold text-slate-900">${f.id}</td>
      <td class="py-3.5 px-6 font-bold text-slate-900">${f.studentName}</td>
      <td class="py-3.5 px-6 text-slate-500">₹${(f.origAmount || f.amount).toLocaleString('en-IN')}</td>
      <td class="py-3.5 px-6 text-red-600 font-bold">- ₹${(f.discount || 0).toLocaleString('en-IN')}</td>
      <td class="py-3.5 px-6 font-extrabold text-emerald-700">₹${(f.finalPaid || f.amount).toLocaleString('en-IN')}</td>
      <td class="py-3.5 px-6"><span class="status-badge status-paid">${f.status || 'Paid'}</span></td>
      <td class="py-3.5 px-6 text-right">
        <button onclick="openReceiptModal('${f.id}')" class="px-3 py-1 bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 font-bold text-[10px] rounded-lg transition">View Receipt</button>
      </td>
    </tr>
  `).join('');
}

function renderCanonicalReceiptHTML(inv) {
  const cfg = appState.config;
  const logo = cfg.logoUrl || DEFAULT_LOGO;
  const header = cfg.receiptHeader || 'KARATE ACADEMY INDIA';
  const subtitle = cfg.appSubtitle || 'Karate Academy India Honbu Dojo';
  const phone = cfg.contactPhone || '+917040925257';
  const email = cfg.contactEmail || 'support@conzex.com';
  const footerNote = cfg.receiptFooter || 'Thank you for training with Karate Academy India! For queries contact +917040925257.';

  const student = appState.students.find(s => String(s.studentId) === String(inv.studentId) || String(s.id) === String(inv.studentId)) || {};
  const studentName = inv.studentName || student.name || 'Student';
  const studentId = inv.studentId || student.studentId || 'N/A';
  const studentBelt = student.belt || 'Karate Athlete';
  const studentPhone = student.contactPhone || student.phone || 'N/A';
  const studentEmail = student.contactEmail || student.email || 'N/A';
  const origAmount = inv.origAmount || inv.amount || 0;
  const discount = inv.discount || 0;
  const finalPaid = inv.finalPaid || inv.amount || 0;
  const dueDate = inv.dueDate || new Date().toISOString().split('T')[0];
  const method = inv.paymentMethod || 'UPI / Cash';

  return `
    <div id="receipt-printable-content" class="p-6 bg-white rounded-2xl border border-slate-200 text-xs text-slate-800 space-y-4 font-sans">
      <!-- HEADER -->
      <div class="flex items-center justify-between border-b-2 border-red-600 pb-4">
        <div class="flex items-center gap-3">
          <img src="${logo}" alt="Logo" class="w-12 h-12 object-contain" onerror="this.onerror=null; this.src='${DEFAULT_AVATAR}';"/>
          <div>
            <h3 class="font-extrabold text-base text-slate-900 uppercase tracking-tight">${header}</h3>
            <p class="text-[11px] text-slate-500 font-medium">${subtitle}</p>
            <p class="text-[10px] text-slate-400 font-mono">Tel: ${phone} • Email: ${email}</p>
          </div>
        </div>
        <div class="text-right">
          <span class="inline-block px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-lg font-extrabold text-xs uppercase tracking-wider">PAID RECEIPT</span>
          <div class="text-[11px] font-mono font-bold text-red-600 mt-1">${inv.id}</div>
          <div class="text-[10px] text-slate-400">Date: ${dueDate}</div>
        </div>
      </div>

      <!-- BILLED TO -->
      <div class="grid grid-cols-2 gap-4 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
        <div>
          <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Billed To (Athlete)</span>
          <div class="font-extrabold text-slate-900 text-sm">${studentName}</div>
          <div class="text-[11px] text-slate-600 font-mono">ID: <strong class="text-red-600">${studentId}</strong> • ${studentBelt}</div>
        </div>
        <div class="text-right">
          <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Contact Information</span>
          <div class="text-[11px] text-slate-700 font-mono">${studentPhone}</div>
          <div class="text-[11px] text-slate-500 truncate">${studentEmail}</div>
        </div>
      </div>

      <!-- LINE ITEMS TABLE -->
      <div class="border border-slate-200 rounded-xl overflow-hidden">
        <table class="w-full text-left text-xs">
          <thead class="bg-slate-100 text-slate-700 font-bold uppercase text-[10px]">
            <tr>
              <th class="py-2.5 px-4">Description</th>
              <th class="py-2.5 px-4 text-center">Plan Period</th>
              <th class="py-2.5 px-4 text-right">Fee (₹)</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr>
              <td class="py-3 px-4 font-semibold text-slate-900">
                Tuition & Training Mat Dues
                <div class="text-[10px] text-slate-400 font-normal">Method: ${method}</div>
              </td>
              <td class="py-3 px-4 text-center text-slate-600 font-medium">Standard Term</td>
              <td class="py-3 px-4 text-right font-mono font-bold text-slate-900">₹${origAmount.toLocaleString('en-IN')}</td>
            </tr>
            ${discount > 0 ? `
              <tr class="bg-amber-50/50">
                <td class="py-2 px-4 text-amber-900 font-semibold" colspan="2">Concession / Discount Applied</td>
                <td class="py-2 px-4 text-right font-mono font-bold text-red-600">- ₹${discount.toLocaleString('en-IN')}</td>
              </tr>
            ` : ''}
          </tbody>
          <tfoot class="bg-slate-50 border-t border-slate-200 font-extrabold text-xs">
            <tr>
              <td class="py-2.5 px-4 text-slate-900" colspan="2">Total Amount Received:</td>
              <td class="py-2.5 px-4 text-right text-emerald-700 font-mono text-sm">₹${finalPaid.toLocaleString('en-IN')}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <!-- FOOTER NOTE -->
      <div class="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
        <p class="leading-relaxed flex-1">${footerNote}</p>
        <div class="text-right font-mono shrink-0 pl-3">
          <span class="text-emerald-600 font-bold inline-flex items-center gap-1">
            <span class="material-symbols-outlined text-xs">verified</span>
            <span>Payment Verified</span>
          </span>
        </div>
      </div>
    </div>
  `;
}

function openReceiptModal(invoiceId) {
  if (appState.userRole === 'receptionist') return;

  const inv = appState.financials.find(f => f.id === invoiceId);
  if (!inv) return;

  const wrapper = document.getElementById('receipt-card-wrapper');
  if (wrapper) {
    wrapper.innerHTML = renderCanonicalReceiptHTML(inv);

    const btnDownload = document.getElementById('btn-download-receipt-pdf');
    if (btnDownload) btnDownload.onclick = () => downloadReceiptPDF(inv.id);

    const btnPrint = document.getElementById('btn-print-receipt');
    if (btnPrint) btnPrint.onclick = () => printReceipt(inv.id);

    const btnWhatsapp = document.getElementById('btn-send-whatsapp');
    if (btnWhatsapp) btnWhatsapp.onclick = () => shareReceiptWhatsApp(inv);

    const btnEmail = document.getElementById('btn-send-email');
    if (btnEmail) btnEmail.onclick = () => shareReceiptEmail(inv);

    document.getElementById('payment-receipt-modal')?.classList.remove('hidden');
  }
}

function downloadReceiptPDF(invoiceId) {
  const inv = appState.financials.find(f => f.id === invoiceId);
  if (!inv) return;

  const el = document.getElementById('receipt-printable-content') || document.getElementById('receipt-card-wrapper');
  if (!el) return;

  const filename = `${invoiceId}_Receipt.pdf`;
  if (typeof html2pdf !== 'undefined') {
    const opt = {
      margin: 8,
      filename: filename,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2.5, useCORS: true, logging: false },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };
    html2pdf().set(opt).from(el).save().then(() => {
      logActivity(`PDF Receipt Exported: ${invoiceId}`, `File: ${filename}`, 'payment');
      showToast(`Receipt PDF exported: ${filename}`);
    }).catch(err => {
      console.error('PDF Export Error:', err);
      showToast('Failed to export PDF receipt.');
    });
  } else {
    showToast('PDF generator library not loaded.');
  }
}

async function generateReceiptPDFBlob(invoiceId) {
  const el = document.getElementById('receipt-printable-content') || document.getElementById('receipt-card-wrapper');
  if (!el || typeof html2pdf === 'undefined') return null;

  const elementHeight = el.scrollHeight || 500;
  const dynamicPtHeight = Math.max(520, Math.round(elementHeight * 0.75) + 30);

  const opt = {
    margin: 10,
    filename: `${invoiceId}_Receipt.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true },
    jsPDF: { unit: 'pt', format: [420, dynamicPtHeight], orientation: 'portrait' }
  };

  const pdfBlob = await html2pdf().set(opt).from(el).output('blob');
  return new File([pdfBlob], `${invoiceId}_Receipt.pdf`, { type: 'application/pdf' });
}

async function shareReceiptWhatsApp(inv) {
  try {
    const file = await generateReceiptPDFBlob(inv.id);
    if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({
        files: [file],
        title: `${appState.config.appSubtitle} Receipt #${inv.id}`,
        text: `Fee Receipt #${inv.id} for ${inv.studentName}`
      });
      logActivity(`Receipt Shared via WhatsApp: ${inv.id}`, `Athlete: ${inv.studentName}`, 'payment');
      showToast('Receipt PDF shared via WhatsApp');
      return;
    }
  } catch (e) { }

  downloadReceiptPDF(inv.id);
  const student = appState.students.find(s => String(s.studentId) === String(inv.studentId));
  let phone = student?.contactPhone || student?.phone || '7040925257';
  phone = phone.replace(/[^0-9]/g, '');
  if (phone.length === 10) phone = '91' + phone;

  const text = encodeURIComponent(`*${appState.config.appSubtitle.toUpperCase()} - RECEIPT CONFIRMATION*\n\nDear *${inv.studentName}* (${inv.studentId}),\n\nWe have received your payment of *₹${(inv.finalPaid || inv.amount).toLocaleString('en-IN')}*.\nInvoice #: *${inv.id}*\nPayment Method: ${inv.paymentMethod}\nStatus: PAID / VERIFIED\n\nReceipt PDF downloaded to device. Thank you!`);
  window.open(`https://wa.me/${phone}?text=${text}`, '_blank');
}

async function shareReceiptEmail(inv) {
  try {
    const file = await generateReceiptPDFBlob(inv.id);
    if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({
        files: [file],
        title: `${appState.config.appSubtitle} Receipt #${inv.id}`,
        text: `Fee Receipt #${inv.id} for ${inv.studentName}`
      });
      logActivity(`Receipt Shared via Email: ${inv.id}`, `Athlete: ${inv.studentName}`, 'payment');
      showToast('Receipt PDF shared via Email');
      return;
    }
  } catch (e) { }

  downloadReceiptPDF(inv.id);
  const student = appState.students.find(s => String(s.studentId) === String(inv.studentId));
  const email = student?.contactEmail || student?.email || appState.config.contactEmail || 'support@conzex.com';
  const subject = encodeURIComponent(`${appState.config.appSubtitle} - Fee Receipt #${inv.id}`);
  const body = encodeURIComponent(`Dear ${inv.studentName},\n\nThank you for your fee payment of ₹${(inv.finalPaid || inv.amount).toLocaleString('en-IN')} for Invoice #${inv.id}.\n\nPayment Method: ${inv.paymentMethod}\nStatus: Paid (Balance ₹0)\n\nRegards,\n${appState.config.appSubtitle}`);

  window.open(`mailto:${email}?subject=${subject}&body=${body}`, '_blank');
}

function printReceipt(invoiceId) {
  const el = document.getElementById('receipt-printable-content') || document.getElementById('receipt-card-wrapper');
  const printSec = document.getElementById('print-section');
  if (el && printSec) {
    printSec.innerHTML = '';
    printSec.appendChild(el.cloneNode(true));
    window.print();
  }
}

// 8. Admin & Manager User Management Controller
function renderAdminUsersTable() {
  const currentRole = appState.userRole;

  let usersToRender = appState.users;
  if (currentRole !== 'admin') {
    usersToRender = usersToRender.filter(u => String(u.username).toLowerCase() !== 'admin');
  }

  const generateRowsHtml = () => {
    if (usersToRender.length === 0) {
      return `<tr><td colspan="6" class="py-4 text-center text-slate-400">No user accounts found.</td></tr>`;
    }

    return usersToRender.map((u, idx) => {
      const isRootAdmin = (u.username === 'admin');
      const isManagerRole = (currentRole === 'manager');
      const canModify = (currentRole === 'admin' && !isRootAdmin) || (isManagerRole && u.role !== 'admin');
      const isSelected = (u.username === appState.currentUser?.username);
      const staffId = u.staffId || `KAISTF2026${String(idx + 1).padStart(2, '0')}`;
      u.staffId = staffId;

      const salaryVal = u.monthlySalary || (u.role === 'manager' ? 25000 : u.role === 'receptionist' ? 15000 : 18000);

      return `
        <tr class="${isSelected ? 'bg-amber-100/90 font-bold text-amber-950 border-l-4 border-amber-500 shadow-sm' : 'bg-amber-50/40 hover:bg-amber-100/60 text-slate-800 border-b border-amber-200/50'} transition">
          <td class="py-3 px-4 font-extrabold">
            <div>${u.name} ${isSelected ? '<span class="text-[9px] bg-amber-200 text-amber-900 px-1.5 py-0.5 rounded ml-1 font-bold">(You)</span>' : ''}</div>
            <div class="text-[10px] text-slate-400 font-mono">${u.email || u.username}</div>
          </td>
          <td class="py-3 px-4 font-mono text-xs font-bold text-blue-600">${staffId}</td>
          <td class="py-3 px-4">
            ${canModify ? `
              <select onchange="updateUserRole('${u.id}', this.value)" class="px-2 py-1 bg-amber-100/80 border border-amber-300 rounded-lg text-xs font-bold text-amber-950">
                ${currentRole === 'admin' ? `<option value="admin" ${u.role === 'admin' ? 'selected' : ''}>Admin</option>` : ''}
                <option value="manager" ${u.role === 'manager' ? 'selected' : ''}>Manager</option>
                <option value="receptionist" ${u.role === 'receptionist' ? 'selected' : ''}>Receptionist</option>
                <option value="viewer" ${u.role === 'viewer' ? 'selected' : ''}>Viewer</option>
              </select>
            ` : `
              <span class="role-badge role-${u.role}">${u.role.toUpperCase()}</span>
            `}
          </td>
          <td class="py-3 px-4 font-mono font-bold text-slate-800">
            ₹${salaryVal.toLocaleString('en-IN')}
          </td>
          <td class="py-3 px-4">
            <span class="status-badge ${u.status === 'disabled' ? 'status-inactive' : 'status-active'} text-[9px]">${u.status || 'active'}</span>
          </td>
          <td class="py-3 px-4 text-right space-x-1 whitespace-nowrap">
            ${isRootAdmin ? `
              <span class="text-[10px] text-amber-700 font-extrabold uppercase bg-amber-200/80 px-2 py-0.5 rounded border border-amber-300">Root Admin</span>
            ` : u.role === 'admin' && isManagerRole ? `
              <span class="text-[10px] text-slate-400 font-bold">Admin Account</span>
            ` : canModify ? `
              <div class="inline-flex items-center gap-1">
                <button onclick="openStaffInvoiceModal('${u.id}')" class="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 font-bold text-[10px] rounded-lg inline-flex items-center gap-1 shadow-sm" title="Generate Salary Invoice Payslip">
                  <span class="material-symbols-outlined text-xs">receipt_long</span>
                  <span>Payslip</span>
                </button>
                <button onclick="toggleUserDisabled('${u.id}')" class="px-2 py-1 bg-amber-200/70 hover:bg-amber-300 text-amber-950 font-bold text-[10px] rounded-lg">
                  ${u.status === 'disabled' ? 'Enable' : 'Disable'}
                </button>
                <button onclick="deleteUserAccount('${u.id}')" class="px-2 py-1 bg-red-100 hover:bg-red-200 text-red-700 font-bold text-[10px] rounded-lg">
                  Delete
                </button>
              </div>
            ` : `
              <span class="text-[10px] text-slate-400 font-bold">Protected</span>
            `}
          </td>
        </tr>
      `;
    }).join('');
  };

  const adminTbody = document.getElementById('admin-users-table-body');
  if (adminTbody) adminTbody.innerHTML = generateRowsHtml();

  const mgrTbody = document.getElementById('manager-users-table-body');
  if (mgrTbody) mgrTbody.innerHTML = generateRowsHtml();
}

function renderAdminStudentsTable() {
  const tbody = document.getElementById('admin-students-table-body');
  if (!tbody) return;

  if (appState.students.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="py-4 text-center text-slate-400">No students registered yet.</td></tr>`;
    return;
  }

  tbody.innerHTML = appState.students.map(s => {
    const isInactive = s.accountStatus === 'inactive';
    return `
      <tr class="hover:bg-slate-50 transition ${isInactive ? 'opacity-60 bg-slate-50/50' : ''}">
        <td class="py-3 px-4 font-mono font-bold text-red-600 text-xs">${s.studentId}</td>
        <td class="py-3 px-4">
          <div class="flex items-center gap-2.5">
            <img class="w-8 h-8 rounded-full object-cover border border-slate-200 shadow-sm shrink-0" src="${s.avatar || DEFAULT_AVATAR}" alt="${s.name}"/>
            <div class="overflow-hidden">
              <div class="font-bold text-xs text-slate-900 truncate">${s.name}</div>
              <div class="text-[10px] text-slate-400">${s.contactPhone || s.phone || 'N/A'} • ${s.contactEmail || s.email || ''}</div>
            </div>
          </div>
        </td>
        <td class="py-3 px-4">
          <span class="belt-badge ${getBeltClass(s.belt)} text-[10px] py-0.5 px-2">${s.belt}</span>
        </td>
        <td class="py-3 px-4">
          <span class="status-badge ${isInactive ? 'status-inactive' : 'status-active'} text-[10px]">${isInactive ? 'Inactive' : 'Active'}</span>
        </td>
        <td class="py-3 px-4 text-right">
          <div class="inline-flex items-center gap-1">
            <button onclick="openStudentDetailsModal('${s.id}')" class="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-[10px] rounded-lg transition flex items-center gap-1 shrink-0">
              <span class="material-symbols-outlined text-xs">visibility</span>
              <span>Details</span>
            </button>
            <button onclick="openEditStudentModal('${s.id}')" class="px-2.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-[10px] rounded-lg transition flex items-center gap-1 shrink-0">
              <span class="material-symbols-outlined text-xs">edit</span>
              <span>Edit</span>
            </button>
            <button onclick="deleteStudent('${s.id}')" class="px-2 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 font-bold text-[10px] rounded-lg transition flex items-center gap-1 shrink-0" title="Delete Student Profile">
              <span class="material-symbols-outlined text-xs">delete</span>
              <span>Delete</span>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function renderAdminLogsTable() {
  const tbody = document.getElementById('admin-logs-table-body');
  if (!tbody) return;

  if (appState.activityLogs.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" class="py-4 text-center text-slate-400">No activity logs yet.</td></tr>`;
    return;
  }

  tbody.innerHTML = appState.activityLogs.map(log => {
    const catColors = {
      enrollment: 'bg-blue-50 text-blue-700 border-blue-200',
      payment: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      checkin: 'bg-purple-50 text-purple-700 border-purple-200',
      system: 'bg-slate-100 text-slate-600 border-slate-200',
      user: 'bg-amber-50 text-amber-700 border-amber-200',
      idcard: 'bg-red-50 text-red-600 border-red-200'
    };
    const catClass = catColors[log.type] || catColors.system;

    return `
      <tr class="hover:bg-slate-50 transition">
        <td class="py-2.5 px-4 font-mono text-[10px] text-slate-500 whitespace-nowrap">${log.timestamp || ''}</td>
        <td class="py-2.5 px-4 font-bold text-xs text-slate-900">${log.title || ''}</td>
        <td class="py-2.5 px-4 text-[11px] text-slate-500">${log.subtitle || ''}</td>
        <td class="py-2.5 px-4 text-right">
          <span class="text-[9px] font-bold px-2 py-0.5 rounded border ${catClass} uppercase">${log.type || 'system'}</span>
        </td>
      </tr>
    `;
  }).join('');
}

function loadSmtpConfigForm() {
  const smtp = appState.config.smtp || {};
  const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
  setVal('smtp-host', smtp.host || 'smtp.gmail.com');
  setVal('smtp-port', smtp.port || '465');
  setVal('smtp-encryption', smtp.encryption || 'ssl');
  setVal('smtp-user', smtp.username);
  setVal('smtp-pass', smtp.password);
  setVal('smtp-from-name', smtp.fromName);
  setVal('smtp-from-email', smtp.fromEmail);

  const guideBox = document.getElementById('smtp-gmail-guide-box');
  if (guideBox) {
    const isGmail = String(smtp.host || '').toLowerCase().includes('gmail') || String(smtp.host || '').toLowerCase().includes('google');
    if (isGmail || !smtp.host) guideBox.classList.remove('hidden');
    else guideBox.classList.add('hidden');
  }
}

window.applySmtpPreset = function (provider) {
  const hostEl = document.getElementById('smtp-host');
  const portEl = document.getElementById('smtp-port');
  const encEl = document.getElementById('smtp-encryption');
  const userEl = document.getElementById('smtp-user');
  const guideBox = document.getElementById('smtp-gmail-guide-box');

  if (provider === 'gmail') {
    if (hostEl) hostEl.value = 'smtp.gmail.com';
    if (portEl) portEl.value = '465';
    if (encEl) encEl.value = 'ssl';
    if (guideBox) guideBox.classList.remove('hidden');
    showToast('Applied Gmail preset (smtp.gmail.com:465 SSL)');
  } else if (provider === 'hostinger') {
    if (hostEl) hostEl.value = 'smtp.hostinger.com';
    if (portEl) portEl.value = '465';
    if (encEl) encEl.value = 'ssl';
    if (guideBox) guideBox.classList.add('hidden');
    showToast('Applied Hostinger preset (smtp.hostinger.com:465 SSL)');
  } else if (provider === 'zoho') {
    if (hostEl) hostEl.value = 'smtp.zoho.com';
    if (portEl) portEl.value = '465';
    if (encEl) encEl.value = 'ssl';
    if (guideBox) guideBox.classList.add('hidden');
    showToast('Applied Zoho Mail preset (smtp.zoho.com:465 SSL)');
  } else if (provider === 'outlook') {
    if (hostEl) hostEl.value = 'smtp.office365.com';
    if (portEl) portEl.value = '587';
    if (encEl) encEl.value = 'tls';
    if (guideBox) guideBox.classList.add('hidden');
    showToast('Applied Outlook preset (smtp.office365.com:587 TLS)');
  } else {
    const userDomain = (userEl?.value || '').includes('@') ? (userEl.value.split('@')[1] || 'yourdomain.com') : 'yourdomain.com';
    if (hostEl) hostEl.value = 'mail.' + userDomain;
    if (portEl) portEl.value = '465';
    if (encEl) encEl.value = 'ssl';
    if (guideBox) guideBox.classList.add('hidden');
    showToast('Applied Custom SMTP preset (Port 465 SSL)');
  }
};

function updateUserRole(userId, newRole) {
  const user = appState.users.find(u => String(u.id) === String(userId));
  if (!user || user.username === 'admin') return;

  if (appState.userRole === 'manager' && (newRole === 'admin' || user.role === 'admin')) {
    showLightbox({ title: 'Permission Denied', message: 'Managers cannot create or assign Admin accounts.', type: 'error' });
    return;
  }

  if (user.role === 'manager' && newRole !== 'manager') {
    const activeManagers = appState.users.filter(u => u.role === 'manager' && u.status !== 'disabled');
    if (activeManagers.length <= 1) {
      showLightbox({
        title: 'Action Restricted',
        message: 'At least one active Manager account is required in the system. You cannot change the role of the sole remaining Manager account.',
        type: 'warning'
      });
      renderAdminUsersTable();
      return;
    }
  }

  user.role = newRole;
  logActivity(`User Role Updated: ${user.username}`, `Assigned role ${newRole.toUpperCase()}`, 'user');

  saveDatabase();
  renderAdminUsersTable();
  showToast(`Updated role for ${user.username} to ${newRole.toUpperCase()}`);
}

function toggleUserDisabled(userId) {
  const user = appState.users.find(u => String(u.id) === String(userId));
  if (!user || user.username === 'admin') return;

  if (appState.userRole === 'manager' && user.role === 'admin') {
    showLightbox({ title: 'Permission Denied', message: 'Managers cannot disable Admin accounts.', type: 'error' });
    return;
  }

  if (user.role === 'manager' && user.status !== 'disabled') {
    const activeManagers = appState.users.filter(u => u.role === 'manager' && u.status !== 'disabled');
    if (activeManagers.length <= 1) {
      showLightbox({
        title: 'Action Restricted',
        message: 'At least one active Manager account is required in the system. You cannot disable the sole remaining Manager account.',
        type: 'warning'
      });
      return;
    }
  }

  user.status = (user.status === 'disabled') ? 'active' : 'disabled';
  logActivity(`User Status Changed: ${user.username}`, `Status updated to ${user.status.toUpperCase()}`, 'user');

  saveDatabase();
  renderAdminUsersTable();
  showToast(`User ${user.username} ${user.status}`);
}

function deleteUserAccount(userId) {
  const user = appState.users.find(u => String(u.id) === String(userId));
  if (!user || user.username === 'admin') return;

  if (appState.userRole === 'manager' && user.role === 'admin') {
    showLightbox({ title: 'Permission Denied', message: 'Managers cannot delete Admin accounts.', type: 'error' });
    return;
  }

  if (user.role === 'manager') {
    const activeManagers = appState.users.filter(u => u.role === 'manager');
    if (activeManagers.length <= 1) {
      showLightbox({
        title: 'Deletion Blocked',
        message: 'At least one active Manager account is required in the system. You cannot delete the sole remaining Manager account.',
        type: 'warning'
      });
      return;
    }
  }

  showLightbox({
    title: 'Delete User Account',
    message: `Are you sure you want to permanently delete user account "${user.username}"?`,
    type: 'confirm',
    confirmText: 'Delete Account',
    onResult: (confirmed) => {
      if (confirmed) {
        appState.users = appState.users.filter(u => String(u.id) !== String(userId));
        logActivity(`User Deleted: ${user.username}`, `Role was ${user.role.toUpperCase()}`, 'user');
        saveDatabase();
        renderAdminUsersTable();
        showToast(`Deleted user account: ${user.username}`);
      }
    }
  });
}

// Belt CSS Helper
function getBeltClass(belt) {
  switch (belt) {
    case 'White Belt': return 'belt-white';
    case 'Yellow Belt': return 'belt-yellow';
    case 'Orange Belt': return 'belt-orange';
    case 'Green Belt': return 'belt-green';
    case 'Blue Belt': return 'belt-blue';
    case 'Purple Belt': return 'belt-purple';
    case 'Brown Belt': return 'belt-brown';
    case 'Black Belt': return 'belt-black';
    default: return 'belt-white';
  }
}

// ==========================================
// PHOTO UPLOADER & FORM CALCULATORS
// ==========================================
function setupPhotoUploader() {
  const fileInput = document.getElementById('new-student-photo-file');
  const urlInput = document.getElementById('new-student-photo-url');
  const previewImg = document.getElementById('photo-preview-img');

  fileInput?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 3 * 1024 * 1024) {
        showLightbox({ title: 'File Size Warning', message: 'Image file size must be less than 3MB.', type: 'warning' });
        fileInput.value = '';
        return;
      }
      const reader = new FileReader();
      reader.onload = (evt) => {
        currentPhotoBase64 = evt.target.result;
        if (previewImg) previewImg.src = currentPhotoBase64;
      };
      reader.readAsDataURL(file);
    }
  });

  urlInput?.addEventListener('input', (e) => {
    const url = e.target.value.trim();
    if (url && previewImg) {
      currentPhotoBase64 = url;
      previewImg.src = url;
    }
  });
}

// GLOBALLY UNIQUE PERMANENT STUDENT ID ENGINE (KAISTD + YYYY + 2-digit auto-increment: KAISTD202601, KAISTD202602...)
function generateKAIStudentId() {
  const year = new Date().getFullYear();
  const prefix = `KAISTD${year}`;

  let maxSeq = 0;
  const idRegex = new RegExp(`^(?:KAISTD|KAI)${year}(\\d+)$`, 'i');

  (appState.students || []).forEach(s => {
    if (s.studentId) {
      const match = String(s.studentId).match(idRegex);
      if (match) {
        const numPart = parseInt(match[1], 10);
        if (!isNaN(numPart) && numPart > maxSeq) maxSeq = numPart;
      }
    }
  });

  (appState.financials || []).forEach(f => {
    if (f.studentId) {
      const match = String(f.studentId).match(idRegex);
      if (match) {
        const numPart = parseInt(match[1], 10);
        if (!isNaN(numPart) && numPart > maxSeq) maxSeq = numPart;
      }
    }
  });

  (appState.pendingAdmissions || []).forEach(a => {
    if (a.assignedStudentId) {
      const match = String(a.assignedStudentId).match(idRegex);
      if (match) {
        const numPart = parseInt(match[1], 10);
        if (!isNaN(numPart) && numPart > maxSeq) maxSeq = numPart;
      }
    }
  });

  const nextSeq = maxSeq + 1;
  const seqStr = nextSeq < 100 ? String(nextSeq).padStart(2, '0') : String(nextSeq);
  return `${prefix}${seqStr}`;
}

// GLOBALLY UNIQUE PERMANENT STAFF ID ENGINE (KAISTF + YYYY + 2-digit auto-increment: KAISTF202601, KAISTF202602...)
function generateKAIStaffId() {
  const year = new Date().getFullYear();
  const prefix = `KAISTF${year}`;

  let maxSeq = 0;
  const idRegex = new RegExp(`^KAISTF${year}(\\d+)$`, 'i');

  (appState.users || []).forEach(u => {
    if (u.staffId) {
      const match = String(u.staffId).match(idRegex);
      if (match) {
        const numPart = parseInt(match[1], 10);
        if (!isNaN(numPart) && numPart > maxSeq) maxSeq = numPart;
      }
    }
  });

  const nextSeq = maxSeq + 1;
  const seqStr = nextSeq < 100 ? String(nextSeq).padStart(2, '0') : String(nextSeq);
  return `${prefix}${seqStr}`;
}

// INVOICE NUMBER GENERATION: STUDENT_ID + ALPHABETIC AUTO-INCREMENT (KAISTD202601A, KAISTD202601B...)
function generateKAIInvoiceNo(studentId) {
  const sid = studentId || generateKAIStudentId();

  // Find all existing invoices associated with this student
  const existingInvoices = (appState.financials || []).filter(inv =>
    String(inv.studentId) === String(sid) || String(inv.id).startsWith(sid)
  );

  let maxSuffixVal = -1;
  existingInvoices.forEach(inv => {
    const invId = String(inv.id || '');
    if (invId.startsWith(sid)) {
      const suffix = invId.substring(sid.length).toUpperCase();
      if (suffix && /^[A-Z]+$/.test(suffix)) {
        let val = 0;
        for (let i = 0; i < suffix.length; i++) {
          val = val * 26 + (suffix.charCodeAt(i) - 65 + 1);
        }
        val = val - 1;
        if (val > maxSuffixVal) maxSuffixVal = val;
      }
    }
  });

  const nextVal = maxSuffixVal + 1;
  let suffixStr = '';
  let num = nextVal + 1;
  while (num > 0) {
    let rem = (num - 1) % 26;
    suffixStr = String.fromCharCode(65 + rem) + suffixStr;
    num = Math.floor((num - 1) / 26);
  }

  return `${sid}${suffixStr || 'A'}`;
}

// STAFF SALARY INVOICE NUMBER GENERATION: STAFF_ID + ALPHABETIC AUTO-INCREMENT (KAISTF202601A, KAISTF202601B...)
function generateKAIStaffInvoiceNo(staffId) {
  const stfId = staffId || generateKAIStaffId();

  const existingInvoices = (appState.staffFinancials || appState.financials || []).filter(inv =>
    String(inv.staffId) === String(stfId) || String(inv.id).startsWith(stfId)
  );

  let maxSuffixVal = -1;
  existingInvoices.forEach(inv => {
    const invId = String(inv.id || '');
    if (invId.startsWith(stfId)) {
      const suffix = invId.substring(stfId.length).toUpperCase();
      if (suffix && /^[A-Z]+$/.test(suffix)) {
        let val = 0;
        for (let i = 0; i < suffix.length; i++) {
          val = val * 26 + (suffix.charCodeAt(i) - 65 + 1);
        }
        val = val - 1;
        if (val > maxSuffixVal) maxSuffixVal = val;
      }
    }
  });

  const nextVal = maxSuffixVal + 1;
  let suffixStr = '';
  let num = nextVal + 1;
  while (num > 0) {
    let rem = (num - 1) % 26;
    suffixStr = String.fromCharCode(65 + rem) + suffixStr;
    num = Math.floor((num - 1) / 26);
  }

  return `${stfId}${suffixStr || 'A'}`;
}

async function dispatchAutoEmailNotification(category, payload) {
  if (!payload) return;
  const targetEmail = payload.email || payload.contactEmail || payload.studentEmail || payload.targetEmail;
  const targetName = payload.name || payload.studentName || payload.targetName || 'Athlete';
  if (!targetEmail) return;

  try {
    const token = localStorage.getItem('kai_token') || sessionStorage.getItem('kai_token');

    if (category === 'registration' || category === 'id_card') {
      await fetch('/api/students/idcard-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          studentId: payload.studentId,
          targetEmail: targetEmail,
          targetName: targetName,
          belt: payload.belt
        })
      });
    } else if (category === 'receipt' && payload.id) {
      await fetch('/api/email-receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          invoiceId: payload.id,
          studentEmail: targetEmail,
          studentName: targetName,
          invoiceObj: payload
        })
      });
    } else {
      await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          category: category,
          targetEmail: targetEmail,
          targetName: targetName,
          invoiceData: payload
        })
      });
    }
  } catch (err) {
    console.log('Auto email dispatch note:', err);
  }
}

function openEditStudentModal(idStr) {
  if (appState.userRole === 'viewer' || appState.userRole === 'receptionist') {
    showLightbox({ title: 'Permission Denied', message: 'Only Managers and Admins can edit student records.', type: 'error' });
    return;
  }

  const student = appState.students.find(s => String(s.id) === String(idStr) || String(s.studentId) === String(idStr));
  if (!student) return;

  document.getElementById('edit-student-id-hidden').value = student.id;
  document.getElementById('edit-student-name').value = student.name || '';
  document.getElementById('edit-student-gender').value = student.gender || 'Male';
  document.getElementById('edit-student-dob').value = student.dob || '';
  document.getElementById('edit-student-belt').value = student.belt || 'White Belt';
  document.getElementById('edit-student-phone').value = student.contactPhone || student.phone || '';
  document.getElementById('edit-student-email').value = student.contactEmail || student.email || '';
  document.getElementById('edit-student-emerg-name').value = student.emergencyContactPerson || student.emergencyContact || '';
  document.getElementById('edit-student-emerg-phone').value = student.emergencyContactPhone || '';
  document.getElementById('edit-student-address').value = student.address || '';
  document.getElementById('edit-student-city').value = student.city || 'Pune';
  document.getElementById('edit-student-state').value = student.state || 'MH';
  document.getElementById('edit-student-pincode').value = student.pincode || '';
  document.getElementById('edit-student-plan').value = student.membershipPlan || 'Monthly Plan';
  document.getElementById('edit-student-monthly-fee').value = student.monthlyFee || 2500;
  document.getElementById('edit-student-status').value = student.accountStatus || 'active';
  document.getElementById('edit-student-avatar').value = student.avatar || '';

  document.getElementById('edit-student-modal')?.classList.remove('hidden');
}

function setupFormsAndCalculators() {
  const openAddBtns = document.querySelectorAll('.open-add-student-modal');
  const closeAddBtn = document.getElementById('close-add-student-modal');
  const addModal = document.getElementById('add-student-modal');

  openAddBtns.forEach(btn => btn.addEventListener('click', () => {
    if (appState.userRole === 'viewer' || appState.userRole === 'receptionist') {
      showLightbox({ title: 'Permission Denied', message: 'Receptionist and Viewer accounts are not authorized to register students.', type: 'error' });
      return;
    }
    addModal?.classList.remove('hidden');
  }));
  closeAddBtn?.addEventListener('click', () => addModal?.classList.add('hidden'));

  const openPayBtns = document.querySelectorAll('.open-record-payment-modal');
  const closePayBtn = document.getElementById('close-record-payment-modal');
  const payModal = document.getElementById('record-payment-modal');

  openPayBtns.forEach(btn => btn.addEventListener('click', () => {
    if (appState.userRole === 'viewer' || appState.userRole === 'receptionist') {
      showLightbox({ title: 'Permission Denied', message: 'Financial payments are restricted.', type: 'error' });
      return;
    }
    populatePaymentStudentDropdown();
    payModal?.classList.remove('hidden');
  }));
  closePayBtn?.addEventListener('click', () => payModal?.classList.add('hidden'));

  document.getElementById('close-receipt-modal')?.addEventListener('click', () => {
    document.getElementById('payment-receipt-modal')?.classList.add('hidden');
  });

  const planSelect = document.getElementById('new-student-plan');
  const discInput = document.getElementById('new-student-discount');
  const uniformCheck = document.getElementById('new-student-uniform-check');

  function updateRegCalc() {
    const planFee = parseInt(planSelect?.value || appState.config.monthlyFee || 2500);
    let discVal = parseInt(discInput?.value || 0);

    if (isNaN(discVal) || discVal < 0) discVal = 0;
    if (discVal > planFee) discVal = planFee;
    if (discInput) discInput.value = discVal;

    const regFee = appState.config.regFee || 1000;
    const uniformFee = uniformCheck?.checked ? (appState.config.uniformFee || 2500) : 0;
    const finalTotal = (planFee + regFee + uniformFee) - discVal;

    document.getElementById('calc-reg-display').textContent = `₹${regFee.toLocaleString('en-IN')}`;
    document.getElementById('calc-orig').textContent = `₹${planFee.toLocaleString('en-IN')}`;

    const unifRow = document.getElementById('calc-uniform-row');
    if (unifRow) {
      if (uniformCheck?.checked) {
        unifRow.className = 'flex justify-between text-slate-600';
      } else {
        unifRow.className = 'flex justify-between text-slate-400 line-through';
      }
    }

    document.getElementById('calc-disc').textContent = `- ₹${discVal.toLocaleString('en-IN')}`;
    document.getElementById('calc-final').textContent = `₹${finalTotal.toLocaleString('en-IN')}`;
  }

  planSelect?.addEventListener('change', updateRegCalc);
  discInput?.addEventListener('input', updateRegCalc);
  uniformCheck?.addEventListener('change', updateRegCalc);

  // STUDENT REGISTRATION FORM SUBMISSION
  const addForm = document.getElementById('add-student-form');
  addForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (appState.userRole === 'viewer') {
      showLightbox({ title: 'Permission Denied', message: 'Viewer role is read-only.', type: 'error' });
      return;
    }

    const firstName = document.getElementById('new-student-first-name').value.trim();
    const middleName = document.getElementById('new-student-middle-name').value.trim();
    const lastName = document.getElementById('new-student-last-name').value.trim();

    const name = [firstName, middleName, lastName].filter(Boolean).join(' ');

    const belt = document.getElementById('new-student-belt').value;
    const gender = document.getElementById('new-student-gender').value;
    const dob = document.getElementById('new-student-dob').value;

    const address = document.getElementById('new-student-address').value.trim();
    const city = document.getElementById('new-student-city').value.trim();
    const state = document.getElementById('new-student-state').value.trim();
    const pincode = document.getElementById('new-student-pincode').value.trim();

    const contactName = document.getElementById('new-student-contact-name').value.trim() || name;
    const phone = document.getElementById('new-student-contact-phone').value.trim();
    const email = document.getElementById('new-student-contact-email').value.trim();

    // MANDATORY FIELD VALIDATION FOR PRIMARY CONTACT PHONE & EMAIL
    if (!phone || !email) {
      showLightbox({
        title: 'Mandatory Contact Details Missing',
        message: 'Primary Contact Phone Number and Primary Contact Email Address are required mandatory fields.',
        type: 'warning'
      });
      return;
    }

    const emergName = document.getElementById('new-student-emerg-name').value.trim();
    const emergPhone = document.getElementById('new-student-emerg-phone').value.trim();

    const planFee = parseInt(document.getElementById('new-student-plan').value || appState.config.monthlyFee || 2500);
    const discVal = parseInt(document.getElementById('new-student-discount').value || 0);
    const regFee = appState.config.regFee || 1000;
    const uniformFee = uniformCheck?.checked ? (appState.config.uniformFee || 2500) : 0;
    const finalFee = (planFee + regFee + uniformFee) - discVal;

    const studentId = generateKAIStudentId();
    const invoiceId = generateKAIInvoiceNo(studentId);

    const newStudent = {
      id: Date.now(),
      studentId,
      name,
      firstName,
      middleName,
      lastName,
      belt,
      gender,
      dob,
      phone,
      email,
      contactName,
      contactPhone: phone,
      contactEmail: email,
      emergName,
      emergPhone,
      address,
      city,
      state,
      pincode,
      avatar: currentPhotoBase64 || DEFAULT_AVATAR,
      monthlyFee: finalFee,
      status: 'present',
      accountStatus: 'active',
      joinDate: new Date().toISOString().split('T')[0],
      matHours: 0
    };

    appState.students.push(newStudent);

    appState.financials.unshift({
      id: invoiceId,
      studentId,
      studentName: name,
      origAmount: planFee + regFee + uniformFee,
      discount: discVal,
      finalPaid: finalFee,
      dueDate: new Date().toISOString().split('T')[0],
      status: 'Paid',
      paymentMethod: 'Registration Enrolment'
    });

    logActivity(`Student Registered: ${name}`, `Assigned ID ${studentId} • ${belt}`, 'enrollment');

    dispatchAutoEmailNotification('registration', newStudent);

    saveDatabase();
    await renderAllViews();
    addModal?.classList.add('hidden');
    addForm.reset();
    currentPhotoBase64 = '';
    document.getElementById('photo-preview-img').src = DEFAULT_AVATAR;

    showLightbox({ title: 'Student Registered', message: `Registered ${name}! Assigned Unique Student ID ${studentId}.`, type: 'success' });

    if (appState.userRole !== 'receptionist') {
      openReceiptModal(invoiceId);
    }
  });

  // STUDENT PROFILE EDIT FORM SUBMISSION
  const editForm = document.getElementById('edit-student-form');
  editForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (appState.userRole === 'viewer' || appState.userRole === 'receptionist') {
      showLightbox({ title: 'Permission Denied', message: 'Only Managers and Admins can edit student records.', type: 'error' });
      return;
    }

    const idHidden = document.getElementById('edit-student-id-hidden').value;
    const student = appState.students.find(s => String(s.id) === String(idHidden));
    if (!student) return;

    student.name = document.getElementById('edit-student-name').value.trim();
    student.gender = document.getElementById('edit-student-gender').value;
    student.dob = document.getElementById('edit-student-dob').value;
    student.belt = document.getElementById('edit-student-belt').value;
    student.contactPhone = document.getElementById('edit-student-phone').value.trim();
    student.phone = student.contactPhone;
    student.contactEmail = document.getElementById('edit-student-email').value.trim();
    student.email = student.contactEmail;
    student.emergencyContactPerson = document.getElementById('edit-student-emerg-name').value.trim();
    student.emergencyContactPhone = document.getElementById('edit-student-emerg-phone').value.trim();
    student.address = document.getElementById('edit-student-address').value.trim();
    student.city = document.getElementById('edit-student-city').value.trim();
    student.state = document.getElementById('edit-student-state').value.trim();
    student.pincode = document.getElementById('edit-student-pincode').value.trim();
    student.membershipPlan = document.getElementById('edit-student-plan').value;
    student.monthlyFee = parseInt(document.getElementById('edit-student-monthly-fee').value || 2500);
    student.accountStatus = document.getElementById('edit-student-status').value;
    const avatarUrl = document.getElementById('edit-student-avatar').value.trim();
    if (avatarUrl) student.avatar = avatarUrl;

    logActivity(`Student Details Updated: ${student.name}`, `ID ${student.studentId} profile updated by ${appState.currentUser.username}`, 'enrollment');

    saveDatabase();
    await renderAllViews();
    document.getElementById('edit-student-modal')?.classList.add('hidden');
    showToast(`Updated student profile for ${student.name}`);
  });

  document.getElementById('close-edit-student-modal')?.addEventListener('click', () => {
    document.getElementById('edit-student-modal')?.classList.add('hidden');
  });
  document.getElementById('btn-cancel-edit-student')?.addEventListener('click', () => {
    document.getElementById('edit-student-modal')?.classList.add('hidden');
  });

  const payOrigInput = document.getElementById('pay-orig-amount');
  const payDiscInput = document.getElementById('pay-discount-amount');

  function updatePayCalc() {
    let orig = parseInt(payOrigInput?.value || 2500);
    let disc = parseInt(payDiscInput?.value || 0);
    if (isNaN(orig) || orig < 0) orig = 0;
    if (isNaN(disc) || disc < 0) disc = 0;
    if (disc > orig) disc = orig;

    const finalVal = orig - disc;
    document.getElementById('pay-final-amount').textContent = `₹${finalVal.toLocaleString('en-IN')}`;
  }

  payOrigInput?.addEventListener('input', updatePayCalc);
  payDiscInput?.addEventListener('input', updatePayCalc);

  const payForm = document.getElementById('record-payment-form');
  payForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (appState.userRole === 'viewer' || appState.userRole === 'receptionist') {
      showLightbox({ title: 'Permission Denied', message: 'Financial payments are restricted.', type: 'error' });
      return;
    }

    const selectedVal = document.getElementById('pay-student-selected-id')?.value || document.getElementById('pay-student-select')?.value;
    if (!selectedVal) {
      showLightbox({ title: 'Select Student', message: 'Please search and select a student from the roster to record fee payment.', type: 'warning' });
      return;
    }

    const student = appState.students.find(s => String(s.id) === String(selectedVal) || String(s.studentId) === String(selectedVal));

    if (student) {
      const orig = parseInt(payOrigInput.value || 2500);
      const disc = parseInt(payDiscInput.value || 0);
      const finalPaid = orig - disc;
      const method = document.getElementById('pay-method').value;
      const invoiceId = generateKAIInvoiceNo(student.studentId);

      const invRecord = {
        id: invoiceId,
        studentId: student.studentId,
        studentName: student.name,
        origAmount: orig,
        discount: disc,
        finalPaid,
        dueDate: new Date().toISOString().split('T')[0],
        status: 'Paid',
        paymentMethod: method
      };

      appState.financials.unshift(invRecord);

      logActivity(`Fee Payment Recorded: ${student.name}`, `₹${finalPaid.toLocaleString('en-IN')} via ${method}`, 'payment');

      dispatchAutoEmailNotification('receipt', invRecord);

      saveDatabase();
      await renderAllViews();
      document.getElementById('record-payment-modal')?.classList.add('hidden');
      payForm.reset();

      showLightbox({ title: 'Payment Recorded', message: `Fee payment recorded successfully. Invoice #${invoiceId}`, type: 'success' });
      openReceiptModal(invoiceId);
    }
  });
}

// Admin & Manager Control Panel Form Handlers (Delegated Event Listeners for Reliable Submissions)
function setupAdminSettingsForms() {
  document.addEventListener('submit', (e) => {
    const form = e.target;
    if (!form) return;

    // Handle User Creation Form (both in Admin and Manager sections)
    if (form.id === 'admin-create-user-form' || form.id === 'manager-create-user-form') {
      e.preventDefault();
      if (appState.userRole === 'viewer') {
        showLightbox({ title: 'Permission Denied', message: 'Viewer role is read-only.', type: 'error' });
        return;
      }

      const isMgrForm = (form.id === 'manager-create-user-form');
      const nameInput = form.querySelector(isMgrForm ? '#mgr-usr-name' : '#usr-name');
      const usernameInput = form.querySelector(isMgrForm ? '#mgr-usr-username' : '#usr-username');
      const emailInput = form.querySelector(isMgrForm ? '#mgr-usr-email' : '#usr-email');
      const passwordInput = form.querySelector(isMgrForm ? '#mgr-usr-password' : '#usr-password');
      const roleSelect = form.querySelector(isMgrForm ? '#mgr-usr-role' : '#usr-role');

      const name = nameInput?.value.trim();
      const username = usernameInput?.value.trim();
      const email = emailInput?.value.trim();
      const password = passwordInput?.value.trim();
      const role = roleSelect?.value || 'manager';

      if (!name || !username || !password) return;

      if (appState.userRole === 'manager' && role === 'admin') {
        showLightbox({ title: 'Permission Denied', message: 'Managers cannot create Admin accounts.', type: 'error' });
        return;
      }

      const exists = appState.users.some(u => u.username.toLowerCase() === username.toLowerCase());
      if (exists) {
        showLightbox({ title: 'Duplicate User', message: `Username ${username} already exists.`, type: 'warning' });
        return;
      }

      appState.users.push({
        id: Date.now(),
        username,
        password,
        name,
        email: email || `${username}@karateacademyindia.com`,
        role,
        status: 'active'
      });

      logActivity(`User Account Created: ${username}`, `Assigned Role: ${role.toUpperCase()}`, 'user');

      saveDatabase();
      renderAdminUsersTable();
      form.reset();
      showLightbox({ title: 'User Account Created', message: `Created User Account: ${username} (${role.toUpperCase()})`, type: 'success' });
    }

    // Handle Branding Form
    if (form.id === 'admin-config-form') {
      e.preventDefault();
      if (appState.userRole !== 'admin') return;

      appState.config.appTitle = document.getElementById('cfg-app-title').value.trim();
      appState.config.appSubtitle = document.getElementById('cfg-app-subtitle').value.trim();
      appState.config.appVersion = document.getElementById('cfg-app-version').value.trim();
      appState.config.logoUrl = document.getElementById('cfg-logo-url').value.trim();

      logActivity(`App Branding Updated`, `Title: ${appState.config.appTitle}`, 'system');

      saveDatabase();
      updateDynamicBrandingUI();
      showLightbox({ title: 'Configuration Saved', message: 'Branding & App Configuration updated!', type: 'success' });
    }

    // Handle Tuition Fees Form
    if (form.id === 'admin-fees-form') {
      e.preventDefault();
      if (appState.userRole !== 'admin') return;

      appState.config.regFee = parseInt(document.getElementById('cfg-reg-fee').value) || 1000;
      appState.config.monthlyFee = parseInt(document.getElementById('cfg-monthly-fee').value) || 2500;
      appState.config.quarterlyFee = parseInt(document.getElementById('cfg-quarterly-fee').value) || 7000;
      appState.config.halfYearlyFee = parseInt(document.getElementById('cfg-halfyearly-fee').value) || 13000;

      logActivity(`Tuition Fee Structure Updated`, `Monthly: ₹${appState.config.monthlyFee}`, 'system');

      saveDatabase();
      showLightbox({ title: 'Fee Structure Saved', message: 'Tuition Fee structure updated successfully!', type: 'success' });
    }

    // Handle SMTP Config Form
    if (form.id === 'admin-smtp-config-form') {
      e.preventDefault();
      if (appState.userRole !== 'admin') return;

      const inputPass = (document.getElementById('smtp-pass')?.value || '').trim();
      const existingPass = appState.config?.smtp?.password || '';
      const finalPass = (inputPass && inputPass !== '••••••••') ? inputPass : existingPass;

      appState.config.smtp = {
        host: (document.getElementById('smtp-host')?.value || '').trim(),
        port: (document.getElementById('smtp-port')?.value || '587').trim(),
        encryption: (document.getElementById('smtp-encryption')?.value || 'tls').trim(),
        username: (document.getElementById('smtp-user')?.value || '').trim(),
        password: finalPass,
        fromName: (document.getElementById('smtp-from-name')?.value || '').trim(),
        fromEmail: (document.getElementById('smtp-from-email')?.value || '').trim()
      };

      logActivity('SMTP Configuration Updated', `Host: ${appState.config.smtp.host}`, 'system');

      saveDatabase();
      showLightbox({ title: 'SMTP Saved', message: 'SMTP Email Configuration updated successfully!', type: 'success' });
    }
  });

  // Clear All Logs Handler (Global & Event-driven)
  window.clearAllAdminLogs = function () {
    if (appState.userRole !== 'admin') {
      showLightbox({ title: 'Permission Denied', message: 'Only Admin can clear system activity logs.', type: 'error' });
      return;
    }
    showLightbox({
      title: 'Clear All System Logs',
      message: 'This will permanently delete all activity and audit logs from the database. This action cannot be undone.',
      type: 'confirm',
      confirmText: 'Yes, Clear All',
      cancelText: 'Cancel',
      onResult: (confirmed) => {
        if (confirmed) {
          appState.activityLogs = [];
          saveDatabase();
          renderAdminLogsTable();
          updateHeaderLogsBadge();
          showToast('All activity logs have been cleared.');
        }
      }
    });
  };

  const clearLogsBtn = document.getElementById('btn-admin-clear-logs');
  clearLogsBtn?.addEventListener('click', () => {
    window.clearAllAdminLogs();
  });

  // Test SMTP Configuration Button
  const testSmtpBtn = document.getElementById('btn-test-smtp-config');
  testSmtpBtn?.addEventListener('click', async () => {
    if (appState.userRole !== 'admin') return;

    const host = (document.getElementById('smtp-host')?.value || '').trim();
    const port = (document.getElementById('smtp-port')?.value || '587').trim();
    const encryption = (document.getElementById('smtp-encryption')?.value || 'tls').trim();
    const username = (document.getElementById('smtp-user')?.value || '').trim();
    const inputPass = (document.getElementById('smtp-pass')?.value || '').trim();
    const existingPass = appState.config?.smtp?.password || '';
    const password = (inputPass && inputPass !== '••••••••') ? inputPass : existingPass;
    const fromName = (document.getElementById('smtp-from-name')?.value || '').trim();
    const fromEmail = (document.getElementById('smtp-from-email')?.value || '').trim();

    if (!host || !username || !password) {
      showLightbox({
        title: 'Incomplete SMTP Details',
        message: 'Please provide SMTP Host, Port, Username, and Password to send a test email.',
        type: 'warning'
      });
      return;
    }

    showToast('Sending SMTP test email verification...');

    try {
      const token = localStorage.getItem('kai_token') || sessionStorage.getItem('kai_token');
      const res = await fetch('/api/admin/test-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          host,
          port,
          encryption,
          username,
          password,
          fromName,
          fromEmail,
          testEmail: fromEmail || username || appState.currentUser?.email || 'admin@conzex.com'
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        showLightbox({
          title: 'SMTP Test Successful',
          message: data.message || 'SMTP Connection verified and test email dispatched successfully!',
          type: 'success'
        });
      } else {
        showLightbox({
          title: 'SMTP Test Failed',
          message: data.error || 'Could not connect to SMTP server. Please verify credentials, host, and port.',
          type: 'error'
        });
      }
    } catch (err) {
      showLightbox({
        title: 'SMTP Error',
        message: `Failed to dispatch test email: ${err.message}`,
        type: 'error'
      });
    }
  });

  const hostInput = document.getElementById('smtp-host');
  hostInput?.addEventListener('input', () => {
    const val = (hostInput.value || '').toLowerCase();
    const guideBox = document.getElementById('smtp-gmail-guide-box');
    if (guideBox) {
      if (val.includes('gmail') || val.includes('google')) guideBox.classList.remove('hidden');
      else guideBox.classList.add('hidden');
    }
  });
}

function populatePaymentStudentDropdown() {
  const select = document.getElementById('pay-student-select');
  if (select) {
    if (appState.students.length === 0) {
      select.innerHTML = `<option value="">No students registered in roster</option>`;
    } else {
      select.innerHTML = `<option value="">-- Choose Student from Roster or Search Above --</option>` + appState.students.map(s => `
        <option value="${s.id}">${s.name} (${s.studentId})</option>
      `).join('');
    }
  }
}

function setupPaymentStudentSearch() {
  const searchInput = document.getElementById('pay-student-search-input');
  const dropdown = document.getElementById('pay-student-suggestions-dropdown');
  const hiddenId = document.getElementById('pay-student-selected-id');
  const select = document.getElementById('pay-student-select');

  if (!searchInput || !dropdown) return;

  function renderSuggestions(query) {
    const q = query.trim().toLowerCase();
    if (!q) {
      dropdown.classList.add('hidden');
      return;
    }

    const matches = appState.students.filter(s =>
      s.name.toLowerCase().includes(q) ||
      String(s.studentId).toLowerCase().includes(q) ||
      (s.contactPhone && s.contactPhone.includes(q)) ||
      (s.contactEmail && s.contactEmail.toLowerCase().includes(q))
    ).slice(0, 8);

    if (matches.length === 0) {
      dropdown.innerHTML = `<div class="px-4 py-2.5 text-slate-400 text-[11px] font-semibold text-center">No matching students found</div>`;
    } else {
      dropdown.innerHTML = matches.map(s => `
        <div class="px-4 py-2 hover:bg-slate-50 cursor-pointer flex items-center justify-between transition" onclick="selectPaymentStudent('${s.id}')">
          <div class="flex items-center gap-2.5">
            <img class="w-7 h-7 rounded-full object-cover border border-slate-200" src="${s.avatar || DEFAULT_AVATAR}" alt="${s.name}"/>
            <div>
              <div class="font-extrabold text-slate-900 text-xs">${s.name}</div>
              <div class="text-[10px] text-slate-500 font-mono">${s.studentId} • ${s.belt}</div>
            </div>
          </div>
          <span class="text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">Select</span>
        </div>
      `).join('');
    }

    dropdown.classList.remove('hidden');
  }

  searchInput.addEventListener('input', (e) => renderSuggestions(e.target.value));
  searchInput.addEventListener('focus', (e) => renderSuggestions(e.target.value));

  document.addEventListener('click', (e) => {
    if (!searchInput.contains(e.target) && !dropdown.contains(e.target)) {
      dropdown.classList.add('hidden');
    }
  });

  if (select) {
    select.addEventListener('change', (e) => {
      const selectedId = e.target.value;
      const s = appState.students.find(st => String(st.id) === String(selectedId));
      if (s) {
        if (hiddenId) hiddenId.value = s.id;
        if (searchInput) searchInput.value = `${s.name} (${s.studentId})`;
        const feeInput = document.getElementById('pay-orig-amount');
        if (feeInput) feeInput.value = s.monthlyFee || 2500;
        const discInput = document.getElementById('pay-discount-amount');
        const finalEl = document.getElementById('pay-final-amount');
        const orig = parseInt(s.monthlyFee || 2500);
        const disc = parseInt(discInput?.value || 0);
        if (finalEl) finalEl.textContent = `₹${(orig - disc).toLocaleString('en-IN')}`;
      }
    });
  }
}

function selectPaymentStudent(studentIdStr) {
  const student = appState.students.find(s => String(s.id) === String(studentIdStr) || String(s.studentId) === String(studentIdStr));
  if (!student) return;

  const searchInput = document.getElementById('pay-student-search-input');
  const dropdown = document.getElementById('pay-student-suggestions-dropdown');
  const hiddenId = document.getElementById('pay-student-selected-id');
  const select = document.getElementById('pay-student-select');

  if (searchInput) searchInput.value = `${student.name} (${student.studentId})`;
  if (hiddenId) hiddenId.value = student.id;
  if (select) select.value = student.id;

  const feeInput = document.getElementById('pay-orig-amount');
  if (feeInput) feeInput.value = student.monthlyFee || 2500;
  const discInput = document.getElementById('pay-discount-amount');
  const finalEl = document.getElementById('pay-final-amount');
  const orig = parseInt(student.monthlyFee || 2500);
  const disc = parseInt(discInput?.value || 0);
  if (finalEl) finalEl.textContent = `₹${(orig - disc).toLocaleString('en-IN')}`;

  if (dropdown) dropdown.classList.add('hidden');
}

function showToast(message) {
  const existing = document.querySelector('.kai-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = 'kai-toast fixed bottom-20 right-6 lg:bottom-8 lg:right-8 bg-slate-900 text-white px-5 py-3.5 rounded-2xl shadow-2xl z-50 flex items-center gap-3 border border-slate-700 toast-enter text-xs font-bold';
  toast.innerHTML = `
    <div class="w-6 h-6 rounded-full bg-red-600 text-white flex items-center justify-center font-bold text-xs">
      <span class="material-symbols-outlined text-sm">notifications</span>
    </div>
    <span>${message}</span>
  `;
  document.body.appendChild(toast);

  setTimeout(() => toast.remove(), 4000);
}

// ==========================================
// 10-MINUTE INACTIVITY AUTO-LOGOUT ENGINE
// ==========================================
let inactivityTimer = null;
const INACTIVITY_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

function resetInactivityTimer() {
  if (inactivityTimer) clearTimeout(inactivityTimer);
  if (!appState.isAuthenticated) return;

  inactivityTimer = setTimeout(() => {
    if (appState.isAuthenticated) {
      triggerLogout(true);
    }
  }, INACTIVITY_TIMEOUT_MS);
}

function setupInactivityWatchdog() {
  const events = ['mousemove', 'keydown', 'mousedown', 'touchstart', 'scroll', 'click'];
  let lastEventTime = 0;

  events.forEach(evt => {
    window.addEventListener(evt, () => {
      const now = Date.now();
      if (now - lastEventTime > 1000) { // Throttle reset to 1s
        lastEventTime = now;
        resetInactivityTimer();
      }
    }, { passive: true });
  });

  resetInactivityTimer();
}

// ==========================================
// ONLINE ADMISSION VERIFICATION WORKFLOW
// ==========================================
let currentSelectedAdmissionId = null;
let currentPendingAdmissionsList = [];

async function loadPendingAdmissions() {
  if (!appState.isAuthenticated) return;
  if (appState.userRole !== 'admin' && appState.userRole !== 'manager') return;

  try {
    const token = localStorage.getItem('kai_token') || sessionStorage.getItem('kai_token');
    const res = await fetch('/api/admissions/pending', {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    const data = await res.json();
    if (res.ok && data.success) {
      currentPendingAdmissionsList = data.admissions || [];
      appState.pendingAdmissions = data.admissions || [];

      const count = currentPendingAdmissionsList.length;

      const headBadge = document.getElementById('header-admissions-badge');
      const mobBadge = document.getElementById('mobile-admissions-badge');
      const modalBadge = document.getElementById('adm-modal-count-badge');
      const dashStat = document.getElementById('stat-pending-admissions');

      if (headBadge) headBadge.textContent = count;
      if (mobBadge) mobBadge.textContent = count;
      if (modalBadge) modalBadge.textContent = `${count} Pending`;
      if (dashStat) dashStat.textContent = count;

      const headBtn = document.getElementById('header-admissions-btn');
      const mobBtn = document.getElementById('mobile-admissions-btn');

      if (count > 0) {
        headBtn?.classList.remove('hidden');
        mobBtn?.classList.remove('hidden');
      }

      renderPendingAdmissionsList();
    }
  } catch (err) {
    console.error('Failed to load pending admissions:', err);
  }
}

function setupAdmissionsHandlers() {
  const modal = document.getElementById('pending-admissions-modal');
  const closeBtn = document.getElementById('close-admissions-modal');
  const docModal = document.getElementById('doc-preview-modal');
  const closeDocBtn = document.getElementById('close-doc-preview-modal');

  closeBtn?.addEventListener('click', () => modal?.classList.add('hidden'));
  closeDocBtn?.addEventListener('click', () => docModal?.classList.add('hidden'));
}

function openPendingAdmissionsModal() {
  if (appState.userRole !== 'admin' && appState.userRole !== 'manager') {
    showLightbox({ title: 'Access Restricted', message: 'Admission verification is restricted to Academy Managers and Administrators.', type: 'warning' });
    return;
  }

  const modal = document.getElementById('pending-admissions-modal');
  if (!modal) return;

  loadPendingAdmissions();
  modal.classList.remove('hidden');
}

function renderPendingAdmissionsList() {
  const listContainer = document.getElementById('admissions-list-container');
  if (!listContainer) return;

  if (currentPendingAdmissionsList.length === 0) {
    listContainer.innerHTML = `
      <div class="py-12 text-center text-slate-400 space-y-2 text-xs">
        <span class="material-symbols-outlined text-4xl text-slate-300">task_alt</span>
        <p class="font-bold text-slate-600">No Pending Admissions</p>
        <p class="text-[11px]">All online applications have been verified.</p>
      </div>
    `;

    const detailPane = document.getElementById('admission-detail-pane');
    if (detailPane) {
      detailPane.innerHTML = `
        <div class="h-full flex flex-col items-center justify-center text-slate-400 space-y-2 py-16">
          <span class="material-symbols-outlined text-5xl text-emerald-500">check_circle</span>
          <p class="text-xs font-bold text-slate-700">All Applications Processed</p>
          <p class="text-[11px] text-slate-400">Share public admission link to accept new athlete applications.</p>
        </div>
      `;
    }
    return;
  }

  listContainer.innerHTML = currentPendingAdmissionsList.map(a => {
    const isSelected = (a.id === currentSelectedAdmissionId);
    const timeStr = a.submittedAt ? new Date(a.submittedAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Recent';

    return `
      <div onclick="selectAdmissionForReview('${a.id}')" class="p-3 rounded-2xl border cursor-pointer transition flex items-center gap-3 ${isSelected ? 'bg-red-50/80 border-red-300 shadow-sm' : 'bg-white border-slate-200 hover:bg-slate-100/70'}">
        <img class="w-10 h-10 rounded-xl object-cover border border-slate-200 shrink-0 bg-white" src="${a.avatar || DEFAULT_AVATAR}" alt="${a.name}"/>
        <div class="overflow-hidden flex-1">
          <div class="font-bold text-xs text-slate-900 truncate">${a.name}</div>
          <div class="text-[10px] text-slate-500 font-mono">${a.id}</div>
          <div class="text-[9px] text-slate-400 mt-0.5">${timeStr} • <span class="text-red-600 font-bold">${a.belt || 'White Belt'}</span></div>
        </div>
      </div>
    `;
  }).join('');

  if (!currentSelectedAdmissionId && currentPendingAdmissionsList.length > 0) {
    selectAdmissionForReview(currentPendingAdmissionsList[0].id);
  }
}

function selectAdmissionForReview(admissionId) {
  currentSelectedAdmissionId = admissionId;
  renderPendingAdmissionsList();

  const admission = currentPendingAdmissionsList.find(a => a.id === admissionId);
  const detailPane = document.getElementById('admission-detail-pane');
  if (!admission || !detailPane) return;

  const docs = Array.isArray(admission.documents) ? admission.documents : [];
  const fullAddress = [admission.address, admission.city, admission.state, admission.pincode].filter(Boolean).join(', ') || 'N/A';

  detailPane.innerHTML = `
    <!-- Top Athlete Profile Card -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 bg-slate-50 rounded-2xl border border-slate-200">
      <div class="flex items-center gap-4">
        <img src="${admission.avatar || DEFAULT_AVATAR}" alt="${admission.name}" class="w-16 h-16 rounded-2xl object-cover border-2 border-red-500 shadow bg-white shrink-0"/>
        <div>
          <h3 class="font-extrabold text-lg text-slate-900 flex items-center gap-2">
            <span>${admission.name}</span>
            <span class="text-xs font-mono font-bold bg-red-100 text-red-700 px-2 py-0.5 rounded-lg border border-red-200">${admission.id}</span>
          </h3>
          <p class="text-xs text-slate-500 mt-0.5">Applied: ${new Date(admission.submittedAt).toLocaleString('en-IN')}</p>
        </div>
      </div>

      <div class="flex items-center gap-2">
        <span class="px-3 py-1 bg-amber-100 text-amber-800 text-xs font-bold rounded-xl border border-amber-200">
          Pending Manager Review
        </span>
      </div>
    </div>

    <!-- Details Grid -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
      <div class="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
        <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Personal & Athlete Information</span>
        <div class="space-y-1.5 text-slate-700">
          <div class="flex justify-between"><span class="text-slate-500">Gender:</span> <strong class="text-slate-900">${admission.gender || 'N/A'}</strong></div>
          <div class="flex justify-between"><span class="text-slate-500">Date of Birth:</span> <strong class="text-slate-900">${admission.dob || 'N/A'}</strong></div>
          <div class="flex justify-between"><span class="text-slate-500">Blood Group:</span> <strong class="text-slate-900">${admission.bloodGroup || 'N/A'}</strong></div>
          <div class="flex justify-between"><span class="text-slate-500">Requested Belt:</span> <strong class="text-red-600 font-bold">${admission.belt || 'White Belt'}</strong></div>
          <div class="flex justify-between"><span class="text-slate-500">Training Plan:</span> <strong class="text-slate-900">${admission.membershipPlan || 'Monthly'}</strong></div>
          <div class="flex justify-between"><span class="text-slate-500">Medical Notes:</span> <strong class="text-slate-900">${admission.medicalNotes || 'None'}</strong></div>
        </div>
      </div>

      <div class="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
        <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Contact & Verification</span>
        <div class="space-y-1.5 text-slate-700">
          <div class="flex justify-between"><span class="text-slate-500">Parent / Guardian:</span> <strong class="text-slate-900">${admission.parentName || admission.name}</strong></div>
          <div class="flex justify-between"><span class="text-slate-500">Primary Phone:</span> <strong class="font-mono text-slate-900">${admission.phone}</strong></div>
          <div class="flex justify-between"><span class="text-slate-500">Primary Email:</span> <strong class="text-slate-900">${admission.email}</strong></div>
          <div class="flex justify-between"><span class="text-slate-500">Emergency Phone:</span> <strong class="font-mono text-slate-900">${admission.emergPhone || admission.phone}</strong></div>
          <div class="flex justify-between"><span class="text-slate-500">ID Proof Type:</span> <strong class="text-slate-900">${admission.govIdType || 'Aadhaar Card'}</strong></div>
          <div class="flex justify-between"><span class="text-slate-500">ID Proof Number:</span> <strong class="font-mono text-slate-900">${admission.govIdNumber || 'N/A'}</strong></div>
        </div>
      </div>
    </div>

    <!-- Residential Address -->
    <div class="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-1 text-xs">
      <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Full Residential Address</span>
      <p class="font-medium text-slate-800">${fullAddress}</p>
    </div>

    <!-- Attached Documents (1 to 5 Attachments) -->
    <div class="space-y-3">
      <div class="flex items-center justify-between">
        <h4 class="font-extrabold text-xs text-slate-900 uppercase tracking-wider">Attached Verification Documents (${docs.length})</h4>
        <span class="text-[11px] text-slate-400">Click to Preview or Download</span>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3" id="adm-docs-grid">
        ${docs.length === 0 ? '<div class="col-span-full text-xs text-slate-400 italic">No attachments found.</div>' : docs.map((d, i) => `
          <div class="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between gap-3 text-xs">
            <div class="flex items-center gap-2.5 overflow-hidden">
              <span class="material-symbols-outlined text-red-600 text-xl">description</span>
              <div class="truncate">
                <div class="font-bold text-slate-900 truncate">${d.name || `Document ${i + 1}`}</div>
                <div class="text-[10px] text-slate-400 font-mono">${(d.size / 1024).toFixed(1)} KB</div>
              </div>
            </div>
            <div class="flex items-center gap-1.5 shrink-0">
              <button onclick="previewAdmissionDoc('${admission.id}', '${d.id}')" class="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 font-bold text-[10px] rounded-lg border border-slate-200 transition">
                Preview
              </button>
              <a href="${d.data}" download="${d.name || 'document'}" class="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-white font-bold text-[10px] rounded-lg transition">
                Download
              </a>
            </div>
          </div>
        `).join('')}
      </div>
    </div>

    <!-- Manager Decision Action Panel -->
    <div class="p-5 bg-slate-900 text-white rounded-3xl space-y-4 shadow-xl">
      <div class="flex items-center gap-2 text-xs font-bold text-slate-300 border-b border-slate-800 pb-2">
        <span class="material-symbols-outlined text-red-400">verified</span>
        <span>Manager Approval & ID Card Generation</span>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
        <div>
          <label class="block font-bold text-slate-300 mb-1">Confirm Belt Rank</label>
          <select id="adm-confirm-belt" class="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white font-bold focus:ring-2 focus:ring-red-600 focus:outline-none">
            <option value="White Belt" ${admission.belt === 'White Belt' ? 'selected' : ''}>White Belt (Beginner)</option>
            <option value="Yellow Belt" ${admission.belt === 'Yellow Belt' ? 'selected' : ''}>Yellow Belt</option>
            <option value="Orange Belt" ${admission.belt === 'Orange Belt' ? 'selected' : ''}>Orange Belt</option>
            <option value="Green Belt" ${admission.belt === 'Green Belt' ? 'selected' : ''}>Green Belt</option>
            <option value="Blue Belt" ${admission.belt === 'Blue Belt' ? 'selected' : ''}>Blue Belt</option>
            <option value="Purple Belt" ${admission.belt === 'Purple Belt' ? 'selected' : ''}>Purple Belt</option>
            <option value="Brown Belt" ${admission.belt === 'Brown Belt' ? 'selected' : ''}>Brown Belt</option>
            <option value="Black Belt" ${admission.belt === 'Black Belt' ? 'selected' : ''}>Black Belt</option>
          </select>
        </div>
        <div>
          <label class="block font-bold text-slate-300 mb-1">Monthly Tuition Fee (₹)</label>
          <input type="number" id="adm-confirm-fee" value="${admission.membershipPlan === 'Annual' ? 2000 : 2500}" class="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white font-bold font-mono focus:ring-2 focus:ring-red-600 focus:outline-none"/>
        </div>
      </div>

      <div class="pt-2 flex items-center justify-between gap-3 flex-wrap">
        <button onclick="rejectAdmission('${admission.id}')" class="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-red-400 font-bold text-xs rounded-xl border border-red-500/30 transition flex items-center gap-1.5">
          <span class="material-symbols-outlined text-sm">block</span>
          <span>Reject Application</span>
        </button>

        <button onclick="approveAdmission('${admission.id}')" class="px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white font-extrabold text-xs rounded-xl shadow-lg transition flex items-center gap-2">
          <span class="material-symbols-outlined text-base">check_circle</span>
          <span>Approve & Generate KAI Student ID</span>
        </button>
      </div>
    </div>
  `;
}

function previewAdmissionDoc(admissionId, docId) {
  const admission = currentPendingAdmissionsList.find(a => a.id === admissionId);
  if (!admission) return;
  const doc = (admission.documents || []).find(d => d.id === docId);
  if (!doc) return;

  const modal = document.getElementById('doc-preview-modal');
  const title = document.getElementById('doc-preview-title');
  const downloadBtn = document.getElementById('doc-preview-download-btn');
  const body = document.getElementById('doc-preview-body');

  if (title) title.textContent = `${admission.name} - ${doc.name}`;
  if (downloadBtn) {
    downloadBtn.href = doc.data;
    downloadBtn.download = doc.name || 'document';
  }

  if (body) {
    if (doc.type.startsWith('image/')) {
      body.innerHTML = `<img src="${doc.data}" alt="${doc.name}" class="max-h-[580px] max-w-full object-contain rounded-xl shadow"/>`;
    } else if (doc.type === 'application/pdf') {
      body.innerHTML = `<embed src="${doc.data}" type="application/pdf" width="100%" height="580px" class="rounded-xl shadow"/>`;
    } else {
      body.innerHTML = `
        <div class="p-8 text-center space-y-3">
          <span class="material-symbols-outlined text-5xl text-slate-400">description</span>
          <p class="text-xs font-bold text-slate-700">Preview not available for this file type</p>
          <a href="${doc.data}" download="${doc.name}" class="px-4 py-2 bg-slate-900 text-white text-xs font-bold rounded-xl inline-block">Download File</a>
        </div>
      `;
    }
  }

  modal?.classList.remove('hidden');
}

async function approveAdmission(admissionId) {
  if (appState.userRole !== 'admin' && appState.userRole !== 'manager') return;

  const belt = document.getElementById('adm-confirm-belt')?.value || 'White Belt';
  const monthlyFee = document.getElementById('adm-confirm-fee')?.value || 2500;

  try {
    const token = localStorage.getItem('kai_token') || sessionStorage.getItem('kai_token');
    const res = await fetch('/api/admissions/approve', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        admissionId,
        assignedBelt: belt,
        monthlyFee: parseInt(monthlyFee)
      })
    });

    const data = await res.json();
    if (res.ok && data.success) {
      showLightbox({
        title: 'Admission Approved!',
        message: `Successfully approved admission for ${data.student.name}. Permanent Student ID ${data.student.studentId} and initial receipt #${data.invoiceId} have been generated and activated in the academy roster.`,
        type: 'success'
      });

      await loadDatabase();
      await renderAllViews();
      await loadPendingAdmissions();
    } else {
      showLightbox({
        title: 'Approval Failed',
        message: data.error || 'Could not approve admission.',
        type: 'error'
      });
    }
  } catch (err) {
    showLightbox({
      title: 'Server Error',
      message: `Failed to connect to server: ${err.message}`,
      type: 'error'
    });
  }
}

async function rejectAdmission(admissionId) {
  if (appState.userRole !== 'admin' && appState.userRole !== 'manager') return;

  const reason = prompt('Please enter the reason for rejecting this admission application:') || 'Application details did not meet requirements.';

  try {
    const token = localStorage.getItem('kai_token') || sessionStorage.getItem('kai_token');
    const res = await fetch('/api/admissions/reject', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ admissionId, rejectionReason: reason })
    });

    const data = await res.json();
    if (res.ok && data.success) {
      showToast(`Admission #${admissionId} marked as rejected.`);
      await loadDatabase();
      await loadPendingAdmissions();
    } else {
      showToast(data.error || 'Failed to reject admission.');
    }
  } catch (err) {
    showToast(`Rejection failed: ${err.message}`);
  }
}

// ==========================================
// BULK STUDENT CSV IMPORT & EXPORT ENGINES
// ==========================================
let pendingCsvImportRecords = [];

function setupCsvImportExportHandlers() {
  const exportBtn = document.getElementById('btn-export-students-csv');
  const importBtn = document.getElementById('btn-import-students-csv');
  const fileInput = document.getElementById('students-csv-file-input');
  const confirmBtn = document.getElementById('btn-confirm-csv-import');
  const cancelBtn = document.getElementById('btn-cancel-csv-import');
  const closeBtn = document.getElementById('close-csv-modal');
  const modal = document.getElementById('csv-import-review-modal');

  exportBtn?.addEventListener('click', () => exportStudentsCSV());
  importBtn?.addEventListener('click', () => fileInput?.click());

  fileInput?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    importStudentsCSV(file);
    e.target.value = '';
  });

  const closeModal = () => modal?.classList.add('hidden');
  cancelBtn?.addEventListener('click', closeModal);
  closeBtn?.addEventListener('click', closeModal);

  confirmBtn?.addEventListener('click', () => confirmCsvImport());
}

function exportStudentsCSV() {
  if (appState.students.length === 0) {
    showToast('No students to export.');
    return;
  }

  const headers = [
    'Student ID',
    'Full Name',
    'First Name',
    'Middle Name',
    'Last Name',
    'Belt Rank',
    'Gender',
    'Date of Birth',
    'Blood Group',
    'Primary Phone',
    'Primary Email',
    'Parent Name',
    'Parent Phone',
    'Parent Email',
    'Emergency Name',
    'Emergency Phone',
    'Emergency Relation',
    'Street Address',
    'City',
    'State',
    'Pincode',
    'Gov ID Type',
    'Gov ID Number',
    'Monthly Fee',
    'Enrolment Date',
    'Account Status',
    'Attendance Status'
  ];

  const rows = appState.students.map(s => [
    s.studentId || '',
    s.name || '',
    s.firstName || s.name.split(' ')[0] || '',
    s.middleName || '',
    s.lastName || s.name.split(' ').slice(1).join(' ') || '',
    s.belt || 'White Belt',
    s.gender || 'Male',
    s.dob || '',
    s.bloodGroup || 'O+',
    s.phone || s.contactPhone || '',
    s.email || s.contactEmail || '',
    s.contactName || s.name || '',
    s.contactPhone || s.phone || '',
    s.contactEmail || s.email || '',
    s.emergName || 'Emergency Contact',
    s.emergPhone || s.phone || '',
    s.emergRelation || 'Parent / Guardian',
    s.address || '',
    s.city || 'Pune',
    s.state || 'MH',
    s.pincode || '411033',
    s.govIdType || 'Aadhaar Card',
    s.govIdNumber || '',
    s.monthlyFee || 2500,
    s.joinDate || '2026-01-01',
    s.accountStatus || 'active',
    s.status || 'present'
  ]);

  const escapeCell = (cell) => `"${String(cell || '').replace(/"/g, '""')}"`;
  const csvContent = [
    headers.map(escapeCell).join(','),
    ...rows.map(r => r.map(escapeCell).join(','))
  ].join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const filename = `KAI_Students_Roster_${new Date().toISOString().split('T')[0]}.csv`;
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();

  logActivity(`CSV Export Generated`, `Exported ${rows.length} student records to ${filename}`, 'system');
  showToast(`Exported ${rows.length} student records to CSV.`);
}

function parseCsvString(text) {
  const lines = [];
  let row = [];
  let inQuotes = false;
  let cell = '';

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const next = text[i + 1];

    if (c === '"') {
      if (inQuotes && next === '"') {
        cell += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === ',' && !inQuotes) {
      row.push(cell.trim());
      cell = '';
    } else if ((c === '\r' || c === '\n') && !inQuotes) {
      if (c === '\r' && next === '\n') i++;
      row.push(cell.trim());
      if (row.some(r => r.length > 0)) lines.push(row);
      row = [];
      cell = '';
    } else {
      cell += c;
    }
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell.trim());
    if (row.some(r => r.length > 0)) lines.push(row);
  }

  return lines;
}

function importStudentsCSV(file) {
  if (appState.userRole !== 'admin' && appState.userRole !== 'manager') {
    showLightbox({ title: 'Access Restricted', message: 'Bulk Student Import is restricted to Managers and Administrators.', type: 'warning' });
    return;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const text = e.target.result;
      const parsedRows = parseCsvString(text);

      if (parsedRows.length < 2) {
        showLightbox({ title: 'Empty CSV', message: 'The uploaded CSV contains no data rows.', type: 'error' });
        return;
      }

      const headers = parsedRows[0].map(h => h.toLowerCase().replace(/[^a-z0-9]/g, ''));
      const dataRows = parsedRows.slice(1);

      const findCol = (...aliases) => {
        for (const a of aliases) {
          const idx = headers.findIndex(h => h.includes(a));
          if (idx !== -1) return idx;
        }
        return -1;
      };

      const nameIdx = findCol('fullname', 'name', 'studentname', 'athlete');
      const phoneIdx = findCol('phone', 'mobile', 'contactphone', 'primaryphone');
      const emailIdx = findCol('email', 'contactemail', 'mail');
      const beltIdx = findCol('belt', 'rank', 'beltrank');
      const genderIdx = findCol('gender', 'sex');
      const dobIdx = findCol('dob', 'birth', 'dateofbirth');
      const parentIdx = findCol('parent', 'guardian', 'father', 'mother');
      const addrIdx = findCol('address', 'street', 'residence');
      const cityIdx = findCol('city');
      const stateIdx = findCol('state');
      const pinIdx = findCol('pin', 'pincode', 'postal');
      const feeIdx = findCol('fee', 'monthlyfee', 'tuition');

      const existingPhones = new Set(appState.students.map(s => String(s.phone || s.contactPhone || '').replace(/\D/g, '')));
      const existingEmails = new Set(appState.students.map(s => String(s.email || s.contactEmail || '').toLowerCase()));

      pendingCsvImportRecords = [];
      let validCount = 0;
      let errorCount = 0;

      dataRows.forEach((row, i) => {
        const rawName = nameIdx !== -1 ? row[nameIdx] : (row[0] || '');
        const rawPhone = phoneIdx !== -1 ? row[phoneIdx] : (row[1] || '');
        const rawEmail = emailIdx !== -1 ? row[emailIdx] : (row[2] || '');
        const rawBelt = beltIdx !== -1 ? row[beltIdx] : (row[3] || 'White Belt');
        const rawGender = genderIdx !== -1 ? row[genderIdx] : (row[4] || 'Male');
        const rawDob = dobIdx !== -1 ? row[dobIdx] : (row[5] || '');

        const errors = [];
        const warnings = [];

        if (!rawName || rawName.trim().length < 2) {
          errors.push('Full Name is required');
        }

        const cleanPhone = String(rawPhone || '').replace(/\D/g, '');
        if (!cleanPhone || cleanPhone.length < 10) {
          errors.push('Valid 10-digit phone number is required');
        } else if (existingPhones.has(cleanPhone)) {
          warnings.push('Phone already exists in roster');
        }

        const cleanEmail = String(rawEmail || '').trim().toLowerCase();
        if (cleanEmail && existingEmails.has(cleanEmail)) {
          warnings.push('Email already exists in roster');
        }

        const isValid = errors.length === 0;
        if (isValid) validCount++;
        else errorCount++;

        pendingCsvImportRecords.push({
          rowNum: i + 2,
          isValid,
          errors,
          warnings,
          name: rawName.trim(),
          phone: cleanPhone || rawPhone,
          email: cleanEmail || `${cleanPhone || Date.now()}@athlete.kai`,
          belt: rawBelt.trim() || 'White Belt',
          gender: rawGender.trim() || 'Male',
          dob: rawDob.trim() || '2012-01-01',
          parentName: parentIdx !== -1 ? (row[parentIdx] || rawName.trim()) : rawName.trim(),
          address: addrIdx !== -1 ? (row[addrIdx] || '') : '',
          city: cityIdx !== -1 ? (row[cityIdx] || 'Pune') : 'Pune',
          state: stateIdx !== -1 ? (row[stateIdx] || 'MH') : 'MH',
          pincode: pinIdx !== -1 ? (row[pinIdx] || '411033') : '411033',
          monthlyFee: feeIdx !== -1 ? (parseInt(row[feeIdx]) || 2500) : 2500
        });
      });

      // Render CSV Review Modal
      const modal = document.getElementById('csv-import-review-modal');
      const totalEl = document.getElementById('csv-total-count');
      const validEl = document.getElementById('csv-valid-count');
      const errEl = document.getElementById('csv-error-count');
      const tbody = document.getElementById('csv-review-table-body');
      const confirmBtnLabel = document.getElementById('btn-confirm-csv-label');

      if (totalEl) totalEl.textContent = dataRows.length;
      if (validEl) validEl.textContent = validCount;
      if (errEl) errEl.textContent = errorCount;
      if (confirmBtnLabel) confirmBtnLabel.textContent = `Confirm & Import (${validCount} Valid Students)`;

      if (tbody) {
        tbody.innerHTML = pendingCsvImportRecords.map(r => `
          <tr class="hover:bg-slate-50 ${r.isValid ? '' : 'bg-red-50/50'}">
            <td class="py-2.5 px-3">
              ${r.isValid ? `
                <span class="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                  <span class="material-symbols-outlined text-xs">check</span>
                  <span>VALID</span>
                </span>
              ` : `
                <span class="inline-flex items-center gap-1 text-[10px] font-bold text-red-700 bg-red-100 px-2 py-0.5 rounded-full">
                  <span class="material-symbols-outlined text-xs">close</span>
                  <span>INVALID</span>
                </span>
              `}
            </td>
            <td class="py-2.5 px-3 font-bold text-slate-900">${r.name}</td>
            <td class="py-2.5 px-3"><span class="belt-badge ${getBeltClass(r.belt)} text-[9px] py-0.5 px-1.5">${r.belt}</span></td>
            <td class="py-2.5 px-3 font-mono">${r.phone}</td>
            <td class="py-2.5 px-3 text-slate-500">${r.email}</td>
            <td class="py-2.5 px-3">${r.gender}</td>
            <td class="py-2.5 px-3">${r.dob}</td>
            <td class="py-2.5 px-3 text-[11px]">
              ${r.errors.length > 0 ? `<span class="text-red-600 font-bold">${r.errors.join(' • ')}</span>` : ''}
              ${r.warnings.length > 0 ? `<span class="text-amber-600 font-bold">${r.warnings.join(' • ')}</span>` : ''}
              ${(r.errors.length === 0 && r.warnings.length === 0) ? `<span class="text-emerald-600 font-bold">Ready to import</span>` : ''}
            </td>
          </tr>
        `).join('');
      }

      modal?.classList.remove('hidden');
    } catch (err) {
      showLightbox({ title: 'CSV Parse Error', message: `Could not parse CSV file: ${err.message}`, type: 'error' });
    }
  };
  reader.readAsText(file);
}

async function confirmCsvImport() {
  const validRecords = pendingCsvImportRecords.filter(r => r.isValid);
  if (validRecords.length === 0) {
    showToast('No valid records to import.');
    return;
  }

  const newStudents = [];
  const newInvoices = [];

  validRecords.forEach(r => {
    // Generate sequential Student ID KAI2026XX
    const studentId = generateKAIStudentId();
    const invoiceId = generateKAIInvoiceNo(studentId);

    const studentObj = {
      id: Date.now() + Math.floor(Math.random() * 1000),
      studentId: studentId,
      name: r.name,
      firstName: r.name.split(' ')[0] || r.name,
      middleName: '',
      lastName: r.name.split(' ').slice(1).join(' ') || '',
      gender: r.gender,
      dob: r.dob,
      bloodGroup: 'O+',
      belt: r.belt,
      phone: r.phone,
      email: r.email,
      contactName: r.parentName || r.name,
      contactPhone: r.phone,
      contactEmail: r.email,
      emergName: r.parentName || 'Emergency Contact',
      emergPhone: r.phone,
      address: r.address,
      city: r.city,
      state: r.state,
      pincode: r.pincode,
      govIdType: 'Aadhaar Card',
      govIdNumber: 'N/A',
      avatar: DEFAULT_AVATAR,
      monthlyFee: r.monthlyFee || 2500,
      status: 'present',
      accountStatus: 'active',
      joinDate: new Date().toISOString().split('T')[0],
      matHours: 0
    };

    const invoiceObj = {
      id: invoiceId,
      studentId: studentId,
      studentName: r.name,
      origAmount: (r.monthlyFee || 2500) + 1000,
      discount: 0,
      finalPaid: (r.monthlyFee || 2500) + 1000,
      dueDate: new Date().toISOString().split('T')[0],
      status: 'Paid',
      paymentMethod: 'CSV Roster Import'
    };

    appState.students.push(studentObj);
    appState.financials.unshift(invoiceObj);

    newStudents.push(studentObj);
    newInvoices.push(invoiceObj);
  });

  logActivity(`Bulk CSV Student Import`, `Imported ${validRecords.length} student records into database roster`, 'enrollment');

  await saveDatabase();
  await renderAllViews();

  document.getElementById('csv-import-review-modal')?.classList.add('hidden');

  showLightbox({
    title: 'Bulk Import Completed!',
    message: `Successfully imported and enrolled ${validRecords.length} new karate athletes with auto-generated sequential Student IDs (${newStudents[0].studentId} ... ${newStudents[newStudents.length - 1].studentId})!`,
    type: 'success'
  });
}

// ==========================================
// HOLIDAY ATTENDANCE NOTICE CONTROLLER
// ==========================================
window.openHolidayNoticeModal = function () {
  if (appState.userRole === 'viewer') {
    showLightbox({ title: 'Permission Denied', message: 'Viewer role is read-only.', type: 'error' });
    return;
  }
  const modal = document.getElementById('holiday-notice-modal');
  const dateIn = document.getElementById('holiday-date-input');
  if (dateIn) dateIn.value = getTodayDateStr();
  modal?.classList.remove('hidden');
};

window.closeHolidayNoticeModal = function () {
  document.getElementById('holiday-notice-modal')?.classList.add('hidden');
};

function setupHolidayNoticeFormHandler() {
  const form = document.getElementById('holiday-notice-form');
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const holidayName = document.getElementById('holiday-name-input')?.value.trim();
    const date = document.getElementById('holiday-date-input')?.value;
    const notes = document.getElementById('holiday-notes-input')?.value.trim();

    if (!holidayName || !date) {
      showToast('Please enter holiday title and date.');
      return;
    }

    showToast('🚀 Transmitting Encrypted Email...');
    try {
      const token = localStorage.getItem('kai_token') || sessionStorage.getItem('kai_token');
      const res = await fetch('/api/attendance/holiday', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ holidayName, date, notes })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        showLightbox({ title: 'Holiday Notice Dispatched', message: data.message || 'Holiday alert emails dispatched to active athletes.', type: 'success' });
        closeHolidayNoticeModal();
      } else {
        showLightbox({ title: 'Dispatch Failed', message: data.error || 'Could not send holiday notice emails.', type: 'error' });
      }
    } catch (err) {
      showLightbox({ title: 'Network Error', message: err.message, type: 'error' });
    }
  });
}

// ==========================================
// STAFF SALARY INVOICE CONTROLLER
// ==========================================
window.openStaffInvoiceModal = function (userId) {
  const staff = appState.users.find(u => String(u.id) === String(userId));
  if (!staff) return;

  const modal = document.getElementById('staff-invoice-modal');
  document.getElementById('staff-invoice-user-id').value = staff.id;
  document.getElementById('staff-invoice-name').value = staff.name;

  if (!staff.staffId) {
    staff.staffId = generateKAIStaffId();
  }
  document.getElementById('staff-invoice-id').value = staff.staffId;

  const currentMonthStr = new Date().toLocaleString('default', { month: 'long', year: 'numeric' });
  document.getElementById('staff-invoice-month').value = currentMonthStr;
  document.getElementById('staff-invoice-amount').value = staff.monthlySalary || 15000;

  modal?.classList.remove('hidden');
};

window.closeStaffInvoiceModal = function () {
  document.getElementById('staff-invoice-modal')?.classList.add('hidden');
};

function setupStaffInvoiceFormHandler() {
  const form = document.getElementById('staff-invoice-form');
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const userId = document.getElementById('staff-invoice-user-id')?.value;
    const staffId = document.getElementById('staff-invoice-id')?.value;
    const month = document.getElementById('staff-invoice-month')?.value.trim();
    const amount = parseInt(document.getElementById('staff-invoice-amount')?.value || 15000);

    if (!staffId || !month || !amount) {
      showToast('Please fill in all salary invoice details.');
      return;
    }

    showToast('🚀 Transmitting Encrypted Email...');
    try {
      const token = localStorage.getItem('kai_token') || sessionStorage.getItem('kai_token');
      const res = await fetch('/api/staff/invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ staffId, month, amount })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        showLightbox({ title: 'Salary Invoice Generated', message: data.message || `Salary invoice generated with payslip PDF.`, type: 'success' });
        closeStaffInvoiceModal();
      } else {
        showLightbox({ title: 'Invoice Error', message: data.error || 'Could not generate staff invoice.', type: 'error' });
      }
    } catch (err) {
      showLightbox({ title: 'Network Error', message: err.message, type: 'error' });
    }
  });
}