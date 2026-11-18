// app.js - Frontend application logic for ASIN GROUP HRM
// -------------------------------------------------------------
// GLOBAL FETCH INTERCEPTOR FOR AUTHENTICATION
// -------------------------------------------------------------
const originalFetch = window.fetch;
window.fetch = function(url, options = {}) {
  const token = localStorage.getItem('hrm_auth_token');
  options.headers = options.headers || {};
  if (token && typeof url === 'string' && url.startsWith('/api') && !url.startsWith('/api/auth/login')) {
    if (options.headers instanceof Headers) {
      options.headers.set('Authorization', 'Bearer ' + token);
    } else if (Array.isArray(options.headers)) {
      options.headers.push(['Authorization', 'Bearer ' + token]);
    } else {
      options.headers['Authorization'] = 'Bearer ' + token;
    }
  }
  return originalFetch(url, options).then(res => {
    if (res.status === 401 && typeof url === 'string' && url.startsWith('/api') && !url.startsWith('/api/auth/login')) {
      handleUnauthenticated();
    }
    return res;
  });
};

// Chuẩn hoá font Montserrat cho toàn bộ biểu đồ Chart.js
if (typeof Chart !== 'undefined') {
  Chart.defaults.font.family = "'Montserrat', system-ui, -apple-system, sans-serif";
}

let state = {
  currentRoute: 'dashboard',
  currentEmployeeTab: 'working_all',
  currentDetailTab: 'info',
  currentDetailEmpId: null,
  currentLeaveTab: 'pending',
  currentRole: 'admin', // 'admin', 'hr', 'viewer', 'manager'
  currentUser: null,
  branches: [],
  departments: [],
  positions: [],
  employees: [],
  filteredEmployees: [],
  selectedEmployeeIds: new Set(),
  leaveRequests: [],
  leaveQuotas: [],
  users: [],
  settings: {},
  orgChartZoom: 1,
  chartInstances: {}
};

// Document Ready: Check Auth First (Chỉ có tài khoản mới vào được app)
document.addEventListener('DOMContentLoaded', () => {
  checkAuthOnStartup();
});

async function checkAuthOnStartup() {
  const urlParams = new URLSearchParams(window.location.search);
  const autoUser = urlParams.get('quickAuth');
  if (autoUser && (autoUser === 'admin' || autoUser === 'hr' || autoUser === 'nhanvien')) {
    quickLoginFill(autoUser, 'Asin@2026');
    await submitLogin();
    return;
  }

  const token = localStorage.getItem('hrm_auth_token');
  if (!token) {
    handleUnauthenticated();
    return;
  }

  try {
    const res = await fetch('/api/auth/me');
    if (!res.ok) throw new Error('Unauthenticated');
    const data = await res.json();
    state.currentUser = data.user;
    handleAuthenticated(data.user);
  } catch (err) {
    handleUnauthenticated();
  }
}

function handleAuthenticated(user) {
  document.getElementById('authScreen')?.classList.add('hidden');
  document.getElementById('mainApp')?.classList.remove('hidden');
  updateHeaderUserInfo(user);
  applyUserPermissionsToUI(user);
  initRouter();
  initEventListeners();
  loadAllInitialData();
  lucide.createIcons();
}

function handleUnauthenticated() {
  localStorage.removeItem('hrm_auth_token');
  localStorage.removeItem('hrm_auth_user');
  state.currentUser = null;
  document.getElementById('mainApp')?.classList.add('hidden');
  document.getElementById('authScreen')?.classList.remove('hidden');
  lucide.createIcons();
}

function updateHeaderUserInfo(user) {
  if (!user) return;
  const initials = (user.name || 'US').slice(0, 2).toUpperCase();
  
  // Desktop header elements
  const avatarEl = document.getElementById('userAvatarText');
  if (avatarEl) avatarEl.innerText = initials;
  const nameEl = document.getElementById('topbarUserName');
  if (nameEl) nameEl.innerText = user.name;
  const roleEl = document.getElementById('topbarUserRole');
  if (roleEl) roleEl.innerText = user.roleLabel || user.role;

  // Mobile initials
  const mobileAvatar = document.querySelector('header.md\\:hidden .w-8.h-8.rounded-full');
  if (mobileAvatar) mobileAvatar.innerText = initials;
}

function applyUserPermissionsToUI(user) {
  if (!user) return;
  // If user has specific branch scope, auto set branch filter
  if (user.scope && user.scope !== 'all') {
    const filterSelect = document.getElementById('branchFilter');
    if (filterSelect) {
      if (user.scope === 'branch_HN') filterSelect.value = 'HN';
      else if (user.scope === 'branch_HCM') filterSelect.value = 'HCM';
      else if (user.scope === 'branch_DN') filterSelect.value = 'DN';
    }
  }

  // Check module view permissions
  if (user.role !== 'admin' && user.permissions) {
    const navItems = {
      overview: 'dashboard',
      employees: 'employees',
      departments: 'departments',
      branches: 'branches',
      positions: 'positions',
      leaves: 'leaves',
      attendance: 'attendance',
      payroll: 'payroll',
      reports: 'reports',
      users: 'users',
      settings: 'settings'
    };

    Object.entries(navItems).forEach(([modKey, routeKey]) => {
      const canView = user.permissions[modKey]?.view;
      const navBtn = document.querySelector(`[data-nav-route="${routeKey}"]`);
      if (navBtn) {
        if (canView === false) {
          navBtn.classList.add('hidden');
        } else {
          navBtn.classList.remove('hidden');
        }
      }
    });
  }
}

// -------------------------------------------------------------
// AUTHENTICATION FORM HANDLERS
// -------------------------------------------------------------
async function handleLoginSubmit(event) {
  event.preventDefault();
  const errBox = document.getElementById('loginErrorBox');
  const errMsg = document.getElementById('loginErrorMsg');
  const submitBtn = document.getElementById('loginBtn');

  if (errBox) errBox.classList.add('hidden');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> <span>Đang xác thực...</span>`;
    lucide.createIcons();
  }

  try {
    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value;

    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Đăng nhập không thành công');

    localStorage.setItem('hrm_auth_token', data.token);
    localStorage.setItem('hrm_auth_user', JSON.stringify(data.user));
    state.currentUser = data.user;

    showToast(`Đăng nhập thành công! Chào mừng ${data.user.name}`, 'success');
    handleAuthenticated(data.user);

  } catch (err) {
    if (errBox && errMsg) {
      errBox.classList.remove('hidden');
      errMsg.innerText = err.message;
      lucide.createIcons();
    }
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = `<span>➔ Đăng nhập</span>`;
    }
  }
}

function quickLoginFill(username, password) {
  const uInput = document.getElementById('loginUsername');
  const pInput = document.getElementById('loginPassword');
  if (uInput) uInput.value = username;
  if (pInput) pInput.value = password;
  document.getElementById('loginErrorBox')?.classList.add('hidden');
}

async function logoutPrompt() {
  if (confirm('Bạn có chắc chắn muốn đăng xuất khỏi hệ thống HRM không?')) {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (e) {}
    showToast('Đã đăng xuất phiên làm việc an toàn.');
    handleUnauthenticated();
  }
}

function openChangePasswordModal() {
  document.getElementById('cpCurrentPassword').value = '';
  document.getElementById('cpNewPassword').value = '';
  document.getElementById('cpConfirmPassword').value = '';
  openModal('modalChangePassword');
}

async function handleChangePasswordSubmit(e) {
  e.preventDefault();
  const currentPassword = document.getElementById('cpCurrentPassword').value;
  const newPassword = document.getElementById('cpNewPassword').value;
  const confirmPassword = document.getElementById('cpConfirmPassword').value;

  if (newPassword !== confirmPassword) {
    showToast('Xác nhận mật khẩu mới không khớp!', 'error');
    return;
  }

  const btn = document.getElementById('cpSubmitBtn');
  if (btn) btn.disabled = true;

  try {
    const res = await fetch('/api/auth/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword, newPassword, confirmPassword })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Lỗi khi đổi mật khẩu');

    showToast(data.message || 'Đổi mật khẩu thành công!', 'success');
    closeModal('modalChangePassword');
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
}

// -------------------------------------------------------------
// NAVIGATION & ROUTING
// -------------------------------------------------------------
function initRouter() {
  const hash = window.location.hash.replace('#', '') || 'dashboard';
  navigate(hash);

  const urlParams = new URLSearchParams(window.location.search);
  const payslipParam = urlParams.get('payslip');
  if (payslipParam) {
    setTimeout(() => {
      if (typeof openPayslipModal === 'function') openPayslipModal(payslipParam);
    }, 600);
  }

  window.addEventListener('hashchange', () => {
    const newHash = window.location.hash.replace('#', '') || 'dashboard';
    navigate(newHash);
  });
}

function navigate(routeName) {
  state.currentRoute = routeName;

  // Update URL hash without extra history jump if same
  if (window.location.hash !== `#${routeName}`) {
    window.location.hash = routeName;
  }

  // Update views visibility
  document.querySelectorAll('.app-view').forEach(view => {
    view.classList.add('hidden');
  });
  const targetView = document.getElementById(`view-${routeName}`);
  if (targetView) {
    targetView.classList.remove('hidden');
  }

  // Update sidebar active link
  document.querySelectorAll('.sidebar-link').forEach(link => {
    link.classList.remove('active');
    const href = link.getAttribute('href');
    if (href === `#${routeName}`) {
      link.classList.add('active');
    }
  });

  // Update mobile bottom nav active
  document.querySelectorAll('.mobile-nav-bar button').forEach(btn => {
    btn.classList.remove('text-brand-600', 'font-bold');
    btn.classList.add('text-slate-500');
  });
  const mobBtn = document.getElementById(`mobileNav-${routeName}`);
  if (mobBtn) {
    mobBtn.classList.remove('text-slate-500');
    mobBtn.classList.add('text-brand-600', 'font-bold');
  }

  // Close mobile drawer if open
  closeMobileSidebar();

  // Load view-specific data
  if (routeName === 'dashboard') {
    loadDashboardStats();
  } else if (routeName === 'employees') {
    loadEmployeesList();
  } else if (routeName === 'departments') {
    loadDepartmentsView();
  } else if (routeName === 'branches') {
    loadBranchesView();
  } else if (routeName === 'positions') {
    loadPositionsView();
  } else if (routeName === 'leaves') {
    loadLeavesList();
  } else if (routeName === 'attendance') {
    loadAttendanceView();
  } else if (routeName === 'payroll') {
    loadPayrollView();
  } else if (routeName === 'reports') {
    loadReportsView();
  } else if (routeName === 'users') {
    loadUsersView();
  } else if (routeName === 'settings') {
    loadSettingsView();
  }

  lucide.createIcons();
}

function navigateWithTab(route, tab) {
  state.currentEmployeeTab = tab;
  navigate(route);
  setEmployeeTab(tab);
}

// -------------------------------------------------------------
// EVENT LISTENERS & SHORTCUTS
// -------------------------------------------------------------
function initEventListeners() {
  // Mobile sidebar toggle
  const mobileMenuBtn = document.getElementById('mobileMenuBtn');
  const closeSidebarBtn = document.getElementById('closeSidebarBtn');
  const sidebarOverlay = document.getElementById('sidebarOverlay');

  if (mobileMenuBtn) mobileMenuBtn.addEventListener('click', openMobileSidebar);
  if (closeSidebarBtn) closeSidebarBtn.addEventListener('click', closeMobileSidebar);
  if (sidebarOverlay) sidebarOverlay.addEventListener('click', closeMobileSidebar);

  // Global Ctrl+K shortcut
  window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      const input = document.getElementById('globalSearchInput');
      if (input) {
        input.focus();
        input.select();
      }
    }
  });

  // Global Search input
  const globalSearchInput = document.getElementById('globalSearchInput');
  if (globalSearchInput) {
    globalSearchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const val = globalSearchInput.value.trim();
        if (val) {
          navigate('employees');
          const empSearch = document.getElementById('empSearchInput');
          if (empSearch) {
            empSearch.value = val;
            loadEmployeesList();
          }
        }
      }
    });
  }

  // Close dropdowns on outside click
  window.addEventListener('click', (e) => {
    const notifBtn = document.getElementById('notifBellBtn');
    const notifDropdown = document.getElementById('notifDropdown');
    if (notifDropdown && !notifDropdown.contains(e.target) && !notifBtn.contains(e.target)) {
      notifDropdown.classList.add('hidden');
    }

    const userBtn = document.getElementById('userProfileBtn');
    const userDropdown = document.getElementById('userDropdown');
    if (userDropdown && !userDropdown.contains(e.target) && !userBtn.contains(e.target)) {
      userDropdown.classList.add('hidden');
    }
  });
}

function openMobileSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  if (sidebar) sidebar.classList.remove('-translate-x-full');
  if (overlay) overlay.classList.remove('hidden');
}

function closeMobileSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  if (sidebar) sidebar.classList.add('-translate-x-full');
  if (overlay) overlay.classList.add('hidden');
}

// -------------------------------------------------------------
// DATA LOADING
// -------------------------------------------------------------
async function loadAllInitialData() {
  try {
    const [bRes, dRes, pRes] = await Promise.all([
      fetch('/api/branches').then(r => r.json()),
      fetch('/api/departments').then(r => r.json()),
      fetch('/api/positions').then(r => r.json())
    ]);
    state.branches = bRes;
    state.departments = dRes;
    state.positions = pRes;

    populateFilterDropdowns();
    loadDashboardStats();
    loadNotificationCenter();
  } catch (err) {
    console.error('Failed to load initial data:', err);
    showToast('Lỗi tải dữ liệu khởi tạo', 'error');
  }
}

function refreshData() {
  showToast('Đang làm mới dữ liệu...');
  loadAllInitialData();
  if (state.currentRoute === 'employees') loadEmployeesList();
  if (state.currentRoute === 'leaves') loadLeavesList();
}

function populateFilterDropdowns() {
  // Populate Employee Dept filter
  const deptSelect = document.getElementById('empDeptSelect');
  if (deptSelect) {
    deptSelect.innerHTML = '<option value="all">Tất cả phòng ban</option>' +
      state.departments.map(d => `<option value="${d.id}">${d.name}</option>`).join('');
  }

  // Populate Employee Position filter
  const posSelect = document.getElementById('empPositionSelect');
  if (posSelect) {
    posSelect.innerHTML = '<option value="all">Tất cả vị trí</option>' +
      state.positions.map(p => `<option value="${p.id}">${p.title}</option>`).join('');
  }
}

// -------------------------------------------------------------
// 1. DASHBOARD & CHARTS (MATCHING SCREENSHOT 12)
// -------------------------------------------------------------
async function loadDashboardStats() {
  const branchFilter = document.getElementById('dashboardBranchFilter')?.value || 'all';
  try {
    const res = await fetch(`/api/stats?branch=${branchFilter}`);
    const data = await res.json();
    const kpis = data.kpis;

    // Update KPI Numbers
    document.getElementById('kpiTotalEmp').innerText = kpis.totalEmployees;
    document.getElementById('kpiNewEmp').innerText = kpis.newThisMonth;
    document.getElementById('kpiLeftEmp').innerText = kpis.leftThisMonth;
    document.getElementById('kpiExpiringContracts').innerText = kpis.expiringContracts;
    document.getElementById('kpiProbationCount').innerText = kpis.probationCount;
    document.getElementById('kpiBirthdayCount').innerText = kpis.birthdaysThisMonth;
    document.getElementById('kpiAvgTenure').innerText = (kpis.avgTenure || '3.8').toString().replace('.', ',');
    document.getElementById('kpiPendingLeaves').innerText = kpis.pendingLeavesCount;

    // Sidebar badge
    const sidebarBadge = document.getElementById('sidebarEmpCountBadge');
    if (sidebarBadge) sidebarBadge.innerText = kpis.totalEmployees;

    // Render Sparklines
    renderSparkline('sparklineTotalEmp', [72, 72, 73, 74, 75, 76, 76], '#2563eb');
    renderSparkline('sparklineNewEmp', [1, 2, 0, 1, 3, 1, 0], '#10b981', 'bar');
    renderSparkline('sparklineLeftEmp', [0, 3, 2, 0, 1, 0, 0], '#f43f5e', 'bar');
    renderSparkline('sparklineContracts', [1, 3, 2, 4, 3, 2], '#f59e0b', 'bar');
    renderSparkline('sparklineTenure', [2, 3, 3.5, 3.8, 3.8], '#8b5cf6', 'bar');

    // Render 12-Month Headcount Chart
    renderHeadcount12MonthsChart(data.charts);

    // Render Sub-Charts
    renderBranchesDonut(data.charts.branchStats);
    renderGenderDonut(data.charts.genderStats);
    renderAgeBar(data.charts.ageGroups);
    renderTenureBar(data.charts.tenureGroups);
    renderDepartmentBar(data.charts.departmentStats);

  } catch (err) {
    console.error('Failed to load dashboard stats:', err);
  }
}

function renderSparkline(canvasId, values, color, type = 'line') {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  if (state.chartInstances[canvasId]) {
    state.chartInstances[canvasId].destroy();
  }

  const ctx = canvas.getContext('2d');
  const chartConfig = {
    type: type,
    data: {
      labels: values.map((_, i) => i),
      datasets: [{
        data: values,
        borderColor: color,
        backgroundColor: type === 'bar' ? color : 'rgba(37, 99, 235, 0.08)',
        borderWidth: 1.5,
        fill: type === 'line',
        tension: 0.4,
        pointRadius: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { enabled: false } },
      scales: { x: { display: false }, y: { display: false } }
    }
  };

  state.chartInstances[canvasId] = new Chart(ctx, chartConfig);
}

function renderHeadcount12MonthsChart(chartData) {
  const canvas = document.getElementById('chartHeadcount12Months');
  if (!canvas) return;

  if (state.chartInstances['chartHeadcount12Months']) {
    state.chartInstances['chartHeadcount12Months'].destroy();
  }

  const ctx = canvas.getContext('2d');
  state.chartInstances['chartHeadcount12Months'] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: chartData.months12,
      datasets: [
        {
          type: 'bar',
          label: 'Vào làm',
          data: chartData.joinedData,
          backgroundColor: '#3b82f6',
          borderRadius: 4,
          barPercentage: 0.5,
          yAxisID: 'yBar'
        },
        {
          type: 'bar',
          label: 'Nghỉ việc',
          data: chartData.leftData,
          backgroundColor: '#f87171',
          borderRadius: 4,
          barPercentage: 0.5,
          yAxisID: 'yBar'
        },
        {
          type: 'line',
          label: 'Tổng nhân sự',
          data: chartData.totalByMonth,
          borderColor: '#10b981',
          backgroundColor: 'transparent',
          borderWidth: 2.5,
          tension: 0.3,
          pointBackgroundColor: '#10b981',
          pointRadius: 3,
          yAxisID: 'yLine'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(15, 23, 42, 0.9)',
          padding: 10,
          titleFont: { size: 12, weight: 'bold' },
          bodyFont: { size: 11 },
          cornerRadius: 8
        }
      },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 10 }, color: '#64748b' } },
        yBar: {
          type: 'linear',
          position: 'left',
          max: 4,
          grid: { color: '#f1f5f9' },
          ticks: { stepSize: 1, font: { size: 10 }, color: '#94a3b8' }
        },
        yLine: {
          type: 'linear',
          position: 'right',
          min: 60,
          max: 85,
          grid: { display: false },
          ticks: { stepSize: 5, font: { size: 10 }, color: '#10b981' }
        }
      }
    }
  });
}

function renderBranchesDonut(branchStats) {
  const canvas = document.getElementById('chartBranchesDonut');
  if (!canvas) return;
  if (state.chartInstances['chartBranchesDonut']) state.chartInstances['chartBranchesDonut'].destroy();

  state.chartInstances['chartBranchesDonut'] = new Chart(canvas.getContext('2d'), {
    type: 'doughnut',
    data: {
      labels: ['Hà Nội', 'TP. Hồ Chí Minh', 'Đà Nẵng'],
      datasets: [{
        data: branchStats ? branchStats.map(b => b.count) : [45, 23, 8],
        backgroundColor: ['#2563eb', '#10b981', '#f59e0b'],
        borderWidth: 2,
        borderColor: '#ffffff'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '72%',
      plugins: { legend: { display: false } }
    }
  });
}

function renderGenderDonut(genderStats) {
  const canvas = document.getElementById('chartGenderDonut');
  if (!canvas) return;
  if (state.chartInstances['chartGenderDonut']) state.chartInstances['chartGenderDonut'].destroy();

  state.chartInstances['chartGenderDonut'] = new Chart(canvas.getContext('2d'), {
    type: 'doughnut',
    data: {
      labels: ['Nam', 'Nữ'],
      datasets: [{
        data: genderStats ? [genderStats.male, genderStats.female] : [44, 32],
        backgroundColor: ['#3b82f6', '#ec4899'],
        borderWidth: 2,
        borderColor: '#ffffff'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '72%',
      plugins: { legend: { display: false } }
    }
  });
}

function renderAgeBar(ageGroups) {
  const canvas = document.getElementById('chartAgeBar');
  if (!canvas) return;
  if (state.chartInstances['chartAgeBar']) state.chartInstances['chartAgeBar'].destroy();

  const labels = Object.keys(ageGroups || { '<25': 3, '25-29': 26, '30-34': 26, '35-39': 14, '40-49': 6, '50+': 1 });
  const data = Object.values(ageGroups || { '<25': 3, '25-29': 26, '30-34': 26, '35-39': 14, '40-49': 6, '50+': 1 });

  state.chartInstances['chartAgeBar'] = new Chart(canvas.getContext('2d'), {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        data: data,
        backgroundColor: '#8b5cf6',
        borderRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 9 }, color: '#64748b' } },
        y: { grid: { color: '#f1f5f9' }, ticks: { font: { size: 9 }, color: '#94a3b8' } }
      }
    }
  });
}

function renderTenureBar(tenureGroups) {
  const canvas = document.getElementById('chartTenureBar');
  if (!canvas) return;
  if (state.chartInstances['chartTenureBar']) state.chartInstances['chartTenureBar'].destroy();

  const labels = Object.keys(tenureGroups || { '<1 năm': 13, '1-2 năm': 11, '2-3 năm': 6, '3-5 năm': 18, '5+ năm': 28 });
  const data = Object.values(tenureGroups || { '<1 năm': 13, '1-2 năm': 11, '2-3 năm': 6, '3-5 năm': 18, '5+ năm': 28 });

  state.chartInstances['chartTenureBar'] = new Chart(canvas.getContext('2d'), {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        data: data,
        backgroundColor: '#06b6d4',
        borderRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 9 }, color: '#64748b' } },
        y: { grid: { color: '#f1f5f9' }, ticks: { font: { size: 9 }, color: '#94a3b8' } }
      }
    }
  });
}

function renderDepartmentBar(deptStats) {
  const canvas = document.getElementById('chartDepartmentBar');
  if (!canvas) return;
  if (state.chartInstances['chartDepartmentBar']) state.chartInstances['chartDepartmentBar'].destroy();

  const list = deptStats || [
    { name: 'Kỹ thuật', count: 19 },
    { name: 'Kinh doanh', count: 14 },
    { name: 'Marketing', count: 7 },
    { name: 'Kiểm thử chất lượng', count: 6 },
    { name: 'Chăm sóc khách hàng', count: 6 },
    { name: 'Tài chính - Kế toán', count: 4 },
    { name: 'Công nghệ thông tin', count: 4 },
    { name: 'Kinh doanh miền Trung', count: 4 },
    { name: 'Ban Giám đốc', count: 3 },
    { name: 'Nhân sự', count: 3 },
    { name: 'Thiết kế sản phẩm', count: 3 },
    { name: 'Vận hành', count: 3 }
  ];

  state.chartInstances['chartDepartmentBar'] = new Chart(canvas.getContext('2d'), {
    type: 'bar',
    data: {
      labels: list.map(d => d.name),
      datasets: [{
        data: list.map(d => d.count),
        backgroundColor: '#3b82f6',
        borderRadius: 4
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { color: '#f1f5f9' }, ticks: { font: { size: 10 }, color: '#94a3b8' } },
        y: { grid: { display: false }, ticks: { font: { size: 11 }, color: '#334155' } }
      }
    }
  });
}

// -------------------------------------------------------------
// 2. EMPLOYEES DIRECTORY (MATCHING SCREENSHOT 11)
// -------------------------------------------------------------
async function loadEmployeesList() {
  const tab = state.currentEmployeeTab || 'working_all';
  const branch = document.getElementById('empBranchSelect')?.value || 'all';
  const dept = document.getElementById('empDeptSelect')?.value || 'all';
  const pos = document.getElementById('empPositionSelect')?.value || 'all';
  const search = document.getElementById('empSearchInput')?.value || '';

  // Apply RBAC scope if role === 'viewer' (e.g. HCM only)
  let effectiveBranch = branch;
  if (state.currentRole === 'viewer') {
    effectiveBranch = 'HCM';
  }

  const query = new URLSearchParams({
    tab,
    branch: effectiveBranch,
    department: dept,
    position: pos,
    search
  });

  try {
    const res = await fetch(`/api/employees?${query.toString()}`);
    const result = await res.json();
    state.filteredEmployees = result.data;

    // Update Counts on Tab buttons
    if (result.counts) {
      updateEmployeeTabCounts(result.counts);
    }

    renderEmployeesTable(result.data);
  } catch (err) {
    console.error('Failed to load employees:', err);
  }
}

function updateEmployeeTabCounts(counts) {
  const setTxt = (id, val) => {
    const el = document.querySelector(`#${id} .badge-count`);
    if (el) el.innerText = val;
  };
  setTxt('empTab-working_all', counts.working_all);
  setTxt('empTab-working', counts.working);
  setTxt('empTab-probation', counts.probation);
  setTxt('empTab-temporary_leave', counts.temporary_leave);
  setTxt('empTab-maternity_leave', counts.maternity_leave);
  setTxt('empTab-resigned', counts.resigned);
  setTxt('empTab-all', counts.all);
}

function setEmployeeTab(tabName) {
  state.currentEmployeeTab = tabName;
  document.querySelectorAll('.emp-tab-btn').forEach(btn => {
    btn.classList.remove('active', 'bg-brand-600', 'text-white', 'font-bold');
    btn.classList.add('text-slate-600');
  });

  const activeBtn = document.getElementById(`empTab-${tabName}`);
  if (activeBtn) {
    activeBtn.classList.add('active', 'bg-brand-600', 'text-white', 'font-bold');
    activeBtn.classList.remove('text-slate-600');
  }

  loadEmployeesList();
}

function renderEmployeesTable(employees) {
  const tbody = document.getElementById('employeesTableBody');
  const showingCount = document.getElementById('empShowingCount');
  const totalCount = document.getElementById('empTotalCount');

  if (showingCount) showingCount.innerText = employees.length > 0 ? `1-${employees.length}` : '0';
  if (totalCount) totalCount.innerText = employees.length;

  if (!tbody) return;
  if (employees.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" class="p-8 text-center text-slate-400">
          <i data-lucide="users" class="w-8 h-8 mx-auto mb-2 opacity-40"></i>
          <p class="font-medium text-sm">Không tìm thấy nhân viên nào phù hợp</p>
        </td>
      </tr>
    `;
    lucide.createIcons();
    return;
  }

  tbody.innerHTML = employees.map(emp => {
    const isSelected = state.selectedEmployeeIds.has(emp.id);
    let statusClass = 'text-emerald-700 bg-emerald-50';
    let statusDot = 'bg-emerald-500';

    if (emp.status === 'probation') {
      statusClass = 'text-blue-700 bg-blue-50';
      statusDot = 'bg-blue-500';
    } else if (emp.status === 'temporary_leave') {
      statusClass = 'text-amber-700 bg-amber-50';
      statusDot = 'bg-amber-500';
    } else if (emp.status === 'maternity_leave') {
      statusClass = 'text-pink-700 bg-pink-50';
      statusDot = 'bg-pink-500';
    } else if (emp.status === 'resigned') {
      statusClass = 'text-slate-600 bg-slate-100';
      statusDot = 'bg-slate-400';
    }

    const isExpiring = emp.contractEndDate && emp.contractEndDate.includes('2026') && !emp.contractEndDate.includes('Không thời hạn');

    return `
      <tr class="hover:bg-slate-50/80 transition cursor-pointer" onclick="handleEmployeeRowClick(event, '${emp.id}')">
        <td class="p-3.5 text-center" onclick="event.stopPropagation()">
          <input type="checkbox" onchange="toggleSelectEmployee('${emp.id}')" ${isSelected ? 'checked' : ''} class="rounded border-slate-300 text-brand-600 focus:ring-brand-500">
        </td>
        <td class="p-3.5">
          <div class="flex items-center gap-3">
            <img src="${emp.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100'}" class="w-9 h-9 rounded-xl object-cover border border-slate-200" alt="Avatar">
            <div>
              <p class="font-bold text-slate-900 text-sm hover:text-brand-600">${emp.fullName}</p>
              <p class="text-[11px] text-slate-400 font-mono">${emp.code} • ${emp.gender} • ${emp.age} tuổi</p>
            </div>
          </div>
        </td>
        <td class="p-3.5">
          <p class="font-medium text-slate-800">${emp.departmentName || '—'}</p>
          <p class="text-[11px] text-slate-400">${emp.branchName || '—'}</p>
        </td>
        <td class="p-3.5">
          <p class="font-medium text-slate-800">${emp.positionTitle || '—'}</p>
          <span class="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-600 mt-0.5">${emp.level || 'Nhân viên'}</span>
        </td>
        <td class="p-3.5 text-[11px]">
          <p class="font-mono text-slate-700">${emp.phone || '—'}</p>
          <p class="text-slate-400 truncate max-w-[130px]">${emp.email || '—'}</p>
        </td>
        <td class="p-3.5 text-[11px]">
          <p class="font-medium text-slate-800">${emp.joinDate || '—'}</p>
          <p class="text-slate-400">${emp.tenure || '—'}</p>
        </td>
        <td class="p-3.5 text-[11px]">
          <p class="font-medium text-slate-800">${emp.contractType || '—'}</p>
          <p class="text-slate-500 font-medium ${isExpiring ? 'text-amber-600 font-bold' : ''}">
            ${emp.contractEndDate ? (emp.contractEndDate.startsWith('Đến') ? emp.contractEndDate : `Đến ${emp.contractEndDate}`) : '—'}
          </p>
        </td>
        <td class="p-3.5">
          <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${statusClass}">
            <span class="w-1.5 h-1.5 rounded-full ${statusDot}"></span>
            <span>${emp.statusLabel || 'Đang làm việc'}</span>
          </span>
        </td>
        <td class="p-3.5 text-right" onclick="event.stopPropagation()">
          <div class="relative inline-block text-left">
            <button onclick="toggleRowMenu(event, '${emp.id}')" class="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100">
              <i data-lucide="more-vertical" class="w-4 h-4"></i>
            </button>
            <div id="rowMenu-${emp.id}" class="row-menu-dropdown hidden absolute right-0 mt-1 w-48 bg-white border border-slate-200 rounded-2xl shadow-xl z-30 p-1.5 text-xs text-left">
              <button onclick="viewEmployeeDetail('${emp.id}')" class="w-full text-left px-3 py-1.5 rounded-lg hover:bg-slate-50 flex items-center gap-2">
                <i data-lucide="eye" class="w-3.5 h-3.5 text-slate-400"></i> Xem chi tiết
              </button>
              <button onclick="openEditEmployee('${emp.id}')" class="w-full text-left px-3 py-1.5 rounded-lg hover:bg-slate-50 flex items-center gap-2">
                <i data-lucide="edit-3" class="w-3.5 h-3.5 text-slate-400"></i> Sửa hồ sơ
              </button>
              <button onclick="openTransferModal('${emp.id}')" class="w-full text-left px-3 py-1.5 rounded-lg hover:bg-slate-50 flex items-center gap-2">
                <i data-lucide="arrow-left-right" class="w-3.5 h-3.5 text-slate-400"></i> Điều chuyển / lương
              </button>
              <button onclick="openContractRenewalModal('${emp.id}')" class="w-full text-left px-3 py-1.5 rounded-lg hover:bg-slate-50 flex items-center gap-2">
                <i data-lucide="file-check" class="w-3.5 h-3.5 text-slate-400"></i> Ký HĐ / Gia hạn
              </button>
              ${emp.status !== 'resigned' ? `
                <button onclick="openResignModal('${emp.id}')" class="w-full text-left px-3 py-1.5 rounded-lg hover:bg-rose-50 text-rose-600 flex items-center gap-2">
                  <i data-lucide="user-minus" class="w-3.5 h-3.5"></i> Ghi nhận nghỉ việc
                </button>
              ` : `
                <button onclick="openRehireModal('${emp.id}')" class="w-full text-left px-3 py-1.5 rounded-lg hover:bg-emerald-50 text-emerald-600 flex items-center gap-2">
                  <i data-lucide="user-check" class="w-3.5 h-3.5"></i> Nhận lại làm việc
                </button>
              `}
              <div class="border-t border-slate-100 my-1"></div>
              <button onclick="deleteEmployeePrompt('${emp.id}')" class="w-full text-left px-3 py-1.5 rounded-lg hover:bg-rose-50 text-rose-600 flex items-center gap-2">
                <i data-lucide="trash-2" class="w-3.5 h-3.5"></i> Xóa nhân viên
              </button>
            </div>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  lucide.createIcons();
}

function handleEmployeeRowClick(event, empId) {
  viewEmployeeDetail(empId);
}

function toggleRowMenu(event, empId) {
  event.stopPropagation();
  document.querySelectorAll('.row-menu-dropdown').forEach(m => {
    if (m.id !== `rowMenu-${empId}`) m.classList.add('hidden');
  });
  const menu = document.getElementById(`rowMenu-${empId}`);
  if (menu) menu.classList.toggle('hidden');
}

function toggleSelectAllEmployees(masterCheckbox) {
  if (masterCheckbox.checked) {
    state.filteredEmployees.forEach(e => state.selectedEmployeeIds.add(e.id));
  } else {
    state.selectedEmployeeIds.clear();
  }
  renderEmployeesTable(state.filteredEmployees);
}

function toggleSelectEmployee(empId) {
  if (state.selectedEmployeeIds.has(empId)) {
    state.selectedEmployeeIds.delete(empId);
  } else {
    state.selectedEmployeeIds.add(empId);
  }
}

function onEmployeeSearchChange() {
  clearTimeout(window.searchDebounce);
  window.searchDebounce = setTimeout(() => {
    loadEmployeesList();
  }, 250);
}

function resetEmployeeFilters() {
  document.getElementById('empSearchInput').value = '';
  document.getElementById('empBranchSelect').value = 'all';
  document.getElementById('empDeptSelect').value = 'all';
  document.getElementById('empPositionSelect').value = 'all';
  loadEmployeesList();
}

// -------------------------------------------------------------
// 3. EMPLOYEE DETAIL DRAWER (MATCHING SCREENSHOT 10)
// -------------------------------------------------------------
async function viewEmployeeDetail(empId) {
  try {
    const res = await fetch(`/api/employees/${empId}`);
    if (!res.ok) throw new Error('Không tìm thấy nhân viên');
    const emp = await res.json();
    state.currentDetailEmpId = emp.id;

    // Header info
    document.getElementById('detailEmpAvatar').src = emp.avatar || 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150';
    document.getElementById('detailEmpFullName').innerText = emp.fullName;
    document.getElementById('detailEmpCode').innerText = emp.code;
    document.getElementById('detailEmpHeadline').innerText = `${emp.positionTitle} • ${emp.departmentName} • ${emp.branchName} • ${emp.tenure}`;
    document.getElementById('detailEmpContact').innerText = `${emp.phone} • ${emp.email} • Quản lý: ${emp.managerName || '—'}`;

    // Badges & Actions
    const resignActionContainer = document.getElementById('detailEmpResignActionContainer');
    if (emp.status === 'resigned') {
      resignActionContainer.innerHTML = `
        <button onclick="openRehireModal('${emp.id}')" class="px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg font-semibold hover:bg-emerald-100 flex items-center gap-1">
          <i data-lucide="user-check" class="w-3.5 h-3.5"></i> Nhận lại làm việc
        </button>
      `;
    } else {
      resignActionContainer.innerHTML = `
        <button onclick="openResignModal('${emp.id}')" class="px-2.5 py-1 bg-rose-50 text-rose-700 border border-rose-200 rounded-lg font-semibold hover:bg-rose-100 flex items-center gap-1">
          <i data-lucide="user-minus" class="w-3.5 h-3.5"></i> Ghi nhận nghỉ việc
        </button>
      `;
    }

    // Badge counts
    document.getElementById('detailBadgeDocs').innerText = (emp.documents || []).length;
    document.getElementById('detailBadgeLeaves').innerText = (emp.leaves || []).length;
    document.getElementById('detailBadgeRewards').innerText = (emp.rewards || []).length;
    document.getElementById('detailBadgeHistory').innerText = (emp.workHistory || []).length;

    // Open Modal
    openModal('modalEmployeeDetail');
    setDetailTab(state.currentDetailTab || 'info', emp);

  } catch (err) {
    console.error('Error opening employee detail:', err);
    showToast('Lỗi khi mở hồ sơ nhân viên', 'error');
  }
}

function setDetailTab(tabName, empData) {
  state.currentDetailTab = tabName;
  document.querySelectorAll('.emp-detail-tab-btn').forEach(btn => {
    btn.classList.remove('active', 'border-brand-600', 'text-brand-600');
    btn.classList.add('border-transparent', 'text-slate-500');
  });

  const activeBtn = document.getElementById(`empDetailTab-${tabName}`);
  if (activeBtn) {
    activeBtn.classList.add('active', 'border-brand-600', 'text-brand-600');
    activeBtn.classList.remove('border-transparent', 'text-slate-500');
  }

  // If empData not provided, fetch current
  if (!empData && state.currentDetailEmpId) {
    fetch(`/api/employees/${state.currentDetailEmpId}`)
      .then(r => r.json())
      .then(emp => renderDetailTabContent(tabName, emp));
  } else if (empData) {
    renderDetailTabContent(tabName, empData);
  }
}

function renderDetailTabContent(tabName, emp) {
  const container = document.getElementById('detailTabContent');
  if (!container) return;

  if (tabName === 'info') {
    container.innerHTML = `
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs sm:text-sm">
        <div class="space-y-4">
          <div class="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-3">
            <h4 class="font-bold text-slate-800 text-xs uppercase tracking-wider">Thông tin cá nhân</h4>
            <div class="grid grid-cols-2 gap-2 text-xs">
              <span class="text-slate-400">Ngày sinh:</span><span class="font-medium text-slate-800">${emp.birthDate || '—'}</span>
              <span class="text-slate-400">Giới tính:</span><span class="font-medium text-slate-800">${emp.gender || '—'}</span>
              <span class="text-slate-400">Tình trạng hôn nhân:</span><span class="font-medium text-slate-800">${emp.maritalStatus || 'Độc thân'}</span>
              <span class="text-slate-400">Nguyên quán:</span><span class="font-medium text-slate-800">${emp.hometown || 'Hà Nội'}</span>
            </div>
          </div>

          <div class="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-3">
            <h4 class="font-bold text-slate-800 text-xs uppercase tracking-wider">Giấy tờ tùy thân</h4>
            <div class="grid grid-cols-2 gap-2 text-xs">
              <span class="text-slate-400">Số CCCD / CMND:</span><span class="font-mono font-bold text-slate-800">${emp.idCard || '—'}</span>
              <span class="text-slate-400">Ngày cấp:</span><span class="font-medium text-slate-800">${emp.idCardDate || '—'}</span>
              <span class="text-slate-400">Nơi cấp:</span><span class="font-medium text-slate-800">${emp.idCardPlace || 'Cục Cảnh sát QLHC'}</span>
              <span class="text-slate-400">Mã số thuế cá nhân:</span><span class="font-mono text-slate-800">${emp.taxCode || '—'}</span>
            </div>
          </div>
        </div>

        <div class="space-y-4">
          <div class="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-3">
            <h4 class="font-bold text-slate-800 text-xs uppercase tracking-wider">Học vấn & Bằng cấp</h4>
            <div class="grid grid-cols-2 gap-2 text-xs">
              <span class="text-slate-400">Trình độ cao nhất:</span><span class="font-medium text-brand-700 bg-brand-50 px-2 py-0.5 rounded inline-block w-fit">${emp.educationLevel || 'Đại học'}</span>
              <span class="text-slate-400">Chuyên ngành:</span><span class="font-medium text-slate-800">${emp.major || 'Quản trị nhân lực'}</span>
              <span class="text-slate-400">Trường đào tạo:</span><span class="font-medium text-slate-800">${emp.school || 'Đại học Kinh tế Quốc dân'}</span>
            </div>
          </div>

          <div class="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-3">
            <h4 class="font-bold text-slate-800 text-xs uppercase tracking-wider">Tài khoản thanh toán</h4>
            <div class="grid grid-cols-2 gap-2 text-xs">
              <span class="text-slate-400">Số tài khoản:</span><span class="font-mono font-bold text-slate-800">${emp.bankAccount || '1903456789012'}</span>
              <span class="text-slate-400">Ngân hàng:</span><span class="font-medium text-slate-800">${emp.bankName || 'Techcombank'}</span>
              <span class="text-slate-400">Chi nhánh:</span><span class="font-medium text-slate-800">${emp.bankBranch || 'Ba Đình'}</span>
            </div>
          </div>
        </div>
      </div>
    `;
  } else if (tabName === 'job') {
    // 4 Stat Chips
    container.innerHTML = `
      <div class="space-y-6">
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div class="p-3.5 bg-purple-50/70 border border-purple-100 rounded-2xl">
            <p class="text-xs text-purple-700 font-semibold">Thâm niên</p>
            <p class="text-lg font-extrabold text-slate-900 mt-1">${emp.tenure}</p>
          </div>
          <div class="p-3.5 bg-amber-50/70 border border-amber-100 rounded-2xl">
            <p class="text-xs text-amber-700 font-semibold">Hợp đồng còn lại</p>
            <p class="text-lg font-extrabold text-slate-900 mt-1">${emp.contractEndDate === 'Không thời hạn' ? 'Vô thời hạn' : emp.contractEndDate}</p>
          </div>
          <div class="p-3.5 bg-emerald-50/70 border border-emerald-100 rounded-2xl">
            <p class="text-xs text-emerald-700 font-semibold">Ngày phép năm còn lại</p>
            <p class="text-lg font-extrabold text-slate-900 mt-1">${emp.annualLeaveRemaining || 10} <span class="text-xs font-normal text-slate-500">ngày</span></p>
          </div>
          <div class="p-3.5 bg-blue-50/70 border border-blue-100 rounded-2xl">
            <p class="text-xs text-blue-700 font-semibold">Cấp dưới trực tiếp</p>
            <p class="text-lg font-extrabold text-slate-900 mt-1">${(emp.subordinates || []).length} <span class="text-xs font-normal text-slate-500">nhân sự</span></p>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs sm:text-sm">
          <!-- Tổ chức -->
          <div class="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-3">
            <h4 class="font-bold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-1.5">
              <i data-lucide="building" class="w-4 h-4 text-brand-600"></i> Tổ chức
            </h4>
            <div class="grid grid-cols-2 gap-2 text-xs">
              <span class="text-slate-400">Chi nhánh:</span><span class="font-semibold text-slate-800">${emp.branchName}</span>
              <span class="text-slate-400">Phòng ban:</span><span class="font-semibold text-slate-800">${emp.departmentName}</span>
              <span class="text-slate-400">Vị trí:</span><span class="font-semibold text-slate-800">${emp.positionTitle}</span>
              <span class="text-slate-400">Cấp bậc:</span><span class="font-semibold text-slate-800">${emp.level}</span>
              <span class="text-slate-400">Quản lý trực tiếp:</span><span class="font-semibold text-brand-600">${emp.managerName || '—'}</span>
              <span class="text-slate-400">Hình thức làm việc:</span><span class="font-semibold text-slate-800">${emp.workType || 'Toàn thời gian'}</span>
            </div>
          </div>

          <!-- Hợp đồng lao động -->
          <div class="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-3">
            <h4 class="font-bold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-1.5">
              <i data-lucide="file-check" class="w-4 h-4 text-emerald-600"></i> Hợp đồng lao động
            </h4>
            <div class="grid grid-cols-2 gap-2 text-xs">
              <span class="text-slate-400">Loại hợp đồng:</span><span class="font-semibold text-slate-800">${emp.contractType}</span>
              <span class="text-slate-400">Số hợp đồng:</span><span class="font-mono font-semibold text-slate-800">${emp.contractNumber}</span>
              <span class="text-slate-400">Hiệu lực:</span><span class="font-semibold text-slate-800">${emp.contractStartDate} → ${emp.contractEndDate}</span>
              <span class="text-slate-400">Ngày vào làm:</span><span class="font-semibold text-slate-800">${emp.joinDate}</span>
              <span class="text-slate-400">Hết thử việc:</span><span class="font-semibold text-slate-800">${emp.probationEndDate || '—'}</span>
              <span class="text-slate-400">Ngày chính thức:</span><span class="font-semibold text-slate-800">${emp.officialDate || '—'}</span>
            </div>
          </div>

          <!-- Thu nhập -->
          <div class="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-3">
            <h4 class="font-bold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-1.5">
              <i data-lucide="wallet" class="w-4 h-4 text-emerald-600"></i> Thu nhập
            </h4>
            <div class="grid grid-cols-2 gap-2 text-xs">
              <span class="text-slate-400">Lương cơ bản:</span><span class="font-mono font-bold text-slate-900">${(emp.baseSalary || 0).toLocaleString('vi-VN')} đ</span>
              <span class="text-slate-400">Phụ cấp:</span><span class="font-mono font-bold text-slate-900">${(emp.allowance || 0).toLocaleString('vi-VN')} đ</span>
              <span class="text-slate-400">Tổng thu nhập cố định:</span><span class="font-mono font-extrabold text-brand-700">${(emp.totalIncome || 0).toLocaleString('vi-VN')} đ</span>
              <span class="text-slate-400">Khung lương vị trí:</span><span class="text-slate-600">${emp.salaryRange || '28 tr – 40 tr'}</span>
            </div>
          </div>

          <!-- Cấp dưới trực tiếp -->
          <div class="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-3">
            <h4 class="font-bold text-slate-800 text-xs uppercase tracking-wider flex items-center justify-between">
              <span class="flex items-center gap-1.5"><i data-lucide="users" class="w-4 h-4 text-blue-600"></i> Cấp dưới trực tiếp</span>
              <span class="text-[11px] font-semibold text-slate-400">${(emp.subordinates || []).length} người</span>
            </h4>
            <div class="space-y-2">
              ${(emp.subordinates && emp.subordinates.length > 0) ? emp.subordinates.map(sub => `
                <div onclick="viewEmployeeDetail('${sub.id}')" class="flex items-center justify-between p-2 bg-white rounded-xl border border-slate-200/80 hover:border-brand-400 cursor-pointer transition">
                  <div class="flex items-center gap-2">
                    <img src="${sub.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'}" class="w-7 h-7 rounded-lg object-cover">
                    <div>
                      <p class="font-bold text-xs text-slate-900">${sub.fullName}</p>
                      <p class="text-[10px] text-slate-400">${sub.positionTitle}</p>
                    </div>
                  </div>
                  <i data-lucide="chevron-right" class="w-3.5 h-3.5 text-slate-400"></i>
                </div>
              `).join('') : '<p class="text-xs text-slate-400">Không có nhân sự báo cáo trực tiếp</p>'}
            </div>
          </div>
        </div>
      </div>
    `;
  } else if (tabName === 'docs') {
    container.innerHTML = `
      <div class="space-y-4">
        <div class="flex items-center justify-between">
          <p class="text-xs text-slate-500">Tài liệu, bản quét hợp đồng, bằng cấp lưu trữ Google Drive hoặc máy chủ</p>
          <button onclick="promptAddDocument('${emp.id}')" class="px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1">
            <i data-lucide="plus" class="w-3.5 h-3.5"></i> Thêm tài liệu
          </button>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          ${(emp.documents && emp.documents.length > 0) ? emp.documents.map(d => `
            <div class="p-3 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between">
              <div class="flex items-center gap-3">
                <div class="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
                  <i data-lucide="file" class="w-4 h-4"></i>
                </div>
                <div>
                  <p class="font-bold text-xs text-slate-800">${d.title}</p>
                  <p class="text-[10px] text-slate-400">${d.type} • ${d.date || '18/11/2026'}</p>
                </div>
              </div>
              <div class="flex items-center gap-1">
                <a href="${d.link}" target="_blank" class="p-1.5 text-brand-600 hover:bg-white rounded-lg">
                  <i data-lucide="external-link" class="w-4 h-4"></i>
                </a>
                <button onclick="deleteDocPrompt('${emp.id}', '${d.id}')" class="p-1.5 text-rose-500 hover:bg-white rounded-lg">
                  <i data-lucide="trash-2" class="w-4 h-4"></i>
                </button>
              </div>
            </div>
          `).join('') : '<p class="text-xs text-slate-400 col-span-2 py-6 text-center">Chưa có tài liệu đính kèm nào</p>'}
        </div>
      </div>
    `;
  } else if (tabName === 'leaves') {
    container.innerHTML = `
      <div class="space-y-4">
        <div class="p-4 bg-emerald-50/60 border border-emerald-100 rounded-2xl flex items-center justify-between">
          <div>
            <p class="text-xs font-bold text-emerald-950">Quỹ phép năm: ${emp.annualLeaveTotal || 12} ngày</p>
            <p class="text-[11px] text-emerald-700 mt-0.5">Tiêu chuẩn: 12 ngày • Thưởng thâm niên: ${emp.annualLeaveSeniority || 0} ngày • Đã dùng: ${emp.annualLeaveUsed || 0} ngày</p>
          </div>
          <span class="text-2xl font-black text-emerald-700">${emp.annualLeaveRemaining || 10} <span class="text-xs font-normal">ngày còn</span></span>
        </div>
        <div class="space-y-2">
          <h4 class="font-bold text-slate-800 text-xs uppercase tracking-wider">Lịch sử đơn nghỉ phép</h4>
          ${(emp.leaves && emp.leaves.length > 0) ? emp.leaves.map(l => `
            <div class="p-3 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-between text-xs">
              <div>
                <p class="font-bold text-slate-800">${l.leaveType} (${l.daysCount} ngày)</p>
                <p class="text-[11px] text-slate-400">${l.startDate} → ${l.endDate} • Lý do: ${l.reason}</p>
              </div>
              <span class="px-2 py-0.5 rounded-full font-semibold ${l.status === 'approved' ? 'bg-emerald-100 text-emerald-800' : (l.status === 'rejected' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800')}">${l.statusLabel}</span>
            </div>
          `).join('') : '<p class="text-xs text-slate-400 py-3">Chưa có yêu cầu nghỉ phép nào</p>'}
        </div>
      </div>
    `;
  } else if (tabName === 'rewards') {
    container.innerHTML = `
      <div class="space-y-4">
        <div class="flex items-center justify-between">
          <p class="text-xs text-slate-500">Ghi nhận quyết định khen thưởng hoặc xử lý kỷ luật kèm số tiền</p>
          <button onclick="openAddRewardModal('${emp.id}')" class="px-3 py-1.5 bg-brand-600 text-white rounded-xl text-xs font-semibold flex items-center gap-1">
            <i data-lucide="plus" class="w-3.5 h-3.5"></i> Thêm khen thưởng / kỷ luật
          </button>
        </div>
        <div class="space-y-2">
          ${(emp.rewards && emp.rewards.length > 0) ? emp.rewards.map(rw => `
            <div class="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between">
              <div>
                <div class="flex items-center gap-2">
                  <span class="px-2 py-0.5 rounded-md text-[10px] font-bold ${rw.type === 'Khen thưởng' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}">${rw.type}</span>
                  <p class="font-bold text-xs text-slate-900">${rw.title}</p>
                </div>
                <p class="text-xs text-slate-500 mt-1">${rw.note || ''}</p>
                <p class="text-[10px] text-slate-400 mt-0.5 font-mono">Số QĐ: ${rw.decisionNumber} • Ngày: ${rw.date}</p>
              </div>
              <span class="font-mono font-bold text-sm ${rw.type === 'Khen thưởng' ? 'text-emerald-600' : 'text-rose-600'}">
                ${rw.type === 'Khen thưởng' ? '+' : '-'}${(rw.amount || 0).toLocaleString('vi-VN')} đ
              </span>
            </div>
          `).join('') : '<p class="text-xs text-slate-400 py-6 text-center">Chưa có quyết định khen thưởng hay kỷ luật</p>'}
        </div>
      </div>
    `;
  } else if (tabName === 'history') {
    container.innerHTML = `
      <div class="space-y-4">
        <p class="text-xs text-slate-500">Lịch sử công tác được hệ thống tự động ghi nhận mỗi khi thay đổi chức danh, lương hoặc hợp đồng.</p>
        <div class="relative border-l-2 border-slate-200 ml-3 space-y-6 py-2">
          ${(emp.workHistory && emp.workHistory.length > 0) ? emp.workHistory.map(h => `
            <div class="relative pl-6">
              <span class="absolute -left-2 top-0.5 w-4 h-4 rounded-full bg-brand-600 border-2 border-white shadow-xs"></span>
              <div class="flex items-baseline gap-2">
                <span class="font-bold text-xs text-slate-900">${h.action || 'Biến động nhân sự'}</span>
                <span class="text-[11px] font-mono text-slate-400">${h.date || '—'}</span>
              </div>
              <p class="text-xs text-slate-600 mt-0.5">${h.content || ''}</p>
              ${h.decisionNumber ? `<p class="text-[10px] font-mono text-slate-400 mt-0.5">Số QĐ: ${h.decisionNumber}</p>` : ''}
            </div>
          `).join('') : '<p class="text-xs text-slate-400 pl-6">Chưa có lịch sử công tác</p>'}
        </div>
      </div>
    `;
  }

  lucide.createIcons();
}

// -------------------------------------------------------------
// 4. ADD & EDIT EMPLOYEE
// -------------------------------------------------------------
function openAddEmployeeModal() {
  document.getElementById('addEmpModalTitle').innerText = 'Thêm nhân viên mới';
  document.getElementById('formEmpId').value = '';
  document.getElementById('addEmployeeForm').reset();
  document.getElementById('formJoinDate').value = '18/11/2026';

  populateFormBranchAndDepts();
  onFormContractTypeChange();

  openModal('modalAddEmployee');
}

function openEditCurrentEmployee() {
  closeModal('modalEmployeeDetail');
  openEditEmployee(state.currentDetailEmpId);
}

async function openEditEmployee(empId) {
  try {
    const res = await fetch(`/api/employees/${empId}`);
    const emp = await res.json();

    document.getElementById('addEmpModalTitle').innerText = 'Chỉnh sửa hồ sơ nhân viên';
    document.getElementById('formEmpId').value = emp.id;
    document.getElementById('formFullName').value = emp.fullName || '';
    document.getElementById('formCode').value = emp.code || '';
    document.getElementById('formGender').value = emp.gender || 'Nam';
    document.getElementById('formBirthDate').value = emp.birthDate || '';
    document.getElementById('formIdCard').value = emp.idCard || '';
    document.getElementById('formPhone').value = emp.phone || '';
    document.getElementById('formEmail').value = emp.email || '';
    document.getElementById('formBranch').value = emp.branchId || 'HN';

    populateFormDeptsForBranch(emp.branchId || 'HN');
    document.getElementById('formDepartment').value = emp.departmentId || 'HR';
    populateFormPositionsForDept(emp.departmentId || 'HR');
    document.getElementById('formPosition').value = emp.positionId || 'REC';

    document.getElementById('formJoinDate').value = emp.joinDate || '18/11/2026';
    document.getElementById('formContractType').value = emp.contractType || 'HĐ xác định thời hạn 12 tháng';
    document.getElementById('formContractEndDate').value = emp.contractEndDate || '';
    document.getElementById('formBaseSalary').value = emp.baseSalary || 15000000;
    document.getElementById('formAllowance').value = emp.allowance || 1500000;
    document.getElementById('formAvatar').value = emp.avatar || '';

    openModal('modalAddEmployee');
  } catch (err) {
    showToast('Không thể tải thông tin nhân viên', 'error');
  }
}

function populateFormBranchAndDepts() {
  const branchSelect = document.getElementById('formBranch');
  if (branchSelect) {
    populateFormDeptsForBranch(branchSelect.value || 'HN');
  }
}

function onFormBranchChange() {
  const branchId = document.getElementById('formBranch').value;
  populateFormDeptsForBranch(branchId);
}

function populateFormDeptsForBranch(branchId) {
  const depts = state.departments.filter(d => d.branchId === branchId);
  const deptSelect = document.getElementById('formDepartment');
  if (deptSelect) {
    deptSelect.innerHTML = depts.map(d => `<option value="${d.id}">${d.name}</option>`).join('');
    if (depts.length > 0) {
      populateFormPositionsForDept(depts[0].id);
    }
  }
}

function onFormDeptChange() {
  const deptId = document.getElementById('formDepartment').value;
  populateFormPositionsForDept(deptId);
}

function populateFormPositionsForDept(deptId) {
  const posList = state.positions.filter(p => p.departmentId === deptId);
  const posSelect = document.getElementById('formPosition');
  if (posSelect) {
    posSelect.innerHTML = (posList.length > 0 ? posList : state.positions).map(p => `<option value="${p.id}">${p.title}</option>`).join('');
  }

  // Populate Manager dropdown
  const mgrSelect = document.getElementById('formManager');
  if (mgrSelect) {
    mgrSelect.innerHTML = state.filteredEmployees.slice(0, 15).map(e => `<option value="${e.id}">${e.fullName} (${e.positionTitle})</option>`).join('');
  }
}

function onFormContractTypeChange() {
  const cType = document.getElementById('formContractType').value;
  const startDate = document.getElementById('formJoinDate').value || '18/11/2026';
  const endInput = document.getElementById('formContractEndDate');
  if (!endInput) return;

  if (cType === 'HĐ không xác định thời hạn') {
    endInput.value = 'Không thời hạn';
    return;
  }

  const parts = startDate.split('/');
  if (parts.length === 3) {
    const d = parseInt(parts[0]);
    const m = parseInt(parts[1]) - 1;
    const y = parseInt(parts[2]);
    let end;
    if (cType.includes('2 tháng')) end = new Date(y, m + 2, d - 1);
    else if (cType.includes('12 tháng')) end = new Date(y + 1, m, d - 1);
    else if (cType.includes('36 tháng')) end = new Date(y + 3, m, d - 1);
    else end = new Date(y + 1, m, d - 1);

    endInput.value = `${String(end.getDate()).padStart(2, '0')}/${String(end.getMonth() + 1).padStart(2, '0')}/${end.getFullYear()}`;
  }
}

function onFormJoinDateChange() {
  onFormContractTypeChange();
}

// Real-time Duplicate Check
async function checkDuplicateField(fieldName) {
  const phone = document.getElementById('formPhone')?.value;
  const email = document.getElementById('formEmail')?.value;
  const idCard = document.getElementById('formIdCard')?.value;
  const empId = document.getElementById('formEmpId')?.value;

  const payload = { employeeId: empId };
  if (fieldName === 'phone') payload.phone = phone;
  if (fieldName === 'email') payload.email = email;
  if (fieldName === 'idCard') payload.idCard = idCard;

  try {
    const res = await fetch('/api/validate-duplicate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await res.json();
    const errorEl = document.getElementById(`dupError-${fieldName}`);
    if (errorEl) {
      if (result.errors && result.errors[fieldName]) {
        errorEl.innerText = `⚠️ ${result.errors[fieldName]}`;
        errorEl.classList.remove('hidden');
      } else {
        errorEl.classList.add('hidden');
      }
    }
  } catch (e) {}
}

async function handleEmployeeFormSubmit(e) {
  e.preventDefault();
  const empId = document.getElementById('formEmpId').value;
  const branchId = document.getElementById('formBranch').value;
  const branchObj = state.branches.find(b => b.id === branchId) || { name: 'Trụ sở chính Hà Nội' };
  const deptId = document.getElementById('formDepartment').value;
  const deptObj = state.departments.find(d => d.id === deptId) || { name: 'Nhân sự' };
  const posId = document.getElementById('formPosition').value;
  const posObj = state.positions.find(p => p.id === posId) || { title: 'Chuyên viên', level: 'Chuyên viên' };

  const payload = {
    fullName: document.getElementById('formFullName').value.trim(),
    code: document.getElementById('formCode').value.trim(),
    gender: document.getElementById('formGender').value,
    birthDate: document.getElementById('formBirthDate').value.trim(),
    idCard: document.getElementById('formIdCard').value.trim(),
    phone: document.getElementById('formPhone').value.trim(),
    email: document.getElementById('formEmail').value.trim(),
    branchId: branchId,
    branchName: branchObj.name,
    departmentId: deptId,
    departmentName: deptObj.name,
    positionId: posId,
    positionTitle: posObj.title,
    level: posObj.level,
    managerId: document.getElementById('formManager').value,
    joinDate: document.getElementById('formJoinDate').value,
    contractType: document.getElementById('formContractType').value,
    contractEndDate: document.getElementById('formContractEndDate').value,
    baseSalary: document.getElementById('formBaseSalary').value,
    allowance: document.getElementById('formAllowance').value,
    avatar: document.getElementById('formAvatar').value
  };

  try {
    const url = empId ? `/api/employees/${empId}` : '/api/employees';
    const method = empId ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method: method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (!res.ok) {
      alert(data.error || 'Có lỗi xảy ra');
      return;
    }

    showToast(data.message || 'Lưu thành công', 'success');
    closeModal('modalAddEmployee');
    loadEmployeesList();
    loadDashboardStats();
  } catch (err) {
    showToast('Lỗi lưu hồ sơ nhân viên', 'error');
  }
}

// -------------------------------------------------------------
// 5. CONTRACT RENEWAL & TRANSFER ACTIONS
// -------------------------------------------------------------
function openContractRenewalModal(empId) {
  const emp = state.filteredEmployees.find(e => e.id === empId);
  if (!emp) return;

  document.getElementById('renewEmpId').value = emp.id;
  document.getElementById('renewStartDate').value = '18/11/2026';
  document.getElementById('renewSalary').value = emp.baseSalary;
  onRenewContractTypeChange();

  openModal('modalRenewContract');
}

function onRenewContractTypeChange() {
  const cType = document.getElementById('renewContractType').value;
  const startDate = document.getElementById('renewStartDate').value || '18/11/2026';
  const endInput = document.getElementById('renewEndDate');
  if (!endInput) return;

  if (cType === 'HĐ không xác định thời hạn') {
    endInput.value = 'Không thời hạn';
    return;
  }

  const parts = startDate.split('/');
  if (parts.length === 3) {
    const d = parseInt(parts[0]);
    const m = parseInt(parts[1]) - 1;
    const y = parseInt(parts[2]);
    let end;
    if (cType.includes('12 tháng')) end = new Date(y + 1, m, d - 1);
    else if (cType.includes('36 tháng')) end = new Date(y + 3, m, d - 1);
    else end = new Date(y + 1, m, d - 1);

    endInput.value = `${String(end.getDate()).padStart(2, '0')}/${String(end.getMonth() + 1).padStart(2, '0')}/${end.getFullYear()}`;
  }
}

async function handleRenewContractSubmit(e) {
  e.preventDefault();
  const empId = document.getElementById('renewEmpId').value;
  const payload = {
    contractType: document.getElementById('renewContractType').value,
    contractNumber: document.getElementById('renewContractNumber').value,
    startDate: document.getElementById('renewStartDate').value,
    endDate: document.getElementById('renewEndDate').value,
    newSalary: document.getElementById('renewSalary').value,
    isOfficial: true
  };

  try {
    const res = await fetch(`/api/employees/${empId}/renew-contract`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await res.json();
    showToast(result.message || 'Gia hạn hợp đồng thành công', 'success');
    closeModal('modalRenewContract');
    loadEmployeesList();
    if (state.currentDetailEmpId === empId) viewEmployeeDetail(empId);
  } catch (err) {
    showToast('Lỗi gia hạn hợp đồng', 'error');
  }
}

function openTransferModal(empId) {
  const emp = state.filteredEmployees.find(e => e.id === empId);
  if (!emp) return;

  document.getElementById('transferEmpId').value = emp.id;
  document.getElementById('transferBranch').value = emp.branchId || 'HN';
  onTransferBranchChange();
  document.getElementById('transferSalary').value = emp.baseSalary;
  document.getElementById('transferAllowance').value = emp.allowance;

  openModal('modalTransfer');
}

function onTransferBranchChange() {
  const branchId = document.getElementById('transferBranch').value;
  const depts = state.departments.filter(d => d.branchId === branchId);
  const deptSelect = document.getElementById('transferDept');
  if (deptSelect) {
    deptSelect.innerHTML = depts.map(d => `<option value="${d.id}">${d.name}</option>`).join('');
  }
  const posSelect = document.getElementById('transferPosition');
  if (posSelect) {
    posSelect.innerHTML = state.positions.map(p => `<option value="${p.id}">${p.title}</option>`).join('');
  }
}

async function handleTransferSubmit(e) {
  e.preventDefault();
  const empId = document.getElementById('transferEmpId').value;
  const branchId = document.getElementById('transferBranch').value;
  const branchObj = state.branches.find(b => b.id === branchId) || { name: 'Trụ sở chính Hà Nội' };
  const deptId = document.getElementById('transferDept').value;
  const deptObj = state.departments.find(d => d.id === deptId) || { name: 'Phòng ban' };
  const posId = document.getElementById('transferPosition').value;
  const posObj = state.positions.find(p => p.id === posId) || { title: 'Vị trí', level: 'Chuyên viên' };

  const payload = {
    effectiveDate: document.getElementById('transferDate').value,
    decisionNumber: document.getElementById('transferDecision').value,
    newBranchId: branchId,
    newBranchName: branchObj.name,
    newDepartmentId: deptId,
    newDepartmentName: deptObj.name,
    newPositionId: posId,
    newPositionTitle: posObj.title,
    newLevel: posObj.level,
    newBaseSalary: document.getElementById('transferSalary').value,
    newAllowance: document.getElementById('transferAllowance').value,
    reason: document.getElementById('transferReason').value
  };

  try {
    const res = await fetch(`/api/employees/${empId}/transfer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await res.json();
    showToast(result.message || 'Điều chuyển thành công', 'success');
    closeModal('modalTransfer');
    loadEmployeesList();
    if (state.currentDetailEmpId === empId) viewEmployeeDetail(empId);
  } catch (err) {
    showToast('Lỗi điều chuyển nhân sự', 'error');
  }
}

// -------------------------------------------------------------
// 6. RESIGN & REHIRE ACTIONS
// -------------------------------------------------------------
function openResignModal(empId) {
  document.getElementById('resignEmpId').value = empId;
  openModal('modalResign');
}

async function handleResignSubmit(e) {
  e.preventDefault();
  const empId = document.getElementById('resignEmpId').value;
  const payload = {
    resignedDate: document.getElementById('resignDate').value,
    decisionNumber: document.getElementById('resignDecision').value,
    resignedReason: document.getElementById('resignReason').value,
    resignedNote: document.getElementById('resignNote').value
  };

  try {
    const res = await fetch(`/api/employees/${empId}/resign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await res.json();
    showToast(result.message || 'Ghi nhận nghỉ việc thành công', 'success');
    closeModal('modalResign');
    loadEmployeesList();
    loadDashboardStats();
    if (state.currentDetailEmpId === empId) viewEmployeeDetail(empId);
  } catch (err) {
    showToast('Lỗi ghi nhận nghỉ việc', 'error');
  }
}

async function openRehireModal(empId) {
  if (!confirm('Bạn có chắc chắn muốn khôi phục và nhận lại nhân sự này vào làm việc?')) return;
  try {
    const res = await fetch(`/api/employees/${empId}/rehire`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rehireDate: '18/11/2026' })
    });
    const result = await res.json();
    showToast(result.message || 'Nhận lại làm việc thành công', 'success');
    loadEmployeesList();
    loadDashboardStats();
    if (state.currentDetailEmpId === empId) viewEmployeeDetail(empId);
  } catch (err) {
    showToast('Lỗi nhận lại làm việc', 'error');
  }
}

async function deleteEmployeePrompt(empId) {
  if (!confirm('CẢNH BÁO: Bạn có chắc chắn muốn xóa vĩnh viễn nhân sự này khỏi hệ thống?')) return;
  try {
    await fetch(`/api/employees/${empId}`, { method: 'DELETE' });
    showToast('Đã xóa nhân viên', 'success');
    closeModal('modalEmployeeDetail');
    loadEmployeesList();
    loadDashboardStats();
  } catch (err) {
    showToast('Lỗi xóa nhân viên', 'error');
  }
}

// -------------------------------------------------------------
// 7. LEAVE MANAGEMENT & APPROVAL WORKFLOW
// -------------------------------------------------------------
async function loadLeavesList() {
  const tab = state.currentLeaveTab || 'pending';
  try {
    const res = await fetch(`/api/leaves?status=${tab}`);
    const result = await res.json();
    state.leaveRequests = result.data;
    state.leaveQuotas = result.quotas;

    // Badges
    const pBadge = document.getElementById('leaveBadgePending');
    if (pBadge) pBadge.innerText = result.counts.pending;
    const sBadge = document.getElementById('sidebarLeaveBadge');
    if (sBadge) sBadge.innerText = result.counts.pending;

    if (tab === 'quota') {
      document.getElementById('leaveRequestsTableContainer').classList.add('hidden');
      document.getElementById('leaveQuotaTableContainer').classList.remove('hidden');
      document.getElementById('leaveFilterRow').classList.add('hidden');
      renderLeaveQuotaTable(result.quotas);
    } else {
      document.getElementById('leaveRequestsTableContainer').classList.remove('hidden');
      document.getElementById('leaveQuotaTableContainer').classList.add('hidden');
      document.getElementById('leaveFilterRow').classList.remove('hidden');
      renderLeaveRequestsTable(result.data);
    }
  } catch (err) {
    console.error('Failed to load leaves:', err);
  }
}

function setLeaveTab(tab) {
  state.currentLeaveTab = tab;
  document.querySelectorAll('.leave-tab-btn').forEach(btn => {
    btn.classList.remove('active', 'bg-brand-600', 'text-white', 'font-bold');
    btn.classList.add('text-slate-600');
  });

  const activeBtn = document.getElementById(`leaveTab-${tab}`);
  if (activeBtn) {
    activeBtn.classList.add('active', 'bg-brand-600', 'text-white', 'font-bold');
    activeBtn.classList.remove('text-slate-600');
  }

  loadLeavesList();
}

function renderLeaveRequestsTable(leaves) {
  const tbody = document.getElementById('leavesTableBody');
  if (!tbody) return;

  if (leaves.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="p-8 text-center text-slate-400">Không có đơn nghỉ phép nào</td></tr>`;
    return;
  }

  tbody.innerHTML = leaves.map(l => {
    let badgeClass = 'bg-amber-100 text-amber-800';
    if (l.status === 'approved') badgeClass = 'bg-emerald-100 text-emerald-800';
    if (l.status === 'rejected') badgeClass = 'bg-rose-100 text-rose-800';

    return `
      <tr class="hover:bg-slate-50 transition">
        <td class="p-3.5 font-bold text-slate-900">
          <p>${l.employeeName}</p>
          <p class="text-[11px] text-slate-400 font-normal">${l.departmentName || '—'}</p>
        </td>
        <td class="p-3.5">
          <p class="font-medium text-slate-800">${l.leaveType}</p>
          <p class="text-[11px] text-slate-400">${l.leaveCategory || ''}</p>
        </td>
        <td class="p-3.5 text-xs font-mono">
          ${l.startDate} → ${l.endDate}
        </td>
        <td class="p-3.5 text-center font-bold text-slate-800">
          ${l.daysCount}
        </td>
        <td class="p-3.5 text-slate-600 max-w-[200px] truncate" title="${l.reason}">
          ${l.reason}
        </td>
        <td class="p-3.5">
          <span class="px-2 py-0.5 rounded-full text-xs font-semibold ${badgeClass}">
            ${l.statusLabel}
          </span>
        </td>
        <td class="p-3.5 text-xs text-slate-500">
          <p class="font-medium text-slate-700">${l.approverName || '—'}</p>
          <p class="text-[10px] text-slate-400">${l.approvedAt || l.createdAt || ''}</p>
        </td>
        <td class="p-3.5 text-right">
          ${l.status === 'pending' ? `
            <div class="flex items-center justify-end gap-1.5">
              <button onclick="approveLeave('${l.id}')" class="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs">
                Duyệt
              </button>
              <button onclick="rejectLeave('${l.id}')" class="px-2.5 py-1 bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 rounded-lg text-xs font-bold">
                Từ chối
              </button>
            </div>
          ` : `
            <span class="text-xs text-slate-400 font-medium">Đã xử lý</span>
          `}
        </td>
      </tr>
    `;
  }).join('');
}

function renderLeaveQuotaTable(quotas) {
  const tbody = document.getElementById('leaveQuotaTableBody');
  if (!tbody) return;

  tbody.innerHTML = (quotas || []).map(q => `
    <tr class="hover:bg-slate-50 transition">
      <td class="p-3.5">
        <p class="font-bold text-slate-900">${q.fullName}</p>
        <p class="text-[11px] text-slate-400 font-mono">${q.code}</p>
      </td>
      <td class="p-3.5 text-xs text-slate-600">${q.departmentName} (${q.branchName})</td>
      <td class="p-3.5 text-xs font-mono text-slate-700">${q.joinDate}</td>
      <td class="p-3.5 text-xs font-medium text-purple-700 bg-purple-50/50 rounded">${q.tenure}</td>
      <td class="p-3.5 text-center font-mono font-bold text-slate-700">${q.standardLeave}</td>
      <td class="p-3.5 text-center font-mono font-bold text-emerald-600">+${q.seniorityLeave}</td>
      <td class="p-3.5 text-center font-mono font-extrabold text-slate-900 bg-slate-50">${q.totalQuota}</td>
      <td class="p-3.5 text-center font-mono font-bold text-amber-600">${q.usedLeave}</td>
      <td class="p-3.5 text-center font-mono font-black text-brand-700 text-sm">${q.remainingLeave}</td>
    </tr>
  `).join('');
}

function openCreateLeaveModal() {
  const select = document.getElementById('leaveEmpSelect');
  if (select) {
    select.innerHTML = state.filteredEmployees.filter(e => e.status !== 'resigned').map(e => `
      <option value="${e.id}">${e.fullName} (${e.code} • ${e.departmentName})</option>
    `).join('');
  }
  openModal('modalCreateLeave');
}

function openCreateLeaveForEmp(empId) {
  openCreateLeaveModal();
  const select = document.getElementById('leaveEmpSelect');
  if (select) select.value = empId;
}

async function handleCreateLeaveSubmit(e) {
  e.preventDefault();
  const payload = {
    employeeId: document.getElementById('leaveEmpSelect').value,
    leaveType: document.getElementById('leaveTypeSelect').value,
    daysCount: document.getElementById('leaveDaysCount').value,
    startDate: document.getElementById('leaveStartDate').value,
    endDate: document.getElementById('leaveEndDate').value,
    reason: document.getElementById('leaveReason').value
  };

  try {
    const res = await fetch('/api/leaves', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await res.json();
    showToast(result.message || 'Tạo đơn nghỉ thành công', 'success');
    closeModal('modalCreateLeave');
    loadLeavesList();
    loadDashboardStats();
  } catch (err) {
    showToast('Lỗi tạo đơn nghỉ', 'error');
  }
}

async function approveLeave(id) {
  try {
    const res = await fetch(`/api/leaves/${id}/approve`, { method: 'PUT' });
    const result = await res.json();
    showToast('Đã duyệt đơn nghỉ và cập nhật phép năm!', 'success');
    loadLeavesList();
    loadDashboardStats();
  } catch (err) {
    showToast('Lỗi duyệt đơn', 'error');
  }
}

async function rejectLeave(id) {
  const reason = prompt('Nhập lý do từ chối đơn nghỉ phép:');
  if (reason === null) return;

  try {
    const res = await fetch(`/api/leaves/${id}/reject`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: reason || 'Lý do công việc' })
    });
    showToast('Đã từ chối đơn nghỉ phép', 'success');
    loadLeavesList();
    loadDashboardStats();
  } catch (err) {
    showToast('Lỗi thao tác', 'error');
  }
}

// -------------------------------------------------------------
// 8. DEPARTMENTS & BRANCHES & POSITIONS
// -------------------------------------------------------------
async function loadDepartmentsView() {
  try {
    const res = await fetch('/api/departments');
    state.departments = await res.json();
    renderDepartmentsTable(state.departments);

    if (state.departments.length > 0) {
      renderDepartmentDetail(state.departments[0]);
    }
  } catch (err) {
    console.error('Failed to load departments:', err);
  }
}

function renderDepartmentsTable(depts) {
  const tbody = document.getElementById('departmentsTableBody');
  if (!tbody) return;

  tbody.innerHTML = depts.map(d => `
    <tr onclick="selectDepartmentDetail('${d.id}')" class="hover:bg-slate-50 transition cursor-pointer">
      <td class="p-3.5">
        <p class="font-bold text-slate-900">${d.name}</p>
        <p class="text-[11px] text-slate-400">${d.branchName}</p>
      </td>
      <td class="p-3.5">
        <div class="flex items-center gap-2">
          ${d.managerAvatar ? `<img src="${d.managerAvatar}" class="w-6 h-6 rounded-full object-cover">` : `<span class="w-6 h-6 rounded-full bg-slate-200 text-slate-500 flex items-center justify-center text-[10px]">?</span>`}
          <span class="font-medium text-slate-800">${d.managerName || 'Chưa có'}</span>
        </div>
      </td>
      <td class="p-3.5 text-center font-bold text-slate-800">${d.employeeCount || 3}</td>
      <td class="p-3.5 text-center font-bold text-slate-800">${d.positionsCount || 2}</td>
      <td class="p-3.5">
        <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${d.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}">
          <span class="w-1.5 h-1.5 rounded-full ${d.status === 'active' ? 'bg-emerald-500' : 'bg-slate-400'}"></span>
          <span>${d.status === 'active' ? 'Đang hoạt động' : 'Tạm ngưng'}</span>
        </span>
      </td>
      <td class="p-3.5 text-right">
        <button class="p-1.5 text-slate-400 hover:text-slate-600"><i data-lucide="more-vertical" class="w-4 h-4"></i></button>
      </td>
    </tr>
  `).join('');

  lucide.createIcons();
}

function selectDepartmentDetail(deptId) {
  const d = state.departments.find(dept => dept.id === deptId);
  if (d) renderDepartmentDetail(d);
}

function renderDepartmentDetail(d) {
  const panel = document.getElementById('deptDetailPanel');
  if (!panel) return;

  panel.innerHTML = `
    <div class="border-b border-slate-100 pb-3">
      <div class="flex items-center justify-between">
        <h3 class="font-extrabold text-slate-900 text-base">${d.name}</h3>
        <button class="text-xs text-brand-600 font-semibold hover:underline">Chỉnh sửa</button>
      </div>
      <p class="text-xs text-slate-500 mt-1">${d.description || ''}</p>
    </div>

    <div class="grid grid-cols-3 gap-2 text-center">
      <div class="p-2 bg-slate-50 rounded-xl">
        <p class="text-base font-extrabold text-slate-900">${d.employeeCount || 3}</p>
        <p class="text-[10px] text-slate-400">Nhân viên</p>
      </div>
      <div class="p-2 bg-slate-50 rounded-xl">
        <p class="text-base font-extrabold text-slate-900">${d.positionsCount || 3}</p>
        <p class="text-[10px] text-slate-400">Vị trí</p>
      </div>
      <div class="p-2 bg-slate-50 rounded-xl">
        <p class="text-base font-extrabold text-emerald-600">100%</p>
        <p class="text-[10px] text-slate-400">Lấp đầy</p>
      </div>
    </div>

    <div class="space-y-2 text-xs">
      <p class="font-bold text-slate-700">Thông tin chung</p>
      <div class="p-3 bg-slate-50 rounded-xl space-y-1.5">
        <p><span class="text-slate-400">Trưởng phòng:</span> <span class="font-semibold text-slate-800">${d.managerName || 'Chưa có'}</span></p>
        <p><span class="text-slate-400">Email:</span> <span class="font-mono text-slate-600">${d.managerEmail || '—'}</span></p>
        <p><span class="text-slate-400">Địa điểm:</span> <span class="font-medium text-slate-800">${d.branchName}</span></p>
        <p><span class="text-slate-400">Ngày thành lập:</span> <span class="text-slate-600">${d.foundedDate || '—'}</span></p>
      </div>
    </div>

    <button onclick="navigateWithTab('employees', 'all')" class="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition">
      Xem tất cả nhân viên trong phòng ban →
    </button>
  `;
}

async function loadBranchesView() {
  try {
    const res = await fetch('/api/branches');
    state.branches = await res.json();
    renderBranchCards(state.branches);
    renderBranchCharts(state.branches);
  } catch (err) {
    console.error('Failed to load branches:', err);
  }
}

function renderBranchCards(branches) {
  const container = document.getElementById('branchCardsContainer');
  if (!container) return;

  container.innerHTML = branches.map(b => `
    <div class="card-soft p-5 flex flex-col justify-between space-y-4">
      <div>
        <div class="flex items-center justify-between pb-3 border-b border-slate-100">
          <div class="flex items-center gap-2.5">
            <div class="w-9 h-9 rounded-xl bg-brand-600 text-white flex items-center justify-center font-bold text-xs">
              ${b.shortName}
            </div>
            <div>
              <h3 class="font-bold text-slate-900 text-sm">${b.name}</h3>
              <p class="text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
                <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Đang hoạt động
              </p>
            </div>
          </div>
        </div>

        <div class="space-y-1.5 text-xs text-slate-500 mt-3">
          <p class="flex items-center gap-1.5"><i data-lucide="map-pin" class="w-3.5 h-3.5 text-slate-400 shrink-0"></i> <span class="truncate">${b.address}</span></p>
          <p class="flex items-center gap-1.5"><i data-lucide="phone" class="w-3.5 h-3.5 text-slate-400 shrink-0"></i> <span>${b.phone}</span></p>
          <p class="flex items-center gap-1.5"><i data-lucide="mail" class="w-3.5 h-3.5 text-slate-400 shrink-0"></i> <span>${b.email}</span></p>
        </div>

        <div class="grid grid-cols-4 gap-2 my-4 text-center">
          <div class="p-2 bg-slate-50 rounded-xl">
            <p class="text-base font-extrabold text-slate-900">${b.employeeCount}</p>
            <p class="text-[10px] text-slate-400">Nhân sự</p>
          </div>
          <div class="p-2 bg-slate-50 rounded-xl">
            <p class="text-base font-extrabold text-slate-900">${b.departmentsCount}</p>
            <p class="text-[10px] text-slate-400">Phòng ban</p>
          </div>
          <div class="p-2 bg-emerald-50 rounded-xl text-emerald-700">
            <p class="text-base font-extrabold">+${b.joined12M}</p>
            <p class="text-[10px]">Vào 12T</p>
          </div>
          <div class="p-2 bg-rose-50 rounded-xl text-rose-700">
            <p class="text-base font-extrabold">${b.left12M}</p>
            <p class="text-[10px]">Nghỉ 12T</p>
          </div>
        </div>

        <!-- Dept breakdown mini bars -->
        <div class="space-y-1 text-xs">
          ${(b.deptBreakdown || []).slice(0, 4).map(d => `
            <div class="flex items-center justify-between text-[11px] text-slate-600">
              <span>${d.name}</span>
              <span class="font-bold">${d.count}</span>
            </div>
            <div class="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden mb-1.5">
              <div class="bg-brand-500 h-full rounded-full" style="width: ${(d.count / b.employeeCount) * 100}%"></div>
            </div>
          `).join('')}
        </div>
      </div>

      <div class="pt-3 border-t border-slate-100 flex items-center justify-between">
        <div class="flex items-center gap-2">
          <img src="${b.managerAvatar || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100'}" class="w-7 h-7 rounded-full object-cover">
          <div>
            <p class="font-bold text-xs text-slate-800">${b.managerName}</p>
            <p class="text-[10px] text-slate-400">${b.managerTitle}</p>
          </div>
        </div>
        <button onclick="navigateWithTab('employees', 'all')" class="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-bold text-slate-700">
          Nhân viên
        </button>
      </div>
    </div>
  `).join('');

  lucide.createIcons();
}

function renderBranchCharts(branches) {
  // Compare chart
  const cCanvas = document.getElementById('chartBranchCompare');
  if (cCanvas) {
    if (state.chartInstances['chartBranchCompare']) state.chartInstances['chartBranchCompare'].destroy();
    state.chartInstances['chartBranchCompare'] = new Chart(cCanvas.getContext('2d'), {
      type: 'bar',
      data: {
        labels: branches.map(b => b.shortName),
        datasets: [
          { label: 'Nhân sự hiện tại', data: branches.map(b => b.employeeCount), backgroundColor: '#3b82f6', borderRadius: 4 },
          { label: 'Vào làm 12 tháng', data: branches.map(b => b.joined12M), backgroundColor: '#10b981', borderRadius: 4 },
          { label: 'Nghỉ việc 12 tháng', data: branches.map(b => b.left12M), backgroundColor: '#f87171', borderRadius: 4 }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 10 } } } }
      }
    });
  }

  // Salary fund chart
  const sCanvas = document.getElementById('chartBranchSalary');
  if (sCanvas) {
    if (state.chartInstances['chartBranchSalary']) state.chartInstances['chartBranchSalary'].destroy();
    state.chartInstances['chartBranchSalary'] = new Chart(sCanvas.getContext('2d'), {
      type: 'bar',
      data: {
        labels: branches.map(b => b.shortName),
        datasets: [{
          label: 'Quỹ lương (Triệu đồng)',
          data: branches.map(b => Math.round(b.salaryFund / 1000000)),
          backgroundColor: '#8b5cf6',
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } }
      }
    });
  }
}

async function loadPositionsView() {
  try {
    const res = await fetch('/api/positions');
    state.positions = await res.json();
    renderPositionsTable(state.positions);

    if (state.positions.length > 0) {
      renderPositionDetail(state.positions[0]);
    }
  } catch (err) {
    console.error('Failed to load positions:', err);
  }
}

function renderPositionsTable(positions) {
  const tbody = document.getElementById('positionsTableBody');
  if (!tbody) return;

  tbody.innerHTML = positions.map(p => `
    <tr onclick="selectPositionDetail('${p.id}')" class="hover:bg-slate-50 transition cursor-pointer">
      <td class="p-3.5">
        <p class="font-bold text-slate-900">${p.title}</p>
        <p class="text-[11px] text-slate-400">${p.code} • ${p.departmentName}</p>
      </td>
      <td class="p-3.5">
        <span class="px-2 py-0.5 rounded text-[11px] font-semibold bg-purple-50 text-purple-700">${p.level}</span>
      </td>
      <td class="p-3.5 text-center font-bold text-slate-700">${p.planned}</td>
      <td class="p-3.5 text-center font-bold text-slate-900">${p.actual}</td>
      <td class="p-3.5">
        <div class="flex items-center gap-2">
          <div class="w-16 bg-slate-100 h-1.5 rounded-full overflow-hidden">
            <div class="h-full rounded-full ${p.actual < p.planned ? 'bg-amber-500' : 'bg-emerald-500'}" style="width: ${Math.min(100, (p.actual / p.planned) * 100)}%"></div>
          </div>
          <span class="text-xs font-semibold ${p.actual < p.planned ? 'text-amber-600' : 'text-emerald-600'}">${p.statusText}</span>
        </div>
      </td>
      <td class="p-3.5 text-right">
        <button class="p-1.5 text-slate-400 hover:text-slate-600"><i data-lucide="more-vertical" class="w-4 h-4"></i></button>
      </td>
    </tr>
  `).join('');

  lucide.createIcons();
}

function selectPositionDetail(posId) {
  const p = state.positions.find(pos => pos.id === posId);
  if (p) renderPositionDetail(p);
}

function renderPositionDetail(p) {
  const panel = document.getElementById('positionDetailPanel');
  if (!panel) return;

  panel.innerHTML = `
    <div class="border-b border-slate-100 pb-3">
      <div class="flex items-center justify-between">
        <h3 class="font-extrabold text-slate-900 text-base">${p.title}</h3>
        <button class="text-xs text-brand-600 font-semibold hover:underline">Chỉnh sửa</button>
      </div>
      <p class="text-xs text-slate-500 mt-1">${p.departmentName} • ${p.code}</p>
    </div>

    <div class="grid grid-cols-4 gap-2 text-center">
      <div class="p-2 bg-slate-50 rounded-xl">
        <p class="text-base font-extrabold text-slate-900">${p.planned}</p>
        <p class="text-[10px] text-slate-400">Định biên</p>
      </div>
      <div class="p-2 bg-slate-50 rounded-xl">
        <p class="text-base font-extrabold text-slate-900">${p.actual}</p>
        <p class="text-[10px] text-slate-400">Đang đảm...</p>
      </div>
      <div class="p-2 bg-slate-50 rounded-xl">
        <p class="text-base font-extrabold ${p.planned - p.actual > 0 ? 'text-amber-600' : 'text-slate-400'}">${Math.max(0, p.planned - p.actual)}</p>
        <p class="text-[10px] text-slate-400">Còn thiếu</p>
      </div>
      <div class="p-2 bg-slate-50 rounded-xl">
        <p class="text-base font-extrabold text-emerald-600">${Math.round((p.actual / p.planned) * 100)}%</p>
        <p class="text-[10px] text-slate-400">Lấp đầy</p>
      </div>
    </div>

    <div class="space-y-3 text-xs">
      <p class="font-bold text-slate-700">Thông tin vị trí</p>
      <div class="p-3 bg-slate-50 rounded-xl space-y-1.5">
        <p><span class="text-slate-400">Cấp bậc:</span> <span class="font-semibold text-slate-800">${p.level}</span></p>
        <p><span class="text-slate-400">Khung lương:</span> <span class="font-mono font-bold text-slate-900">${(p.minSalary || 15000000).toLocaleString('vi-VN')} - ${(p.maxSalary || 25000000).toLocaleString('vi-VN')} đ</span></p>
        <p><span class="text-slate-400">Tuyển dụng:</span> <span class="font-semibold ${p.recruitingStatus === 'Đang tuyển' ? 'text-amber-600' : 'text-emerald-600'}">${p.recruitingStatus || 'Đã đủ'}</span></p>
        <p><span class="text-slate-400">Mô tả:</span> <span class="text-slate-600">${p.description || 'Chưa cập nhật mô tả'}</span></p>
      </div>
    </div>

    <div class="space-y-2">
      <p class="font-bold text-slate-700 text-xs">Nhân viên đảm nhiệm (${(p.employees || []).length})</p>
      <div class="space-y-1.5 max-h-40 overflow-y-auto">
        ${(p.employees || []).map(e => `
          <div onclick="viewEmployeeDetail('${e.id}')" class="p-2 bg-slate-50 hover:bg-slate-100 rounded-xl flex items-center justify-between cursor-pointer transition">
            <div class="flex items-center gap-2">
              <img src="${e.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'}" class="w-6 h-6 rounded-full object-cover">
              <div>
                <p class="font-bold text-xs text-slate-900">${e.fullName}</p>
                <p class="text-[10px] text-slate-400">${e.code} • ${e.tenure}</p>
              </div>
            </div>
            <span class="text-[10px] text-emerald-600 font-semibold">• Đang làm việc</span>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

// -------------------------------------------------------------
// 9. ORG CHART HIERARCHICAL TREE (AUTO-DRAWN HIERARCHY)
// -------------------------------------------------------------
async function openOrgChartModal() {
  openModal('modalOrgChart');
  try {
    const res = await fetch('/api/org-chart');
    const data = await res.json();
    const container = document.getElementById('orgChartInner');
    if (!container || !data.root) return;

    container.innerHTML = `<ul class="org-tree">${buildOrgNodeHTML(data.root, true)}</ul>`;
    lucide.createIcons();
    resetOrgChartZoom();
  } catch (err) {
    showToast('Lỗi khi dựng sơ đồ tổ chức', 'error');
  }
}

function buildOrgNodeHTML(node, isRoot = false) {
  const hasChildren = node.children && node.children.length > 0;
  return `
    <li>
      <div onclick="viewEmployeeDetail('${node.id}')" class="org-node ${isRoot ? 'root-node' : ''}">
        <div class="flex items-center gap-2.5">
          <img src="${node.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100'}" class="w-9 h-9 rounded-xl object-cover border border-slate-200 shrink-0">
          <div class="text-left overflow-hidden">
            <h5 class="font-bold text-slate-900 text-xs truncate">${node.name}</h5>
            <p class="text-[10px] font-semibold text-brand-600 truncate">${node.title}</p>
            <p class="text-[9px] text-slate-400 truncate">${node.department || ''}</p>
          </div>
        </div>
        ${node.subordinateCount > 0 ? `
          <div class="mt-2 pt-1 border-t border-slate-100 flex items-center justify-between text-[9px] text-slate-400">
            <span>Cấp dưới trực tiếp:</span>
            <span class="font-bold text-slate-700 bg-slate-100 px-1 rounded">${node.subordinateCount}</span>
          </div>
        ` : ''}
      </div>
      ${hasChildren ? `
        <ul>
          ${node.children.map(child => buildOrgNodeHTML(child, false)).join('')}
        </ul>
      ` : ''}
    </li>
  `;
}

function zoomOrgChart(delta) {
  state.orgChartZoom = Math.max(0.4, Math.min(1.8, state.orgChartZoom + delta));
  const el = document.getElementById('orgChartInner');
  if (el) el.style.transform = `scale(${state.orgChartZoom})`;
  const val = document.getElementById('orgChartZoomVal');
  if (val) val.innerText = `${Math.round(state.orgChartZoom * 100)}%`;
}

function resetOrgChartZoom() {
  state.orgChartZoom = 1;
  const el = document.getElementById('orgChartInner');
  if (el) el.style.transform = `scale(1)`;
  const val = document.getElementById('orgChartZoomVal');
  if (val) val.innerText = `100%`;
}

// -------------------------------------------------------------
// 10. EXCEL IMPORT & ERROR VALIDATION
// -------------------------------------------------------------
function openImportExcelModal() {
  document.getElementById('excelFileInput').value = '';
  document.getElementById('importValidationResults').classList.add('hidden');
  document.getElementById('btnCommitImport').disabled = true;
  openModal('modalImportExcel');
}

let selectedImportFile = null;

function handleExcelFileSelect(input) {
  if (input.files && input.files[0]) {
    selectedImportFile = input.files[0];
    validateExcelFile(selectedImportFile);
  }
}

async function validateExcelFile(file) {
  const formData = new FormData();
  formData.append('excelFile', file);
  formData.append('commit', 'false');

  try {
    const res = await fetch('/api/import-excel', {
      method: 'POST',
      body: formData
    });
    const result = await res.json();

    const resultsContainer = document.getElementById('importValidationResults');
    const summaryCard = document.getElementById('importSummaryCard');
    const errorsList = document.getElementById('importErrorsList');
    const commitBtn = document.getElementById('btnCommitImport');

    resultsContainer.classList.remove('hidden');

    if (result.errorCount === 0) {
      summaryCard.className = 'p-3 rounded-xl flex items-center justify-between text-xs font-bold border border-emerald-200 bg-emerald-50 text-emerald-800';
      summaryCard.innerHTML = `<span>✓ Tất cả ${result.validCount} dòng dữ liệu đều hợp lệ!</span>`;
      errorsList.innerHTML = '';
      commitBtn.disabled = false;
      commitBtn.innerText = `Nhập ${result.validCount} nhân viên vào hệ thống`;
    } else {
      summaryCard.className = 'p-3 rounded-xl flex items-center justify-between text-xs font-bold border border-amber-200 bg-amber-50 text-amber-900';
      summaryCard.innerHTML = `<span>Phát hiện ${result.errorCount} dòng lỗi • ${result.validCount} dòng hợp lệ</span>`;
      
      errorsList.innerHTML = result.errors.map(err => `
        <div class="p-2 bg-rose-50 border border-rose-200 rounded-lg">
          <p class="font-bold">Dòng ${err.rowNumber}: ${err.data['Họ và tên'] || 'Chưa rõ tên'}</p>
          <p class="text-[11px] text-rose-600">${err.errors.join(' • ')}</p>
        </div>
      `).join('');

      if (result.validCount > 0) {
        commitBtn.disabled = false;
        commitBtn.innerText = `Bỏ qua lỗi & Nhập ${result.validCount} dòng hợp lệ`;
      } else {
        commitBtn.disabled = true;
        commitBtn.innerText = `Vui lòng sửa các dòng lỗi trong file`;
      }
    }
  } catch (err) {
    showToast('Lỗi khi kiểm tra file Excel', 'error');
  }
}

async function commitExcelImport() {
  if (!selectedImportFile) return;
  const formData = new FormData();
  formData.append('excelFile', selectedImportFile);
  formData.append('commit', 'true');

  try {
    const res = await fetch('/api/import-excel', {
      method: 'POST',
      body: formData
    });
    const result = await res.json();
    showToast(`Đã nhập thành công ${result.imported} nhân sự mới!`, 'success');
    closeModal('modalImportExcel');
    loadEmployeesList();
    loadDashboardStats();
  } catch (err) {
    showToast('Lỗi khi nhập dữ liệu', 'error');
  }
}

// -------------------------------------------------------------
// 11. GOOGLE SHEETS SYNC
// -------------------------------------------------------------
function openGoogleSheetsSyncModal() {
  openModal('modalGoogleSheetsSync');
}

async function syncGoogleSheetsNow() {
  const btn = document.getElementById('syncBtn');
  const modalBtn = document.getElementById('modalSyncBtn');
  const loadingHtml = `<i data-lucide="loader" class="w-4 h-4 animate-spin"></i> <span>Đang cập nhật 10 sheet...</span>`;

  if (btn) btn.innerHTML = loadingHtml;
  if (modalBtn) modalBtn.innerHTML = loadingHtml;
  lucide.createIcons();

  try {
    const res = await fetch('/api/google-sheets/sync', { method: 'POST' });
    const result = await res.json();

    const lastSyncEl = document.getElementById('gsLastSyncText');
    if (lastSyncEl) lastSyncEl.innerText = result.lastSync;

    showToast(result.message || 'Đồng bộ 10 Sheet trên Google Sheets thành công!', 'success');
  } catch (err) {
    showToast('Lỗi đồng bộ Google Sheets: ' + err.message, 'error');
  } finally {
    if (btn) btn.innerHTML = `<i data-lucide="refresh-cw" class="w-4 h-4"></i> <span>Đồng bộ ngay</span>`;
    if (modalBtn) modalBtn.innerHTML = `<i data-lucide="refresh-cw" class="w-4 h-4"></i> <span>Đồng bộ ngay 10 Sheet</span>`;
    lucide.createIcons();
  }
}

function copyAppsScriptCode() {
  const code = `function doPost(e) {
  var data = JSON.parse(e.postData.contents);
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("NhanSu") || ss.insertSheet("NhanSu");
  return ContentService.createTextOutput(JSON.stringify({ status: "success", count: data.length }));
}`;
  navigator.clipboard.writeText(code);
  showToast('Đã sao chép mã nguồn Google Apps Script!', 'success');
}

// -------------------------------------------------------------
// 12. NOTIFICATION CENTER & NOTIFICATIONS DROPDOWN
// -------------------------------------------------------------
async function loadNotificationCenter() {
  try {
    const res = await fetch('/api/stats');
    const data = await res.json();
    const list = document.getElementById('notifList');
    if (!list) return;

    const notifs = [
      {
        icon: 'file-clock',
        color: 'text-amber-500 bg-amber-50',
        title: '2 hợp đồng lao động sắp hết hạn trong 30 ngày',
        desc: 'Nguyễn Anh Tuấn (30/11/2026), Lê Hoàng Yến (14/12/2026)',
        action: () => navigateWithTab('employees', 'all')
      },
      {
        icon: 'alert-circle',
        color: 'text-rose-500 bg-rose-50',
        title: '5 người sắp hết thời gian thử việc trong 14 ngày',
        desc: 'Nguyễn Văn Minh, Trần Thị Thu Hà, Vũ Đức Thịnh...',
        action: () => navigateWithTab('employees', 'probation')
      },
      {
        icon: 'calendar-check',
        color: 'text-blue-500 bg-blue-50',
        title: '2 đơn nghỉ phép mới đang chờ phê duyệt',
        desc: 'Trần Công Đạt (2 ngày), Đỗ Bảo Anh (1 ngày)',
        action: () => navigate('leaves')
      },
      {
        icon: 'target',
        color: 'text-purple-500 bg-purple-50',
        title: '3 vị trí chức danh đang thiếu người so với định biên',
        desc: 'Backend Developer (-1), Nhân viên Kinh doanh (-1), Kỹ sư HT (-1)',
        action: () => navigate('positions')
      }
    ];

    list.innerHTML = notifs.map(n => `
      <div onclick="(${n.action.toString()})(); toggleNotificationDropdown();" class="p-2.5 rounded-xl border border-slate-100 hover:bg-slate-50 cursor-pointer transition flex items-start gap-3">
        <div class="w-8 h-8 rounded-lg ${n.color} flex items-center justify-center shrink-0 mt-0.5">
          <i data-lucide="${n.icon}" class="w-4 h-4"></i>
        </div>
        <div class="overflow-hidden">
          <p class="font-bold text-xs text-slate-900 leading-tight">${n.title}</p>
          <p class="text-[11px] text-slate-500 mt-0.5 truncate">${n.desc}</p>
        </div>
      </div>
    `).join('');

    lucide.createIcons();
  } catch (e) {}
}

function toggleNotificationDropdown() {
  const d = document.getElementById('notifDropdown');
  if (d) d.classList.toggle('hidden');
}

function markAllNotificationsRead() {
  document.getElementById('headerNotifBadge').classList.add('hidden');
  document.getElementById('mobileNotifBadge').classList.add('hidden');
  toggleNotificationDropdown();
  showToast('Đã đánh dấu đọc tất cả thông báo');
}

// -------------------------------------------------------------
// 13. ROLE SWITCHER & RBAC SIMULATION
// -------------------------------------------------------------
function toggleUserDropdown() {
  const d = document.getElementById('userDropdown');
  if (d) d.classList.toggle('hidden');
}

function switchRole(roleKey) {
  state.currentRole = roleKey;
  document.getElementById('roleCheckAdmin').classList.toggle('hidden', roleKey !== 'admin');
  document.getElementById('roleCheckHR').classList.toggle('hidden', roleKey !== 'hr');
  document.getElementById('roleCheckViewer').classList.toggle('hidden', roleKey !== 'viewer');

  const nameEl = document.getElementById('headerUserName');
  const roleEl = document.getElementById('headerUserRole');

  if (roleKey === 'admin') {
    state.currentUser = { name: 'Quản trị viên', role: 'admin', roleLabel: 'Quản trị viên' };
    nameEl.innerText = 'Quản trị viên';
    roleEl.innerText = 'Quản trị viên (Toàn quyền)';
  } else if (roleKey === 'hr') {
    state.currentUser = { name: 'Lê Diệu Nhung', role: 'hr', roleLabel: 'Nhân sự (HR)' };
    nameEl.innerText = 'Lê Diệu Nhung';
    roleEl.innerText = 'Nhân sự (HR)';
  } else if (roleKey === 'viewer') {
    state.currentUser = { name: 'Hồ Quang Hùng', role: 'viewer', roleLabel: 'Chỉ xem' };
    nameEl.innerText = 'Hồ Quang Hùng';
    roleEl.innerText = 'Chỉ xem (Chi nhánh TP. HCM)';
  }

  showToast(`Đã chuyển vai trò sang: ${roleEl.innerText}`, 'info');
  toggleUserDropdown();
  loadEmployeesList();
  loadDashboardStats();
}

// -------------------------------------------------------------
// 14. SETTINGS & GUIDE
// -------------------------------------------------------------
function setSettingsTab(tab) {
  document.querySelectorAll('.setting-tab-btn').forEach(b => {
    b.classList.remove('active', 'bg-brand-50', 'text-brand-600');
    b.classList.add('hover:bg-slate-50', 'text-slate-700');
  });
  const btn = document.getElementById(`settingTab-${tab}`);
  if (btn) {
    btn.classList.add('active', 'bg-brand-50', 'text-brand-600');
    btn.classList.remove('hover:bg-slate-50', 'text-slate-700');
  }

  document.querySelectorAll('.setting-subview').forEach(v => v.classList.add('hidden'));
  const subview = document.getElementById(`subview-setting-${tab}`);
  if (subview) subview.classList.remove('hidden');

  lucide.createIcons();
}

async function loadSettingsView() {
  try {
    const res = await fetch('/api/settings');
    state.settings = await res.json();
    if (state.settings.general) {
      document.getElementById('settingCompanyName').value = state.settings.general.companyName || 'ASIN GROUP';
      document.getElementById('settingCodePrefix').value = state.settings.general.employeeCodePrefix || 'NV';
      document.getElementById('settingAnnualLeaveStandard').value = state.settings.general.annualLeaveStandard || 12;
      document.getElementById('settingContractWarningDays').value = state.settings.general.contractWarningDays || 30;
    }
  } catch (e) {}
}

async function saveGeneralSettings() {
  const payload = {
    general: {
      companyName: document.getElementById('settingCompanyName').value,
      employeeCodePrefix: document.getElementById('settingCodePrefix').value,
      annualLeaveStandard: parseInt(document.getElementById('settingAnnualLeaveStandard').value),
      contractWarningDays: parseInt(document.getElementById('settingContractWarningDays').value)
    }
  };

  try {
    await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    showToast('Đã lưu cấu hình cài đặt chung!', 'success');
  } catch (e) {
    showToast('Lỗi lưu cài đặt', 'error');
  }
}

// -------------------------------------------------------------
// 15. REPORTS ANALYTICS CHARTS (MATCHING SCREENSHOT 3 & REAL DATA)
// -------------------------------------------------------------
async function loadReportsView() {
  try {
    const res = await fetch('/api/stats');
    const data = await res.json();
    const c = data.charts;
    const k = data.kpis;

    // Helper to safely set element text
    const setEl = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    };

    // 0. Update 8 Metric KPI Cards dynamically from real database
    setEl('reportKpiTotalEmps', k.totalEmployees || 76);
    setEl('reportKpiNewHires', k.newThisPeriod || 12);
    setEl('reportKpiResigned', k.resignedCount || 9);
    setEl('reportKpiResignNote', `${k.resignedCount || 9} nhân sự nghỉ việc`);
    setEl('reportKpiTurnoverRate', `${k.turnoverRate12M || 10.6}%`);
    setEl('reportKpiAvgAge', k.avgAge || 31);
    setEl('reportKpiUnder30Text', `${k.under30Count || 36} người dưới 30 tuổi`);
    setEl('reportKpiAvgTenure', k.avgTenure || '4.6');
    setEl('reportKpiOver3YearsText', `${k.over3YearsCount || 59} người trên 3 năm`);
    setEl('reportKpiFemaleRatio', `${k.femaleRatio || '50.0'}%`);
    setEl('reportKpiGenderCounts', `${k.femaleCount || 38} nữ · ${k.maleCount || 38} nam`);
    setEl('reportKpiAvgSalary', k.avgSalaryMillion || '20.0');
    setEl('reportKpiPayrollText', `Quỹ lương: ${k.totalPayrollBillion || '1.52'} tỷ / tháng`);

    // Chart.js Plugin to draw exact real value numbers on top of bars & points
    const drawValuesPlugin = {
      id: 'drawValuesPlugin',
      afterDatasetsDraw(chart) {
        const { ctx } = chart;
        ctx.save();
        ctx.font = '600 10px Montserrat, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        chart.data.datasets.forEach((dataset, i) => {
          const meta = chart.getDatasetMeta(i);
          if (meta.hidden) return;
          meta.data.forEach((element, index) => {
            const val = dataset.data[index];
            if (val !== undefined && val !== null && val !== 0) {
              ctx.fillStyle = dataset.valueColor || '#475569';
              const text = dataset.valueFormatter ? dataset.valueFormatter(val) : val;
              if (chart.config.options.indexAxis === 'y') {
                ctx.textAlign = val < 0 ? 'right' : 'left';
                ctx.textBaseline = 'middle';
                ctx.fillText(text, element.x + (val < 0 ? -4 : 4), element.y);
              } else {
                ctx.fillText(text, element.x, element.y - 3);
              }
            }
          });
        });
        ctx.restore();
      }
    };

    // 1. Line Trend: Tổng nhân sự theo tháng
    const tCanvas = document.getElementById('chartReportEmpTrend');
    if (tCanvas) {
      if (state.chartInstances['chartReportEmpTrend']) state.chartInstances['chartReportEmpTrend'].destroy();
      state.chartInstances['chartReportEmpTrend'] = new Chart(tCanvas.getContext('2d'), {
        type: 'line',
        data: {
          labels: c.months12,
          datasets: [{
            label: 'Tổng nhân sự',
            data: c.totalByMonth,
            borderColor: '#2563eb',
            backgroundColor: 'rgba(37, 99, 235, 0.08)',
            borderWidth: 2.5,
            pointBackgroundColor: '#2563eb',
            pointRadius: 4,
            pointHoverRadius: 6,
            fill: true,
            tension: 0.35,
            valueColor: '#1e40af',
            valueFormatter: v => v
          }]
        },
        plugins: [drawValuesPlugin],
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: { callbacks: { label: ctx => `Tổng nhân sự: ${ctx.raw} người` } }
          },
          scales: {
            y: { min: 65, max: 80, ticks: { stepSize: 5 } }
          }
        }
      });
    }

    // 2. Join vs Leave: Vào làm & nghỉ việc
    const jlCanvas = document.getElementById('chartReportJoinLeave');
    if (jlCanvas) {
      if (state.chartInstances['chartReportJoinLeave']) state.chartInstances['chartReportJoinLeave'].destroy();
      state.chartInstances['chartReportJoinLeave'] = new Chart(jlCanvas.getContext('2d'), {
        type: 'bar',
        data: {
          labels: c.months12,
          datasets: [
            {
              label: 'Tuyển mới',
              data: c.joinedData,
              backgroundColor: '#10b981',
              borderRadius: 4,
              valueColor: '#047857',
              valueFormatter: v => v > 0 ? `+${v}` : ''
            },
            {
              label: 'Nghỉ việc',
              data: c.leftData,
              backgroundColor: '#f43f5e',
              borderRadius: 4,
              valueColor: '#be123c',
              valueFormatter: v => v > 0 ? `-${v}` : ''
            }
          ]
        },
        plugins: [drawValuesPlugin],
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: { beginAtZero: true, max: 3.5, ticks: { stepSize: 1 } }
          }
        }
      });
    }

    // 3. Turnover rate %: Tỷ lệ nghỉ việc theo tháng
    const rCanvas = document.getElementById('chartReportTurnoverRate');
    if (rCanvas) {
      if (state.chartInstances['chartReportTurnoverRate']) state.chartInstances['chartReportTurnoverRate'].destroy();
      const turnoverData = c.monthlyTurnoverRate || [0, 0, 0, 0, 4.3, 2.9, 0, 0, 1.4, 2.8, 0, 0, 0];
      state.chartInstances['chartReportTurnoverRate'] = new Chart(rCanvas.getContext('2d'), {
        type: 'line',
        data: {
          labels: c.months12,
          datasets: [{
            data: turnoverData,
            borderColor: '#f59e0b',
            backgroundColor: 'rgba(245, 158, 11, 0.1)',
            borderWidth: 2,
            pointBackgroundColor: '#f59e0b',
            pointRadius: 3,
            fill: true,
            tension: 0.3,
            valueColor: '#b45309',
            valueFormatter: v => v > 0 ? `${v}%` : ''
          }]
        },
        plugins: [drawValuesPlugin],
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: { callbacks: { label: ctx => `Tỷ lệ nghỉ việc: ${ctx.raw}%` } }
          },
          scales: {
            y: { beginAtZero: true, max: 6, ticks: { callback: v => `${v}%` } }
          }
        }
      });
    }

    // 4. Resignation reasons donut: Lý do nghỉ việc (Trong kỳ)
    const reCanvas = document.getElementById('chartReportResignReasons');
    if (reCanvas) {
      if (state.chartInstances['chartReportResignReasons']) state.chartInstances['chartReportResignReasons'].destroy();
      const resignLabels = Object.keys(c.resignationReasons || {});
      const resignValues = Object.values(c.resignationReasons || {});
      const totalResigned = resignValues.reduce((a, b) => a + b, 0) || 9;
      setEl('centerTotalResign', totalResigned);

      const resignColors = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];
      state.chartInstances['chartReportResignReasons'] = new Chart(reCanvas.getContext('2d'), {
        type: 'doughnut',
        data: {
          labels: resignLabels,
          datasets: [{
            data: resignValues,
            backgroundColor: resignColors.slice(0, resignLabels.length),
            borderWidth: 2,
            borderColor: '#ffffff'
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '72%',
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: ctx => ` ${ctx.label}: ${ctx.raw} người (${Math.round((ctx.raw / totalResigned) * 100)}%)`
              }
            }
          }
        }
      });

      const lResign = document.getElementById('legendResignReasons');
      if (lResign) {
        lResign.innerHTML = resignLabels.map((lbl, idx) => `
          <div class="flex items-center justify-between py-0.5 border-b border-slate-50 last:border-0">
            <span class="flex items-center gap-1.5 truncate">
              <span class="w-2 h-2 rounded-full flex-shrink-0" style="background-color: ${resignColors[idx]}"></span>
              <span class="truncate">${lbl}</span>
            </span>
            <span class="font-bold text-slate-800 ml-1.5">${resignValues[idx]}</span>
          </div>
        `).join('');
      }
    }

    // 5. Age Pyramid (Nam vs Nữ)
    const pCanvas = document.getElementById('chartReportAgePyramid');
    if (pCanvas) {
      if (state.chartInstances['chartReportAgePyramid']) state.chartInstances['chartReportAgePyramid'].destroy();
      const pyramidLabels = ['<25', '25-29', '30-34', '35-39', '40-49', '50+'];
      const maleData = pyramidLabels.map(l => (c.agePyramid?.male?.[l] || 0));
      const femaleData = pyramidLabels.map(l => (c.agePyramid?.female?.[l] || 0));

      state.chartInstances['chartReportAgePyramid'] = new Chart(pCanvas.getContext('2d'), {
        type: 'bar',
        data: {
          labels: pyramidLabels,
          datasets: [
            {
              label: 'Nam',
              data: maleData.map(v => -v),
              backgroundColor: '#3b82f6',
              borderRadius: 4,
              valueColor: '#1e40af',
              valueFormatter: v => Math.abs(v) > 0 ? `${Math.abs(v)}` : ''
            },
            {
              label: 'Nữ',
              data: femaleData,
              backgroundColor: '#ec4899',
              borderRadius: 4,
              valueColor: '#be185d',
              valueFormatter: v => v > 0 ? `${v}` : ''
            }
          ]
        },
        plugins: [drawValuesPlugin],
        options: {
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'top', labels: { boxWidth: 8, font: { size: 10 } } },
            tooltip: {
              callbacks: {
                label: ctx => `${ctx.dataset.label}: ${Math.abs(ctx.raw)} người`
              }
            }
          },
          scales: {
            x: {
              ticks: { callback: v => Math.abs(v), font: { size: 9 } }
            }
          }
        }
      });
    }

    // 6. Education Donut: Trình độ học vấn
    const eduCanvas = document.getElementById('chartReportEducation');
    if (eduCanvas) {
      if (state.chartInstances['chartReportEducation']) state.chartInstances['chartReportEducation'].destroy();
      const eduLabels = Object.keys(c.educationStats || {});
      const eduValues = Object.values(c.educationStats || {});
      const totalEdu = eduValues.reduce((a, b) => a + b, 0) || 76;
      setEl('centerTotalEdu', totalEdu);

      const eduColors = ['#f59e0b', '#10b981', '#8b5cf6', '#6366f1'];
      state.chartInstances['chartReportEducation'] = new Chart(eduCanvas.getContext('2d'), {
        type: 'doughnut',
        data: {
          labels: eduLabels,
          datasets: [{
            data: eduValues,
            backgroundColor: eduColors.slice(0, eduLabels.length),
            borderWidth: 2,
            borderColor: '#ffffff'
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '72%',
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: ctx => ` ${ctx.label}: ${ctx.raw} người (${Math.round((ctx.raw / totalEdu) * 100)}%)`
              }
            }
          }
        }
      });

      const lEdu = document.getElementById('legendEducation');
      if (lEdu) {
        lEdu.innerHTML = eduLabels.map((lbl, idx) => `
          <span class="inline-flex items-center gap-1 bg-slate-50 px-2 py-0.5 rounded-lg border border-slate-100 text-[10px]">
            <span class="w-2 h-2 rounded-full" style="background-color: ${eduColors[idx]}"></span>
            <span>${lbl}: <strong class="text-slate-800">${eduValues[idx]}</strong></span>
          </span>
        `).join('');
      }
    }

    // 7. Salary funds by dept: Quỹ lương theo phòng ban (Số liệu thực tế 12 phòng ban)
    const sdCanvas = document.getElementById('chartReportSalaryDept');
    if (sdCanvas) {
      if (state.chartInstances['chartReportSalaryDept']) state.chartInstances['chartReportSalaryDept'].destroy();
      const deptStats = c.departmentSalaryStats || [];
      const deptLabels = deptStats.map(d => d.name);
      const deptSalData = deptStats.map(d => d.totalMillion);

      state.chartInstances['chartReportSalaryDept'] = new Chart(sdCanvas.getContext('2d'), {
        type: 'bar',
        data: {
          labels: deptLabels,
          datasets: [{
            label: 'Quỹ lương (Triệu đ)',
            data: deptSalData,
            backgroundColor: '#8b5cf6',
            borderRadius: 6,
            valueColor: '#6d28d9',
            valueFormatter: v => `${v}tr`
          }]
        },
        plugins: [drawValuesPlugin],
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (ctx) => {
                  const item = deptStats[ctx.dataIndex];
                  return ` Quỹ lương: ${ctx.raw} tr (${item.count} NS · TB: ${item.avgMillion} tr/người)`;
                }
              }
            }
          },
          scales: {
            x: {
              ticks: { maxRotation: 45, minRotation: 20, font: { size: 9 } }
            },
            y: {
              beginAtZero: true,
              grace: '15%',
              ticks: { callback: v => `${v}tr` }
            }
          }
        }
      });
    }

    // 8. Avg salary by level: Lương TB theo cấp bậc (Horizontal Bar Chart)
    const slCanvas = document.getElementById('chartReportSalaryLevel');
    if (slCanvas) {
      if (state.chartInstances['chartReportSalaryLevel']) state.chartInstances['chartReportSalaryLevel'].destroy();
      const lvlStats = c.levelSalaryStats || [];
      const lvlLabels = lvlStats.map(l => l.level);
      const lvlSalData = lvlStats.map(l => l.avgSalary);

      state.chartInstances['chartReportSalaryLevel'] = new Chart(slCanvas.getContext('2d'), {
        type: 'bar',
        data: {
          labels: lvlLabels,
          datasets: [{
            label: 'Lương trung bình (Triệu đ)',
            data: lvlSalData,
            backgroundColor: '#06b6d4',
            borderRadius: 6,
            valueColor: '#0e7490',
            valueFormatter: v => `${v} tr`
          }]
        },
        plugins: [drawValuesPlugin],
        options: {
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (ctx) => {
                  const item = lvlStats[ctx.dataIndex];
                  return ` Lương TB: ${ctx.raw} tr (${item.count} nhân sự)`;
                }
              }
            }
          },
          scales: {
            x: {
              beginAtZero: true,
              grace: '15%',
              ticks: { callback: v => `${v}tr` }
            }
          }
        }
      });
    }

    // 9. Contract Types Donut: Loại hợp đồng (Card thứ 3 dòng dưới theo concept)
    const ctCanvas = document.getElementById('chartReportContractTypes');
    if (ctCanvas) {
      if (state.chartInstances['chartReportContractTypes']) state.chartInstances['chartReportContractTypes'].destroy();
      const contractBreakdown = c.contractTypesBreakdown || {
        'HĐ không thời hạn': 53,
        'HĐ xác định 36T': 15,
        'HĐ thử việc 2T': 6,
        'HĐ xác định 12T': 2
      };
      const cLabels = Object.keys(contractBreakdown);
      const cValues = Object.values(contractBreakdown);
      const totalContracts = cValues.reduce((a, b) => a + b, 0) || 76;
      setEl('centerTotalContracts', totalContracts);

      const cColors = ['#2563eb', '#10b981', '#f59e0b', '#ec4899'];
      state.chartInstances['chartReportContractTypes'] = new Chart(ctCanvas.getContext('2d'), {
        type: 'doughnut',
        data: {
          labels: cLabels,
          datasets: [{
            data: cValues,
            backgroundColor: cColors.slice(0, cLabels.length),
            borderWidth: 2,
            borderColor: '#ffffff'
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '72%',
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: ctx => ` ${ctx.label}: ${ctx.raw} HĐ (${Math.round((ctx.raw / totalContracts) * 100)}%)`
              }
            }
          }
        }
      });

      const lContract = document.getElementById('legendContractTypes');
      if (lContract) {
        lContract.innerHTML = cLabels.map((lbl, idx) => `
          <span class="inline-flex items-center gap-1 bg-slate-50 px-2 py-0.5 rounded-lg border border-slate-100 text-[10px]">
            <span class="w-2 h-2 rounded-full" style="background-color: ${cColors[idx]}"></span>
            <span>${lbl}: <strong class="text-slate-800">${cValues[idx]}</strong></span>
          </span>
        `).join('');
      }
    }

  } catch (err) {
    console.error('Failed to load reports charts:', err);
  }
}

// -------------------------------------------------------------
// 16. USERS & PERMISSIONS VIEW (Người dùng & Phân quyền chi tiết)
// -------------------------------------------------------------
const PERM_MODULES = [
  { id: 'overview', name: 'Tổng quan & KPI', desc: 'Xem số liệu, biểu đồ biến động, cảnh báo', icon: 'layout-dashboard' },
  { id: 'employees', name: 'Hồ sơ nhân viên', desc: 'Quản lý thông tin, hợp đồng, lương, điều chuyển', icon: 'users' },
  { id: 'departments', name: 'Phòng ban', desc: 'Cơ cấu phòng ban, sơ đồ tổ chức, trưởng phòng', icon: 'network' },
  { id: 'branches', name: 'Chi nhánh', desc: 'Văn phòng, địa điểm, quy mô nhân sự', icon: 'building-2' },
  { id: 'positions', name: 'Vị trí – Chức danh', desc: 'Định biên nhân sự, cấp bậc, khung lương', icon: 'briefcase' },
  { id: 'leaves', name: 'Quản lý nghỉ phép', desc: 'Đơn nghỉ phép, phê duyệt đơn, quỹ phép năm', icon: 'calendar-days' },
  { id: 'reports', name: 'Báo cáo & Phân tích', desc: 'Tháp tuổi, thâm niên, tỷ lệ nghỉ việc, quỹ lương', icon: 'bar-chart-3' },
  { id: 'users', name: 'Người dùng & Phân quyền', desc: 'Quản lý tài khoản, phân quyền ma trận 9 danh mục', icon: 'shield-alert' },
  { id: 'settings', name: 'Cài đặt & Đồng bộ', desc: 'Cài đặt chung, cấu hình đồng bộ Google Sheets', icon: 'settings' }
];

const PERM_ACTIONS = [
  { id: 'view', label: 'Xem' },
  { id: 'create', label: 'Thêm' },
  { id: 'edit', label: 'Sửa' },
  { id: 'delete', label: 'Xóa' },
  { id: 'approve', label: 'Duyệt' },
  { id: 'export', label: 'Xuất/Sync' }
];

function getPresetPerms(role) {
  const p = {};
  PERM_MODULES.forEach(m => {
    if (role === 'admin') {
      p[m.id] = { view: true, create: true, edit: true, delete: true, approve: true, export: true };
    } else if (role === 'hr') {
      if (m.id === 'users') {
        p[m.id] = { view: true, create: false, edit: false, delete: false, approve: false, export: false };
      } else if (m.id === 'settings') {
        p[m.id] = { view: true, create: false, edit: true, delete: false, approve: false, export: true };
      } else {
        p[m.id] = { view: true, create: true, edit: true, delete: true, approve: true, export: true };
      }
    } else if (role === 'manager') {
      if (['overview', 'reports'].includes(m.id)) {
        p[m.id] = { view: true, create: false, edit: false, delete: false, approve: false, export: true };
      } else if (['employees', 'departments', 'branches', 'positions'].includes(m.id)) {
        p[m.id] = { view: true, create: false, edit: false, delete: false, approve: false, export: true };
      } else if (m.id === 'leaves') {
        p[m.id] = { view: true, create: true, edit: true, delete: false, approve: true, export: true };
      } else {
        p[m.id] = { view: false, create: false, edit: false, delete: false, approve: false, export: false };
      }
    } else if (role === 'viewer') {
      if (['overview', 'employees', 'departments', 'branches', 'positions', 'leaves', 'reports'].includes(m.id)) {
        p[m.id] = { view: true, create: false, edit: false, delete: false, approve: false, export: false };
      } else {
        p[m.id] = { view: false, create: false, edit: false, delete: false, approve: false, export: false };
      }
    } else {
      p[m.id] = { view: false, create: false, edit: false, delete: false, approve: false, export: false };
    }
  });
  return p;
}

async function loadUsersView() {
  try {
    const res = await fetch('/api/users');
    state.users = await res.json();

    // Populate Employee link select
    const linkSelect = document.getElementById('userFormLinkedEmployee');
    if (linkSelect && state.employees) {
      linkSelect.innerHTML = `<option value="">— Không liên kết —</option>` +
        state.employees.map(e => `<option value="${e.code}">${e.code} • ${e.fullName} (${e.departmentName || 'Chưa gán'})</option>`).join('');
    }

    // Update KPI cards
    const totalUsers = state.users.length;
    const adminUsers = state.users.filter(u => u.role === 'admin').length;
    const hrUsers = state.users.filter(u => u.role === 'hr' || u.role === 'manager').length;
    const activeUsers = state.users.filter(u => u.status !== 'locked').length;

    const elTotal = document.getElementById('kpiTotalUsers');
    if (elTotal) elTotal.innerText = totalUsers;
    const elAdmin = document.getElementById('kpiAdminUsers');
    if (elAdmin) elAdmin.innerText = adminUsers;
    const elHr = document.getElementById('kpiHrUsers');
    if (elHr) elHr.innerText = hrUsers;
    const elActive = document.getElementById('kpiActiveUsers');
    if (elActive) elActive.innerText = activeUsers;

    filterUsersList();
  } catch (err) {
    console.error('Failed to load users:', err);
  }
}

function filterUsersList() {
  const tbody = document.getElementById('usersTableBody');
  if (!tbody || !state.users) return;

  const searchInput = (document.getElementById('userSearchInput')?.value || '').trim().toLowerCase();
  const roleFilter = document.getElementById('userRoleFilter')?.value || 'all';
  const scopeFilter = document.getElementById('userScopeFilter')?.value || 'all';
  const statusFilter = document.getElementById('userStatusFilter')?.value || 'all';

  const filtered = state.users.filter(u => {
    // Search
    if (searchInput) {
      const matchName = (u.name || '').toLowerCase().includes(searchInput);
      const matchUser = (u.username || '').toLowerCase().includes(searchInput);
      const matchEmail = (u.email || '').toLowerCase().includes(searchInput);
      const matchPhone = (u.phone || '').includes(searchInput);
      const matchEmp = (u.linkedEmployeeName || '').toLowerCase().includes(searchInput);
      if (!matchName && !matchUser && !matchEmail && !matchPhone && !matchEmp) return false;
    }

    // Role
    if (roleFilter !== 'all' && u.role !== roleFilter) return false;

    // Scope
    if (scopeFilter !== 'all') {
      if (scopeFilter === 'all_branches' && u.scope !== 'all') return false;
      if (scopeFilter !== 'all_branches' && u.scope !== scopeFilter) return false;
    }

    // Status
    if (statusFilter !== 'all') {
      const userStatus = u.status || 'active';
      if (userStatus !== statusFilter) return false;
    }

    return true;
  });

  const countBadge = document.getElementById('usersCountBadge');
  if (countBadge) countBadge.innerText = `${filtered.length} / ${state.users.length}`;

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="p-8 text-center text-slate-400">
          <i data-lucide="user-x" class="w-8 h-8 mx-auto mb-2 text-slate-300"></i>
          Không tìm thấy người dùng nào phù hợp với bộ lọc.
        </td>
      </tr>
    `;
    lucide.createIcons();
    return;
  }

  tbody.innerHTML = filtered.map(u => {
    // Role styling
    let roleClass = 'bg-slate-100 text-slate-700 whitespace-nowrap inline-block';
    if (u.role === 'admin') roleClass = 'bg-purple-100 text-purple-800 border border-purple-200 whitespace-nowrap inline-block';
    else if (u.role === 'hr') roleClass = 'bg-blue-100 text-blue-800 border border-blue-200 whitespace-nowrap inline-block';
    else if (u.role === 'manager') roleClass = 'bg-amber-100 text-amber-800 border border-amber-200 whitespace-nowrap inline-block';
    else if (u.role === 'custom') roleClass = 'bg-indigo-100 text-indigo-800 border border-indigo-200 whitespace-nowrap inline-block';

    // Permissions summary
    let permsBadge = '';
    if (u.role === 'admin') {
      permsBadge = `
        <button onclick="viewUserPermissions('${u.id}')" class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200 transition">
          <i data-lucide="shield-check" class="w-3.5 h-3.5"></i>
          <span>Toàn quyền (9/9)</span>
        </button>
      `;
    } else {
      let activeModules = 0;
      if (u.permissions) {
        Object.values(u.permissions).forEach(act => {
          if (Object.values(act).some(v => v)) activeModules++;
        });
      }
      permsBadge = `
        <button onclick="viewUserPermissions('${u.id}')" class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 transition">
          <i data-lucide="key" class="w-3.5 h-3.5 text-slate-400"></i>
          <span>${activeModules}/9 danh mục</span>
          <i data-lucide="chevron-right" class="w-3 h-3 text-slate-400"></i>
        </button>
      `;
    }

    // Status styling
    const isLocked = u.status === 'locked';
    const statusHtml = isLocked 
      ? `<span class="inline-flex items-center gap-1 text-xs font-semibold text-rose-600"><span class="w-1.5 h-1.5 rounded-full bg-rose-500"></span> Đã khóa</span>`
      : `<span class="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600"><span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Hoạt động</span>`;

    const isRootAdmin = u.id === 'U001';

    return `
      <tr class="hover:bg-slate-50/80 transition">
        <td class="p-3.5">
          <div class="flex items-center gap-2.5">
            <div class="w-9 h-9 rounded-full ${u.role === 'admin' ? 'bg-purple-600' : 'bg-brand-600'} text-white font-bold text-xs flex items-center justify-center shadow-xs">
              ${u.name.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <p class="font-bold text-slate-900">${u.name}</p>
              <p class="text-[11px] text-slate-400 font-mono">@${u.username}</p>
            </div>
          </div>
        </td>
        <td class="p-3.5 text-xs text-slate-600">
          <div class="font-medium">${u.email || '—'}</div>
          <div class="text-[11px] text-slate-400">${u.phone || 'Chưa cập nhật SĐT'}</div>
        </td>
        <td class="p-3.5">
          <span class="px-2.5 py-1 rounded-full text-xs font-semibold ${roleClass}">
            ${u.roleLabel || u.role}
          </span>
        </td>
        <td class="p-3.5 text-xs font-medium text-slate-800">
          <span class="flex items-center gap-1.5">
            <i data-lucide="globe" class="w-3.5 h-3.5 text-slate-400"></i>
            ${u.scopeLabel || 'Tất cả chi nhánh'}
          </span>
        </td>
        <td class="p-3.5">
          ${permsBadge}
        </td>
        <td class="p-3.5 text-xs text-slate-600">
          ${u.linkedEmployeeName && u.linkedEmployeeName !== '—' 
            ? `<span class="font-medium text-brand-600">${u.linkedEmployeeName}</span>` 
            : `<span class="text-slate-400">— Chưa gán —</span>`}
        </td>
        <td class="p-3.5">
          ${statusHtml}
        </td>
        <td class="p-3.5 text-right whitespace-nowrap">
          <div class="inline-flex items-center gap-1">
            <button onclick="openEditUserModal('${u.id}')" title="Chỉnh sửa & Phân quyền" class="p-1.5 text-slate-500 hover:text-brand-600 hover:bg-slate-100 rounded-lg transition">
              <i data-lucide="edit-3" class="w-4 h-4"></i>
            </button>
            ${!isRootAdmin ? `
              <button onclick="toggleUserLock('${u.id}')" title="${isLocked ? 'Mở khóa tài khoản' : 'Khóa tài khoản'}" class="p-1.5 ${isLocked ? 'text-emerald-600 hover:bg-emerald-50' : 'text-amber-600 hover:bg-amber-50'} rounded-lg transition">
                <i data-lucide="${isLocked ? 'unlock' : 'lock'}" class="w-4 h-4"></i>
              </button>
              <button onclick="deleteUser('${u.id}')" title="Xóa người dùng" class="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition">
                <i data-lucide="trash-2" class="w-4 h-4"></i>
              </button>
            ` : `
              <span class="px-2 py-0.5 text-[10px] text-slate-300 select-none">Tối cao</span>
            `}
          </div>
        </td>
      </tr>
    `;
  }).join('');

  lucide.createIcons();
}

// -------------------------------------------------------------
// USER FORM & PERMISSIONS MATRIX CONTROLLERS
// -------------------------------------------------------------
function renderPermissionsMatrix(currentPerms = {}) {
  const tbody = document.getElementById('permissionsMatrixBody');
  if (!tbody) return;

  tbody.innerHTML = PERM_MODULES.map(m => {
    const modPerm = currentPerms[m.id] || { view: false, create: false, edit: false, delete: false, approve: false, export: false };
    const allRowChecked = PERM_ACTIONS.every(a => modPerm[a.id]);

    return `
      <tr class="hover:bg-slate-50/80 transition" data-module="${m.id}">
        <td class="p-2.5">
          <div class="flex items-center gap-2">
            <div class="w-6 h-6 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center flex-shrink-0">
              <i data-lucide="${m.icon}" class="w-3.5 h-3.5"></i>
            </div>
            <div>
              <p class="font-bold text-slate-800 text-xs">${m.name}</p>
              <p class="text-[10px] text-slate-400">${m.desc}</p>
            </div>
          </div>
        </td>
        ${PERM_ACTIONS.map(a => `
          <td class="p-2 text-center">
            <input type="checkbox" 
                   data-perm-mod="${m.id}" 
                   data-perm-act="${a.id}" 
                   ${modPerm[a.id] ? 'checked' : ''} 
                   onchange="handlePermCheckboxChange()"
                   class="perm-checkbox rounded text-brand-600 focus:ring-0 w-4 h-4 cursor-pointer">
          </td>
        `).join('')}
        <td class="p-2 text-center">
          <input type="checkbox" 
                 ${allRowChecked ? 'checked' : ''} 
                 onchange="toggleRowPermissions('${m.id}', this.checked)" 
                 class="rounded text-slate-500 focus:ring-0 w-3.5 h-3.5 cursor-pointer" 
                 title="Bật/Tắt tất cả quyền của danh mục này">
        </td>
      </tr>
    `;
  }).join('');

  lucide.createIcons();
}

function handlePermCheckboxChange() {
  // When user manually toggles checkboxes, set role preset to 'custom'
  const presetSelect = document.getElementById('userFormRolePreset');
  if (presetSelect && presetSelect.value !== 'custom') {
    presetSelect.value = 'custom';
  }
}

function applyRolePreset(role) {
  if (role === 'custom') return;
  const perms = getPresetPerms(role);
  renderPermissionsMatrix(perms);
}

function toggleAllPermissions(checked) {
  const checkboxes = document.querySelectorAll('.perm-checkbox');
  checkboxes.forEach(cb => cb.checked = checked);
  const presetSelect = document.getElementById('userFormRolePreset');
  if (presetSelect) presetSelect.value = checked ? 'admin' : 'custom';
}

function toggleColumnPermissions(actId, checked) {
  const checkboxes = document.querySelectorAll(`.perm-checkbox[data-perm-act="${actId}"]`);
  checkboxes.forEach(cb => cb.checked = checked);
  handlePermCheckboxChange();
}

function toggleRowPermissions(modId, checked) {
  const checkboxes = document.querySelectorAll(`.perm-checkbox[data-perm-mod="${modId}"]`);
  checkboxes.forEach(cb => cb.checked = checked);
  handlePermCheckboxChange();
}

function toggleOnlyViewPermissions() {
  PERM_MODULES.forEach(m => {
    PERM_ACTIONS.forEach(a => {
      const cb = document.querySelector(`.perm-checkbox[data-perm-mod="${m.id}"][data-perm-act="${a.id}"]`);
      if (cb) cb.checked = (a.id === 'view');
    });
  });
  const presetSelect = document.getElementById('userFormRolePreset');
  if (presetSelect) presetSelect.value = 'viewer';
}

function readCurrentPermissionsFromMatrix() {
  const perms = {};
  PERM_MODULES.forEach(m => {
    perms[m.id] = {};
    PERM_ACTIONS.forEach(a => {
      const cb = document.querySelector(`.perm-checkbox[data-perm-mod="${m.id}"][data-perm-act="${a.id}"]`);
      perms[m.id][a.id] = cb ? cb.checked : false;
    });
  });
  return perms;
}

function handleSelectLinkedEmployee(empCode) {
  if (!empCode || !state.employees) return;
  const emp = state.employees.find(e => e.code === empCode);
  if (!emp) return;

  const nameInput = document.getElementById('userFormName');
  const emailInput = document.getElementById('userFormEmail');
  const phoneInput = document.getElementById('userFormPhone');

  if (nameInput && (!nameInput.value || nameInput.value.trim() === '')) {
    nameInput.value = emp.fullName;
  }
  if (emailInput && (!emailInput.value || emailInput.value.trim() === '')) {
    emailInput.value = emp.email || '';
  }
  if (phoneInput && (!phoneInput.value || phoneInput.value.trim() === '')) {
    phoneInput.value = emp.phone || '';
  }
}

function togglePasswordVisibility(inputId) {
  const input = document.getElementById(inputId);
  if (!input) return;
  input.type = input.type === 'password' ? 'text' : 'password';
}

function openAddUserModal() {
  document.getElementById('userFormId').value = '';
  document.getElementById('modalUserTitle').innerText = 'Thêm người dùng & Phân quyền chi tiết';
  document.getElementById('modalUserSubtitle').innerText = 'Tạo tài khoản đăng nhập mới, gán phạm vi dữ liệu và thiết lập ma trận quyền hạn 9 danh mục';
  
  document.getElementById('userFormName').value = '';
  document.getElementById('userFormUsername').value = '';
  document.getElementById('userFormPassword').value = '';
  document.getElementById('userFormEmail').value = '';
  document.getElementById('userFormPhone').value = '';
  document.getElementById('userFormLinkedEmployee').value = '';
  document.getElementById('userFormScope').value = 'all';
  document.getElementById('userFormStatus').value = 'active';
  
  const presetSelect = document.getElementById('userFormRolePreset');
  if (presetSelect) presetSelect.value = 'hr';
  
  renderPermissionsMatrix(getPresetPerms('hr'));
  openModal('modalUserForm');
}

async function openEditUserModal(userId) {
  try {
    const res = await fetch(`/api/users/${userId}`);
    if (!res.ok) throw new Error('Không tìm thấy người dùng');
    const user = await res.json();

    document.getElementById('userFormId').value = user.id;
    document.getElementById('modalUserTitle').innerText = `Chỉnh sửa: ${user.name} (@${user.username})`;
    document.getElementById('modalUserSubtitle').innerText = `Cập nhật thông tin tài khoản, mật khẩu, phạm vi và ma trận phân quyền`;

    document.getElementById('userFormName').value = user.name || '';
    document.getElementById('userFormUsername').value = user.username || '';
    document.getElementById('userFormPassword').value = ''; // Leave blank if no change
    document.getElementById('userFormEmail').value = user.email || '';
    document.getElementById('userFormPhone').value = user.phone || '';
    document.getElementById('userFormLinkedEmployee').value = user.linkedEmployeeId || '';
    document.getElementById('userFormScope').value = user.scope || 'all';
    document.getElementById('userFormStatus').value = user.status || 'active';

    const presetSelect = document.getElementById('userFormRolePreset');
    if (presetSelect) presetSelect.value = user.role || 'custom';

    renderPermissionsMatrix(user.permissions || getPresetPerms(user.role || 'viewer'));
    openModal('modalUserForm');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function handleUserFormSubmit(event) {
  event.preventDefault();
  const saveBtn = document.getElementById('saveUserBtn');
  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> <span>Đang lưu...</span>`;
    lucide.createIcons();
  }

  try {
    const userId = document.getElementById('userFormId').value;
    const name = document.getElementById('userFormName').value.trim();
    const username = document.getElementById('userFormUsername').value.trim();
    const password = document.getElementById('userFormPassword').value;
    const email = document.getElementById('userFormEmail').value.trim();
    const phone = document.getElementById('userFormPhone').value.trim();
    const linkedEmpId = document.getElementById('userFormLinkedEmployee').value;
    const scope = document.getElementById('userFormScope').value;
    const status = document.getElementById('userFormStatus').value;
    const role = document.getElementById('userFormRolePreset').value;

    let linkedEmpName = '—';
    if (linkedEmpId && state.employees) {
      const foundEmp = state.employees.find(e => e.code === linkedEmpId);
      if (foundEmp) linkedEmpName = `${foundEmp.code} • ${foundEmp.fullName}`;
    }

    const permissions = readCurrentPermissionsFromMatrix();

    const payload = {
      name,
      username,
      email,
      phone,
      role,
      scope,
      linkedEmployeeId: linkedEmpId || null,
      linkedEmployeeName: linkedEmpName,
      status,
      permissions
    };

    if (password) payload.password = password;

    const url = userId ? `/api/users/${userId}` : '/api/users';
    const method = userId ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Lỗi khi lưu thông tin người dùng');

    showToast(data.message || 'Lưu thành công!', 'success');
    closeModal('modalUserForm');
    await loadUsersView();

    // Trigger background sync to Google Sheets so sheet "Người dùng & Phân quyền" updates
    fetch('/api/sync-google-sheets', { method: 'POST' }).catch(() => {});

  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.innerHTML = `<i data-lucide="check" class="w-4 h-4"></i> <span>Lưu người dùng & Phân quyền</span>`;
      lucide.createIcons();
    }
  }
}

async function toggleUserLock(userId) {
  try {
    const res = await fetch(`/api/users/${userId}/status`, { method: 'PUT' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Không thể đổi trạng thái tài khoản');
    showToast(data.message, 'success');
    await loadUsersView();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function deleteUser(userId) {
  const user = (state.users || []).find(u => u.id === userId);
  const name = user ? user.name : userId;
  if (!confirm(`Bạn có chắc chắn muốn xóa tài khoản "${name}" khỏi hệ thống không? Hành động này không thể hoàn tác.`)) {
    return;
  }

  try {
    const res = await fetch(`/api/users/${userId}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Không thể xóa người dùng');
    showToast(data.message, 'success');
    await loadUsersView();

    // Trigger sync to Google Sheets
    fetch('/api/sync-google-sheets', { method: 'POST' }).catch(() => {});
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function viewUserPermissions(userId) {
  const user = (state.users || []).find(u => u.id === userId);
  if (!user) return;

  const avatar = document.getElementById('viewPermsAvatar');
  if (avatar) avatar.innerText = user.name.slice(0, 2).toUpperCase();

  const nameEl = document.getElementById('viewPermsUserName');
  if (nameEl) nameEl.innerText = `${user.name} (@${user.username})`;

  const roleEl = document.getElementById('viewPermsUserRole');
  if (roleEl) roleEl.innerText = `${user.roleLabel || user.role} • Phạm vi: ${user.scopeLabel || 'Tất cả chi nhánh'} • Trạng thái: ${user.statusLabel || 'Hoạt động'}`;

  const editBtn = document.getElementById('viewPermsEditBtn');
  if (editBtn) {
    editBtn.onclick = () => {
      closeModal('modalViewPermissions');
      openEditUserModal(user.id);
    };
  }

  const contentEl = document.getElementById('viewPermsContent');
  if (!contentEl) return;

  const perms = user.permissions || getPresetPerms(user.role || 'viewer');

  contentEl.innerHTML = `
    <div class="border border-slate-200 rounded-xl overflow-hidden">
      <table class="w-full text-left text-xs">
        <thead class="bg-slate-100/90 text-slate-700 font-bold border-b border-slate-200 text-[11px]">
          <tr>
            <th class="p-2.5">Danh mục chức năng</th>
            <th class="p-2.5 text-center">Xem</th>
            <th class="p-2.5 text-center">Thêm</th>
            <th class="p-2.5 text-center">Sửa</th>
            <th class="p-2.5 text-center">Xóa</th>
            <th class="p-2.5 text-center">Duyệt</th>
            <th class="p-2.5 text-center">Xuất/Sync</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100 bg-white">
          ${PERM_MODULES.map(m => {
            const modPerm = perms[m.id] || {};
            return `
              <tr class="hover:bg-slate-50/70">
                <td class="p-2.5 font-semibold text-slate-800 flex items-center gap-2">
                  <i data-lucide="${m.icon}" class="w-3.5 h-3.5 text-slate-500"></i>
                  ${m.name}
                </td>
                ${PERM_ACTIONS.map(a => `
                  <td class="p-2 text-center">
                    ${modPerm[a.id] 
                      ? `<span class="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold">✓</span>` 
                      : `<span class="inline-flex items-center justify-center w-5 h-5 rounded-full bg-slate-100 text-slate-300 text-xs">—</span>`}
                  </td>
                `).join('')}
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;

  openModal('modalViewPermissions');
}

// -------------------------------------------------------------
// UTILITIES & MODAL CONTROLS
// -------------------------------------------------------------
function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove('hidden');
    lucide.createIcons();
  }
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.add('hidden');
}

function showToast(msg, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  const bg = type === 'success' ? 'bg-emerald-600' : (type === 'error' ? 'bg-rose-600' : 'bg-slate-900');
  toast.className = `${bg} text-white px-4 py-2.5 rounded-xl shadow-lg text-xs font-semibold flex items-center gap-2 transform transition-all duration-300 translate-y-2 opacity-0 pointer-events-auto`;
  toast.innerHTML = `<span>${msg}</span>`;

  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.remove('translate-y-2', 'opacity-0');
  }, 10);

  setTimeout(() => {
    toast.classList.add('opacity-0');
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

function formatVND(num) {
  if (num === undefined || num === null || isNaN(num)) return '0 đ';
  return new Intl.NumberFormat('vi-VN').format(Math.round(num)) + ' đ';
}

// -------------------------------------------------------------
// 17. TIMEKEEPING VIEW (CHẤM CÔNG CÁC PHÒNG BAN RIÊNG BIỆT)
// -------------------------------------------------------------
state.currentAttendanceDept = 'all';
state.attendanceList = [];

// November 2026 days map (Day 1 is Sunday)
const NOV_DAY_NAMES = {
  1: 'CN', 2: 'T2', 3: 'T3', 4: 'T4', 5: 'T5', 6: 'T6', 7: 'T7',
  8: 'CN', 9: 'T2', 10: 'T3', 11: 'T4', 12: 'T5', 13: 'T6', 14: 'T7',
  15: 'CN', 16: 'T2', 17: 'T3', 18: 'T4', 19: 'T5', 20: 'T6', 21: 'T7',
  22: 'CN', 23: 'T2', 24: 'T3', 25: 'T4', 26: 'T5', 27: 'T6', 28: 'T7',
  29: 'CN', 30: 'T2'
};

async function loadAttendanceView() {
  const monthSelect = document.getElementById('attendanceMonthSelect');
  const month = monthSelect ? monthSelect.value : '11/2026';
  const deptId = state.currentAttendanceDept || 'all';

  try {
    const res = await fetch(`/api/attendance?month=${month}&departmentId=${deptId}`);
    if (!res.ok) throw new Error('Không thể tải dữ liệu chấm công');
    const data = await res.json();
    state.attendanceList = data.attendance;

    // Render Department Selector Tabs
    const tabsContainer = document.getElementById('attendanceDeptTabs');
    if (tabsContainer && data.departments) {
      // Calculate staff count per department
      const counts = {};
      (data.attendance || []).forEach(a => {
        counts[a.departmentId] = (counts[a.departmentId] || 0) + 1;
      });

      tabsContainer.innerHTML = `
        <button onclick="setAttendanceDept('all')" class="whitespace-nowrap px-3.5 py-1.5 rounded-xl text-xs font-semibold transition ${deptId === 'all' ? 'bg-brand-600 text-white shadow-xs' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}">
          Tất cả phòng ban (${data.attendance.length})
        </button>
      ` + data.departments.map(d => {
        const count = counts[d.id] || 0;
        const isActive = deptId === d.id;
        return `
          <button onclick="setAttendanceDept('${d.id}')" class="whitespace-nowrap px-3.5 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 ${isActive ? 'bg-brand-600 text-white shadow-xs' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}">
            <span>${d.name}</span>
            <span class="px-1.5 py-0.2 rounded-full text-[10px] ${isActive ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-600'}">${count}</span>
          </button>
        `;
      }).join('');
    }

    // Update KPI Cards
    const s = data.summary;
    const elStaff = document.getElementById('attKpiStaff');
    if (elStaff) elStaff.innerText = `${s.totalStaff} NV`;
    const elWork = document.getElementById('attKpiWorkDays');
    if (elWork) elWork.innerText = `${s.totalWorkDays} công`;
    const elLeave = document.getElementById('attKpiLeaveDays');
    if (elLeave) elLeave.innerText = `${s.totalLeaveDays} ngày`;
    const elLate = document.getElementById('attKpiLateDays');
    if (elLate) elLate.innerText = `${s.totalLateDays} lần`;
    const elRate = document.getElementById('attKpiRate');
    if (elRate) elRate.innerText = `${s.avgAttendanceRate}%`;

    // Render Table Header (Days 1 to 30)
    renderAttendanceHeader();

    // Render Table Rows
    filterAttendanceTable();

  } catch (err) {
    showToast(err.message, 'error');
  }
}

function setAttendanceDept(deptId) {
  state.currentAttendanceDept = deptId;
  loadAttendanceView();
}

function renderAttendanceHeader() {
  const thead = document.getElementById('attendanceTableHead');
  if (!thead) return;

  let daysHtml = '';
  for (let d = 1; d <= 30; d++) {
    const dayName = NOV_DAY_NAMES[d] || '';
    const isSun = dayName === 'CN';
    daysHtml += `
      <th class="p-1 text-center w-8 min-w-[32px] ${isSun ? 'bg-slate-200/90 text-rose-600' : ''}">
        <span class="block text-[10px] ${isSun ? 'font-extrabold text-rose-600' : 'text-slate-400'}">${dayName}</span>
        <span class="block text-xs font-bold leading-none mt-0.5">${d}</span>
      </th>
    `;
  }

  thead.innerHTML = `
    <tr>
      <th class="p-3 w-20 sticky left-0 bg-slate-100 z-30 border-r border-slate-200">Mã NV</th>
      <th class="p-3 w-48 sticky left-20 bg-slate-100 z-30 border-r border-slate-200">Họ và tên</th>
      ${daysHtml}
      <th class="p-2 text-center w-16 bg-slate-100 text-brand-700 font-bold border-l border-slate-200">Công TT</th>
      <th class="p-2 text-center w-14 bg-slate-100 text-blue-700 font-bold">Phép</th>
      <th class="p-2 text-center w-14 bg-slate-100 text-rose-700 font-bold">KL</th>
      <th class="p-2 text-center w-14 bg-slate-100 text-amber-700 font-bold">Muộn</th>
      <th class="p-2 text-center w-14 bg-slate-100 text-indigo-700 font-bold">OT (h)</th>
    </tr>
  `;
}

function filterAttendanceTable() {
  const tbody = document.getElementById('attendanceTableBody');
  if (!tbody || !state.attendanceList) return;

  const search = (document.getElementById('attendanceSearchInput')?.value || '').trim().toLowerCase();

  const filtered = state.attendanceList.filter(a => {
    if (search) {
      const matchName = (a.employeeName || '').toLowerCase().includes(search);
      const matchCode = (a.employeeCode || '').toLowerCase().includes(search);
      if (!matchName && !matchCode) return false;
    }
    return true;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="37" class="p-8 text-center text-slate-400">
          <i data-lucide="calendar-x" class="w-8 h-8 mx-auto mb-2 text-slate-300"></i>
          Không tìm thấy dữ liệu chấm công cho phòng ban này.
        </td>
      </tr>
    `;
    lucide.createIcons();
    return;
  }

  tbody.innerHTML = filtered.map(a => {
    let dayCells = '';
    for (let d = 1; d <= 30; d++) {
      const val = (a.days && a.days[d]) ? a.days[d] : '—';
      const dayName = NOV_DAY_NAMES[d] || '';
      const isSun = dayName === 'CN';

      let cellBadge = '';
      if (isSun) {
        cellBadge = `<span class="w-6 h-6 rounded bg-slate-100 text-slate-400 font-medium flex items-center justify-center text-[10px] select-none">CN</span>`;
      } else if (val === '1' || val === 'X') {
        cellBadge = `<button onclick="cycleAttendanceCell('${a.employeeCode}', ${d}, '${val}')" class="w-6 h-6 rounded bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center text-[11px] hover:ring-2 hover:ring-emerald-400 transition" title="Đủ công (Click để đổi)">1</button>`;
      } else if (val === '0.5' || val === '½') {
        cellBadge = `<button onclick="cycleAttendanceCell('${a.employeeCode}', ${d}, '${val}')" class="w-6 h-6 rounded bg-amber-100 text-amber-800 font-bold flex items-center justify-center text-[11px] hover:ring-2 hover:ring-amber-400 transition" title="Nửa ngày (Click để đổi)">½</button>`;
      } else if (val === 'P') {
        cellBadge = `<button onclick="cycleAttendanceCell('${a.employeeCode}', ${d}, '${val}')" class="w-6 h-6 rounded bg-blue-100 text-blue-800 font-bold flex items-center justify-center text-[11px] hover:ring-2 hover:ring-blue-400 transition" title="Nghỉ phép năm (Click để đổi)">P</button>`;
      } else if (val === 'KL' || val === 'KP') {
        cellBadge = `<button onclick="cycleAttendanceCell('${a.employeeCode}', ${d}, '${val}')" class="w-6 h-6 rounded bg-rose-100 text-rose-800 font-bold flex items-center justify-center text-[11px] hover:ring-2 hover:ring-rose-400 transition" title="Nghỉ không lương (Click để đổi)">KL</button>`;
      } else if (val === 'M' || val === 'V') {
        cellBadge = `<button onclick="cycleAttendanceCell('${a.employeeCode}', ${d}, '${val}')" class="w-6 h-6 rounded bg-orange-100 text-orange-800 font-bold flex items-center justify-center text-[11px] hover:ring-2 hover:ring-orange-400 transition" title="Đi muộn/Về sớm (Click để đổi)">M</button>`;
      } else {
        cellBadge = `<button onclick="cycleAttendanceCell('${a.employeeCode}', ${d}, '${val}')" class="w-6 h-6 rounded bg-slate-50 text-slate-400 flex items-center justify-center text-[10px] hover:bg-slate-200 transition">·</button>`;
      }

      dayCells += `<td class="p-1 text-center ${isSun ? 'bg-slate-50/70' : ''}">${cellBadge}</td>`;
    }

    return `
      <tr class="hover:bg-slate-50/80 transition">
        <td class="p-2.5 font-mono text-xs font-semibold text-slate-700 sticky left-0 bg-white border-r border-slate-200 z-10">${a.employeeCode}</td>
        <td class="p-2.5 sticky left-20 bg-white border-r border-slate-200 z-10 whitespace-nowrap">
          <p class="font-bold text-slate-900 text-xs">${a.employeeName}</p>
          <p class="text-[10px] text-slate-400">${a.positionName || a.departmentName}</p>
        </td>
        ${dayCells}
        <td class="p-2 text-center font-bold text-brand-600 bg-brand-50/40 border-l border-slate-200 text-xs">${a.totalWorkDays}</td>
        <td class="p-2 text-center text-xs font-medium text-blue-600">${a.leaveDays || '—'}</td>
        <td class="p-2 text-center text-xs font-medium text-rose-600">${a.unpaidDays || '—'}</td>
        <td class="p-2 text-center text-xs font-medium text-amber-600">${a.lateDays || '—'}</td>
        <td class="p-2 text-center text-xs font-semibold text-indigo-600">${a.otHours ? `${a.otHours}h` : '—'}</td>
      </tr>
    `;
  }).join('');
}

async function cycleAttendanceCell(empCode, day, currentVal) {
  // Cycle: '1' -> '0.5' -> 'P' -> 'KL' -> 'M' -> '1'
  let nextVal = '1';
  if (currentVal === '1' || currentVal === 'X') nextVal = '0.5';
  else if (currentVal === '0.5' || currentVal === '½') nextVal = 'P';
  else if (currentVal === 'P') nextVal = 'KL';
  else if (currentVal === 'KL' || currentVal === 'KP') nextVal = 'M';
  else if (currentVal === 'M' || currentVal === 'V') nextVal = '1';

  const month = document.getElementById('attendanceMonthSelect')?.value || '11/2026';

  try {
    const res = await fetch('/api/attendance/update-day', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ employeeCode: empCode, month, day, status: nextVal })
    });
    if (!res.ok) throw new Error('Không thể cập nhật ngày công');
    
    // Update local record
    const target = state.attendanceList.find(a => a.employeeCode === empCode);
    if (target) {
      target.days[day] = nextVal;
    }
    filterAttendanceTable();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function autoFillCurrentDeptAttendance() {
  const deptId = state.currentAttendanceDept || 'all';
  const month = document.getElementById('attendanceMonthSelect')?.value || '11/2026';

  if (!confirm(`Bạn có chắc chắn muốn chấm công chuẩn (1 công) cho toàn bộ nhân viên thuộc bộ lọc này không?`)) {
    return;
  }

  try {
    const res = await fetch('/api/attendance/auto-fill-dept', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ departmentId: deptId, month, status: '1' })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Lỗi khi chấm công hàng loạt');
    showToast(data.message, 'success');
    await loadAttendanceView();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function exportAttendanceExcel() {
  const month = document.getElementById('attendanceMonthSelect')?.value || '11/2026';
  const deptId = state.currentAttendanceDept || 'all';
  window.open(`/api/attendance/export-excel?month=${encodeURIComponent(month)}&departmentId=${deptId}`, '_blank');
}

// -------------------------------------------------------------
// 18. PAYROLL VIEW (TÍNH LƯƠNG & XUẤT PHIẾU LƯƠNG)
// -------------------------------------------------------------
state.payrollList = [];

async function loadPayrollView() {
  const monthSelect = document.getElementById('payrollMonthSelect');
  const month = monthSelect ? monthSelect.value : '11/2026';

  try {
    const res = await fetch(`/api/payroll?month=${month}`);
    if (!res.ok) throw new Error('Không thể tải bảng tính lương');
    const data = await res.json();
    state.payrollList = data.payroll;

    // Populate department filter
    const deptSelect = document.getElementById('payrollDeptSelect');
    if (deptSelect && data.departments) {
      const current = deptSelect.value;
      deptSelect.innerHTML = `<option value="all">Tất cả phòng ban</option>` +
        data.departments.map(d => `<option value="${d.id}" ${current === d.id ? 'selected' : ''}>${d.name}</option>`).join('');
    }

    // Update Summary KPI Cards
    const s = data.summary;
    const elTotal = document.getElementById('payKpiTotalNet');
    if (elTotal) elTotal.innerText = `${(s.totalNet / 1e9).toFixed(2)} tỷ đ`;
    const elAvg = document.getElementById('payKpiAvgNet');
    if (elAvg) elAvg.innerText = `${(s.avgNetSalary / 1e6).toFixed(1)} tr đ`;
    const elIns = document.getElementById('payKpiInsurance');
    if (elIns) elIns.innerText = `${(s.totalInsurance / 1e6).toFixed(1)} tr đ`;
    const elTax = document.getElementById('payKpiTax');
    if (elTax) elTax.innerText = `${(s.totalTax / 1e6).toFixed(1)} tr đ`;

    filterPayrollTable();

  } catch (err) {
    showToast(err.message, 'error');
  }
}

function filterPayrollTable() {
  const tbody = document.getElementById('payrollTableBody');
  if (!tbody || !state.payrollList) return;

  const branch = document.getElementById('payrollBranchSelect')?.value || 'all';
  const dept = document.getElementById('payrollDeptSelect')?.value || 'all';
  const search = (document.getElementById('payrollSearchInput')?.value || '').trim().toLowerCase();

  const filtered = state.payrollList.filter(p => {
    if (branch !== 'all' && p.branchId !== branch) return false;
    if (dept !== 'all' && p.departmentId !== dept) return false;
    if (search) {
      const matchName = (p.employeeName || '').toLowerCase().includes(search);
      const matchCode = (p.employeeCode || '').toLowerCase().includes(search);
      if (!matchName && !matchCode) return false;
    }
    return true;
  });

  const countBadge = document.getElementById('payrollCountBadge');
  if (countBadge) countBadge.innerText = `${filtered.length} / ${state.payrollList.length}`;

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="12" class="p-8 text-center text-slate-400">
          <i data-lucide="banknote" class="w-8 h-8 mx-auto mb-2 text-slate-300"></i>
          Không tìm thấy nhân viên nào phù hợp trong bảng lương.
        </td>
      </tr>
    `;
    lucide.createIcons();
    return;
  }

  tbody.innerHTML = filtered.map(p => `
    <tr class="hover:bg-slate-50/80 transition">
      <td class="p-3.5">
        <div class="flex items-center gap-2.5">
          <div class="w-8 h-8 rounded-full bg-brand-600 text-white font-bold text-xs flex items-center justify-center flex-shrink-0">
            ${p.employeeName.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <p class="font-bold text-slate-900">${p.employeeName}</p>
            <p class="text-[11px] text-slate-400 font-mono">${p.employeeCode} • ${p.positionName}</p>
          </div>
        </div>
      </td>
      <td class="p-3.5 text-xs text-slate-600">
        <div class="font-medium text-slate-800">${p.departmentName}</div>
        <div class="text-[11px] text-slate-400">${p.branchName}</div>
      </td>
      <td class="p-3.5 text-right font-medium text-slate-700 text-xs">${formatVND(p.baseSalary)}</td>
      <td class="p-3.5 text-center">
        <span class="px-2 py-0.5 rounded-full text-xs font-bold ${p.actualWorkDays >= 26 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}">
          ${p.actualWorkDays} / ${p.standardDays}
        </span>
      </td>
      <td class="p-3.5 text-right text-xs font-semibold text-slate-800">${formatVND(p.calculatedSalary)}</td>
      <td class="p-3.5 text-right text-xs text-slate-600">
        <div>${formatVND(p.allowance)}</div>
        ${p.bonus ? `<div class="text-[10px] text-emerald-600 font-semibold">+${formatVND(p.bonus)}</div>` : ''}
      </td>
      <td class="p-3.5 text-right text-xs font-bold text-slate-900">${formatVND(p.grossSalary)}</td>
      <td class="p-3.5 text-right text-xs text-rose-600">-${formatVND(p.totalInsurance)}</td>
      <td class="p-3.5 text-right text-xs text-slate-600">-${formatVND((p.tax || 0) + (p.penalties || 0))}</td>
      <td class="p-3.5 text-right text-sm font-extrabold text-emerald-600 whitespace-nowrap bg-emerald-50/50">
        ${formatVND(p.netSalary)}
      </td>
      <td class="p-3.5 text-center">
        <span class="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
          <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> ${p.statusLabel || 'Đã duyệt'}
        </span>
      </td>
      <td class="p-3.5 text-center whitespace-nowrap">
        <button onclick="openPayslipModal('${p.employeeCode}')" class="px-3 py-1.5 bg-brand-50 hover:bg-brand-100 text-brand-700 border border-brand-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 mx-auto transition">
          <i data-lucide="receipt" class="w-3.5 h-3.5 text-brand-600"></i>
          <span>Phiếu lương</span>
        </button>
      </td>
    </tr>
  `).join('');

  lucide.createIcons();
}

async function recalculatePayroll() {
  const month = document.getElementById('payrollMonthSelect')?.value || '11/2026';
  try {
    const res = await fetch('/api/payroll/calculate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ month })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Lỗi khi tính lại bảng lương');
    showToast(data.message, 'success');
    await loadPayrollView();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function exportPayrollExcel() {
  const month = document.getElementById('payrollMonthSelect')?.value || '11/2026';
  const dept = document.getElementById('payrollDeptSelect')?.value || 'all';
  window.open(`/api/payroll/export-excel?month=${encodeURIComponent(month)}&departmentId=${dept}`, '_blank');
}

// -------------------------------------------------------------
// 19. PAYSLIP MODAL CONTROLLER (XUẤT & IN PHIẾU LƯƠNG CHUẨN)
// -------------------------------------------------------------
async function openPayslipModal(empCode) {
  const month = document.getElementById('payrollMonthSelect')?.value || '11/2026';
  try {
    const res = await fetch(`/api/payroll/payslip/${empCode}?month=${encodeURIComponent(month)}`);
    if (!res.ok) throw new Error('Không thể tải phiếu báo lương');
    const p = await res.json();

    const container = document.getElementById('printablePayslipContent');
    if (!container) return;

    container.innerHTML = `
      <div class="space-y-6">
        <!-- Letterhead & Company Header -->
        <div class="flex flex-col sm:flex-row sm:items-start justify-between border-b-2 border-slate-900 pb-4 gap-3">
          <div class="flex items-center gap-3">
            <div class="w-12 h-12 rounded-xl bg-brand-600 text-white flex items-center justify-center font-bold shadow-md">
              <i data-lucide="layers" class="w-6 h-6"></i>
            </div>
            <div>
              <h2 class="text-sm font-extrabold uppercase tracking-wide text-slate-900">${p.company.name}</h2>
              <p class="text-[11px] text-slate-500">${p.company.address}</p>
              <p class="text-[11px] text-slate-500">MST: <span class="font-mono font-semibold">${p.company.taxCode}</span> • ĐT: ${p.company.phone}</p>
            </div>
          </div>
          <div class="sm:text-right">
            <span class="inline-block px-2.5 py-1 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-lg uppercase">
              ${p.summary.status}
            </span>
            <p class="text-[11px] text-slate-400 mt-1 font-mono">Mã phiếu: PL-${p.employee.code}-${p.date.replace(/\//g, '')}</p>
          </div>
        </div>

        <!-- Payslip Title -->
        <div class="text-center py-2">
          <h1 class="text-xl sm:text-2xl font-black text-slate-900 uppercase tracking-tight">${p.title}</h1>
          <p class="text-xs text-slate-500 mt-0.5">Kỳ tính lương từ ngày 01/11/2026 đến ngày 30/11/2026</p>
        </div>

        <!-- Employee Info Grid Card -->
        <div class="bg-slate-50 rounded-2xl p-4 border border-slate-200 text-xs grid grid-cols-2 sm:grid-cols-4 gap-3.5">
          <div>
            <p class="text-slate-400 text-[11px]">Mã nhân viên:</p>
            <p class="font-bold text-slate-900 font-mono text-sm">${p.employee.code}</p>
          </div>
          <div>
            <p class="text-slate-400 text-[11px]">Họ và tên:</p>
            <p class="font-bold text-slate-900 text-sm">${p.employee.name}</p>
          </div>
          <div>
            <p class="text-slate-400 text-[11px]">Phòng ban:</p>
            <p class="font-semibold text-slate-800">${p.employee.department}</p>
          </div>
          <div>
            <p class="text-slate-400 text-[11px]">Chức vụ:</p>
            <p class="font-semibold text-slate-800">${p.employee.position}</p>
          </div>
          <div>
            <p class="text-slate-400 text-[11px]">Chi nhánh:</p>
            <p class="font-medium text-slate-700">${p.employee.branch}</p>
          </div>
          <div>
            <p class="text-slate-400 text-[11px]">Số tài khoản nhận:</p>
            <p class="font-mono font-bold text-slate-900">${p.employee.bankAccount}</p>
          </div>
          <div>
            <p class="text-slate-400 text-[11px]">Ngân hàng:</p>
            <p class="font-medium text-slate-700">${p.employee.bankName}</p>
          </div>
          <div>
            <p class="text-slate-400 text-[11px]">Ngày chuyển lương:</p>
            <p class="font-medium text-emerald-700">${p.summary.paymentDate}</p>
          </div>
        </div>

        <!-- Detailed Earnings & Deductions Tables -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <!-- Column 1: Thu nhập -->
          <div class="border border-slate-200 rounded-2xl overflow-hidden">
            <div class="bg-emerald-50/80 px-4 py-2.5 border-b border-emerald-100 flex items-center justify-between">
              <h4 class="font-bold text-emerald-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
                <i data-lucide="plus-circle" class="w-4 h-4 text-emerald-600"></i>
                I. CÁC KHOẢN THU NHẬP (A)
              </h4>
            </div>
            <table class="w-full text-xs">
              <tbody class="divide-y divide-slate-100">
                <tr>
                  <td class="p-2.5 text-slate-600">1. Lương cơ bản theo hợp đồng</td>
                  <td class="p-2.5 text-right font-medium text-slate-900">${formatVND(p.earnings.baseSalary)}</td>
                </tr>
                <tr>
                  <td class="p-2.5 text-slate-600">2. Ngày công chuẩn trong tháng</td>
                  <td class="p-2.5 text-right font-medium text-slate-900">${p.work.standardDays} ngày</td>
                </tr>
                <tr>
                  <td class="p-2.5 text-slate-600">3. Ngày công làm việc thực tế</td>
                  <td class="p-2.5 text-right font-bold text-brand-600">${p.work.actualWorkDays} ngày</td>
                </tr>
                <tr class="bg-slate-50/50">
                  <td class="p-2.5 text-slate-800 font-medium">➔ Lương theo công thực tế</td>
                  <td class="p-2.5 text-right font-bold text-slate-900">${formatVND(p.earnings.calculatedSalary)}</td>
                </tr>
                <tr>
                  <td class="p-2.5 text-slate-600">4. Phụ cấp (Ăn trưa, xăng xe, ĐT)</td>
                  <td class="p-2.5 text-right font-medium text-slate-900">${formatVND(p.earnings.allowance)}</td>
                </tr>
                <tr>
                  <td class="p-2.5 text-slate-600">5. Lương làm thêm giờ (${p.work.otHours}h OT)</td>
                  <td class="p-2.5 text-right font-medium text-slate-900">${formatVND(p.earnings.otSalary)}</td>
                </tr>
                <tr>
                  <td class="p-2.5 text-slate-600">6. Thưởng hiệu quả / KPI</td>
                  <td class="p-2.5 text-right font-medium text-emerald-600">+${formatVND(p.earnings.bonus)}</td>
                </tr>
                <tr class="bg-emerald-50/60 font-bold border-t border-emerald-200">
                  <td class="p-2.5 text-emerald-950">TỔNG THU NHẬP GROSS (I)</td>
                  <td class="p-2.5 text-right text-emerald-700 text-sm">${formatVND(p.earnings.grossSalary)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Column 2: Khấu trừ -->
          <div class="border border-slate-200 rounded-2xl overflow-hidden">
            <div class="bg-rose-50/80 px-4 py-2.5 border-b border-rose-100 flex items-center justify-between">
              <h4 class="font-bold text-rose-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
                <i data-lucide="minus-circle" class="w-4 h-4 text-rose-600"></i>
                II. CÁC KHOẢN KHẤU TRỪ (B)
              </h4>
            </div>
            <table class="w-full text-xs">
              <tbody class="divide-y divide-slate-100">
                <tr>
                  <td class="p-2.5 text-slate-600">1. Bảo hiểm Xã hội (BHXH 8%)</td>
                  <td class="p-2.5 text-right font-medium text-rose-600">-${formatVND(p.deductions.bhxh)}</td>
                </tr>
                <tr>
                  <td class="p-2.5 text-slate-600">2. Bảo hiểm Y tế (BHYT 1.5%)</td>
                  <td class="p-2.5 text-right font-medium text-rose-600">-${formatVND(p.deductions.bhyt)}</td>
                </tr>
                <tr>
                  <td class="p-2.5 text-slate-600">3. Bảo hiểm Thất nghiệp (BHTN 1%)</td>
                  <td class="p-2.5 text-right font-medium text-rose-600">-${formatVND(p.deductions.bhtn)}</td>
                </tr>
                <tr class="bg-slate-50/50">
                  <td class="p-2.5 text-slate-800 font-medium">➔ Tổng trích nộp BH (10.5%)</td>
                  <td class="p-2.5 text-right font-bold text-rose-600">-${formatVND(p.deductions.totalInsurance)}</td>
                </tr>
                <tr>
                  <td class="p-2.5 text-slate-600">4. Thuế Thu nhập cá nhân (TNCN)</td>
                  <td class="p-2.5 text-right font-medium text-rose-600">-${formatVND(p.deductions.tax)}</td>
                </tr>
                <tr>
                  <td class="p-2.5 text-slate-600">5. Phạt đi muộn / Vi phạm</td>
                  <td class="p-2.5 text-right font-medium text-slate-600">-${formatVND(p.deductions.penalties)}</td>
                </tr>
                <tr>
                  <td class="p-2.5 text-slate-600">6. Tạm ứng lương trong kỳ</td>
                  <td class="p-2.5 text-right font-medium text-slate-600">-${formatVND(p.deductions.advance)}</td>
                </tr>
                <tr class="bg-rose-50/60 font-bold border-t border-rose-200">
                  <td class="p-2.5 text-rose-950">TỔNG KHẨU TRỪ (II)</td>
                  <td class="p-2.5 text-right text-rose-700 text-sm">-${formatVND(p.deductions.totalDeductions)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Net Salary Grand Total Callout Box -->
        <div class="bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-2xl p-5 shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <p class="text-xs font-semibold text-emerald-100 uppercase tracking-wider">THỰC LĨNH CHUYỂN KHOẢN (NET = I - II):</p>
            <h2 class="text-3xl font-black tracking-tight mt-1 text-white">${formatVND(p.summary.netSalary)}</h2>
            <p class="text-xs text-emerald-100 italic mt-1 font-medium">Bằng chữ: ${p.summary.amountInWords}</p>
          </div>
          <div class="text-right border-t sm:border-t-0 sm:border-l border-emerald-400/40 pt-2 sm:pt-0 sm:pl-5">
            <span class="text-xs text-emerald-100">Hình thức thanh toán:</span>
            <p class="font-bold text-sm">Chuyển khoản 24/7</p>
            <p class="text-[11px] text-emerald-200">Ngân hàng ${p.employee.bankName}</p>
          </div>
        </div>

        <!-- Signatures & Official Stamp Section -->
        <div class="pt-6 border-t border-slate-200 grid grid-cols-3 text-center text-xs gap-4 relative">
          <div>
            <p class="font-bold text-slate-800 uppercase tracking-wider">Người lập biểu</p>
            <p class="text-[11px] text-slate-400 italic mb-12">(Ký, ghi rõ họ tên)</p>
            <p class="font-bold text-slate-900">Kế toán tiền lương</p>
          </div>

          <div>
            <p class="font-bold text-slate-800 uppercase tracking-wider">Kế toán trưởng</p>
            <p class="text-[11px] text-slate-400 italic mb-12">(Ký, ghi rõ họ tên)</p>
            <p class="font-bold text-slate-900">Phạm Thị Thu Hà</p>
          </div>

          <div class="relative">
            <p class="font-bold text-slate-800 uppercase tracking-wider">Giám đốc duyệt chi</p>
            <p class="text-[11px] text-slate-400 italic mb-12">(Ký, đóng dấu)</p>
            
            <!-- Red Official Digital Stamp Badge -->
            <div class="absolute left-1/2 -translate-x-1/2 top-7 w-28 h-28 border-2 border-red-600/80 rounded-full flex flex-col items-center justify-center p-1 text-[9px] font-black text-red-600 uppercase tracking-tighter opacity-85 rotate-[-12deg] pointer-events-none select-none">
              <span class="text-[8px] text-center leading-tight">CÔNG TY CỔ PHẦN</span>
              <span class="text-[9px] font-black">TẬP ĐOÀN ASIN</span>
              <span class="w-8 h-0.5 bg-red-600 my-0.5"></span>
              <span class="text-[10px] text-red-700 font-extrabold">ĐÃ DUYỆT CHI</span>
              <span class="text-[7px]">★ ★ ★</span>
            </div>

            <p class="font-bold text-slate-900">Ngô Mai Trang</p>
          </div>
        </div>

        <!-- Note footer -->
        <div class="text-[10px] text-slate-400 border-t border-slate-100 pt-3 text-center italic">
          Mọi thắc mắc về phiếu lương, vui lòng liên hệ Phòng Tài chính - Kế toán trong vòng 03 ngày làm việc kể từ ngày nhận phiếu.
        </div>
      </div>
    `;

    openModal('modalPayslip');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function printPayslipDocument() {
  window.print();
}
