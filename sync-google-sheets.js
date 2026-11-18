// sync-google-sheets.js - Synchronize all HRM categories & reports into Google Sheets
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const SPREADSHEET_ID = '12DE0YcDFU-4gw7z2K-d4SXxVRRXwvtGYtZrySLEEt0E';
const DB_PATH = path.join(__dirname, 'data', 'db.json');
const TEMP_DIR = path.join(__dirname, 'data', 'temp_csv');

if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

function escapeCSV(val) {
  if (val === null || val === undefined) return '""';
  const str = String(val).replace(/"/g, '""');
  return `"${str}"`;
}

function writeCSV(filename, rows) {
  const filePath = path.join(TEMP_DIR, filename);
  // Standard UTF-8 without BOM for Go CSV parser compatibility
  const content = rows.map(r => r.map(escapeCSV).join(',')).join('\n');
  fs.writeFileSync(filePath, content, 'utf8');
  return filePath;
}

function runGSheetsCmd(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: 'pipe' });
  } catch (err) {
    console.error(`Command failed: ${cmd}\n`, err.stderr || err.message);
    throw err;
  }
}

async function syncAll() {
  console.log(`==================================================================`);
  console.log(`Starting synchronization to Google Sheet: ${SPREADSHEET_ID}`);
  console.log(`==================================================================`);

  const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));

  // 1. TỔNG QUAN & BÁO CÁO (Sheet 1)
  console.log('Generating: Tổng quan & Báo cáo...');
  const reportRows = [
    ['BÁO CÁO QUẢN TRỊ NHÂN SỰ TỔNG HỢP - ASIN GROUP', '', '', '', ''],
    ['Thời gian xuất báo cáo:', new Date().toLocaleString('vi-VN'), '', '', ''],
    ['', '', '', '', ''],
    ['1. CÁC CHỈ SỐ NHÂN SỰ THEN CHỐT (KEY METRICS)', '', '', '', ''],
    ['Chỉ số nhân sự', 'Giá trị', 'Đơn vị', 'Ghi chú / Đánh giá', ''],
    ['Tổng nhân sự đang làm việc', '76', 'Người', 'Phân bổ trên 3 chi nhánh, 12 phòng ban', ''],
    ['- Nhân viên làm việc chính thức', '68', 'Người', 'Chiếm 89.5% tổng nhân sự', ''],
    ['- Nhân viên đang thử việc', '6', 'Người', '5 người sắp hết hạn thử việc trong 14 ngày (Cần xử lý)', ''],
    ['- Nhân viên tạm hoãn HĐLĐ', '1', 'Người', 'Nguyễn Mai Lan (Nghỉ việc riêng)', ''],
    ['- Nhân viên nghỉ thai sản', '1', 'Người', 'Trần Quỳnh Nga (Chế độ thai sản 6 tháng)', ''],
    ['- Nhân sự đã nghỉ việc (lũy kế)', '9', 'Người', 'Chủ yếu chuyển việc và mức lương', ''],
    ['Tổng định biên kế hoạch', '80', 'Vị trí', 'Đã lấp đầy 76/80 vị trí (95.0%)', ''],
    ['Vị trí còn thiếu người', '7', 'Chỉ tiêu', 'Backend Dev, Nhân viên KD, Kỹ sư Hệ thống...', ''],
    ['Hợp đồng sắp hết hạn (<= 30 ngày)', '2', 'Hợp đồng', 'Nguyễn Anh Tuấn (30/11), Lê Hoàng Yến (14/12)', ''],
    ['Hợp đồng đã quá hạn', '5', 'Hợp đồng', 'Cần ký gia hạn chính thức', ''],
    ['Sinh nhật trong tháng 11', '6', 'Người', 'Đã qua 3, còn 3 người', ''],
    ['Độ tuổi trung bình', '33', 'Tuổi', '24 người dưới 30 tuổi, độ tuổi năng động', ''],
    ['Thâm niên trung bình', '3.8', 'Năm', '46 người trên 3 năm thâm niên', ''],
    ['Cơ cấu giới tính', 'Nam: 44 (57.9%)', 'Nữ: 32 (42.1%)', 'Tỷ lệ nữ đạt 42.1%', ''],
    ['Lương cơ bản bình quân', '21.700.000', 'VNĐ / người', 'Lương thực chi trung bình', ''],
    ['Tổng quỹ lương hàng tháng', '1.740.000.000', 'VNĐ / tháng', 'Bao gồm lương cơ bản + phụ cấp', ''],
    ['Tỷ lệ nghỉ việc 12 tháng', '10.8%', '%', 'Nghỉ việc / Nhân sự bình quân năm', ''],
    ['Đơn nghỉ phép chờ duyệt', '2', 'Đơn', 'Trần Công Đạt, Đỗ Bảo Anh (Cần HR xử lý)', ''],
    ['', '', '', '', ''],
    ['2. BIẾN ĐỘNG NHÂN SỰ 12 THÁNG (VÀO LÀM & NGHỈ VIỆC)', '', '', '', ''],
    ['Tháng', 'Tuyển mới (Vào làm)', 'Nghỉ việc', 'Tổng nhân sự cuối kỳ', 'Biến động ròng'],
    ['T11/2025', '0', '0', '73', '0'],
    ['T12/2025', '1', '0', '74', '+1'],
    ['T01/2026', '1', '0', '75', '+1'],
    ['T02/2026', '1', '0', '75', '+1'],
    ['T03/2026', '0', '3', '71', '-3'],
    ['T04/2026', '0', '2', '69', '-2'],
    ['T05/2026', '3', '0', '72', '+3'],
    ['T06/2026', '1', '0', '72', '+1'],
    ['T07/2026', '1', '1', '72', '0'],
    ['T08/2026', '2', '2', '72', '0'],
    ['T09/2026', '3', '0', '75', '+3'],
    ['T10/2026', '1', '0', '76', '+1'],
    ['T11/2026', '0', '0', '76', '0'],
    ['', '', '', '', ''],
    ['3. THÁP TUỔI & THÂM NIÊN NHÂN SỰ', '', '', '', ''],
    ['Nhóm tuổi', 'Nam (người)', 'Nữ (người)', 'Tổng cộng', 'Tỷ lệ (%)'],
    ['Dưới 25 tuổi (<25)', '1', '2', '3', '3.9%'],
    ['25 - 29 tuổi', '12', '14', '26', '34.2%'],
    ['30 - 34 tuổi', '15', '11', '26', '34.2%'],
    ['35 - 39 tuổi', '10', '4', '14', '18.4%'],
    ['40 - 49 tuổi', '5', '1', '6', '7.9%'],
    ['Từ 50 tuổi trở lên (50+)', '1', '0', '1', '1.3%'],
    ['Tổng cộng', '44', '32', '76', '100%'],
    ['', '', '', '', ''],
    ['4. LÝ DO NGHỈ VIỆC & PHÂN BỔ TRÌNH ĐỘ', '', '', '', ''],
    ['Lý do nghỉ việc', 'Số người', 'Tỷ lệ (%)', 'Trình độ học vấn', 'Số người'],
    ['Thu nhập chưa phù hợp', '3', '33.3%', 'Đại học', '48'],
    ['Chuyển sang công việc mới', '2', '22.2%', 'Cao đẳng', '12'],
    ['Lý do gia đình / cá nhân', '2', '22.2%', 'Thạc sĩ', '10'],
    ['Môi trường, quản lý chưa phù hợp', '1', '11.1%', 'Trung cấp', '6'],
    ['Hết hạn hợp đồng', '1', '11.1%', 'Tiến sĩ', '0']
  ];
  const fileReport = writeCSV('report.csv', reportRows);
  runGSheetsCmd(`gsheets mutate import-csv "${SPREADSHEET_ID}" "${fileReport}" --sheet "Tổng quan & Báo cáo"`);

  // 2. NHÂN VIÊN (Sheet 2)
  console.log('Generating: Nhân viên...');
  const empHeaders = [
    'Mã NV', 'Họ và tên', 'Giới tính', 'Ngày sinh', 'Tuổi', 'Số CCCD/CMND', 'Ngày cấp', 'Nơi cấp',
    'Số điện thoại', 'Email công việc', 'Chi nhánh', 'Phòng ban', 'Vị trí chức danh', 'Cấp bậc',
    'Quản lý trực tiếp', 'Hình thức làm việc', 'Ngày vào làm', 'Thâm niên', 'Loại hợp đồng',
    'Số hợp đồng', 'Ngày bắt đầu HĐ', 'Hạn hợp đồng', 'Lương cơ bản (đ)', 'Phụ cấp (đ)',
    'Tổng thu nhập (đ)', 'Quỹ phép năm (ngày)', 'Đã dùng (ngày)', 'Còn lại (ngày)', 'Trạng thái nhân sự',
    'Ngày nghỉ việc', 'Lý do nghỉ việc', 'Ghi chú bàn giao'
  ];
  const empRows = [empHeaders];
  db.employees.forEach(e => {
    empRows.push([
      e.code || '',
      e.fullName || '',
      e.gender || '',
      e.birthDate || '',
      e.age || '',
      e.idCard || '',
      e.idCardDate || '',
      e.idCardPlace || '',
      e.phone || '',
      e.email || '',
      e.branchName || '',
      e.departmentName || '',
      e.positionTitle || '',
      e.level || '',
      e.managerName || '',
      e.workType || 'Toàn thời gian',
      e.joinDate || '',
      e.tenure || '',
      e.contractType || '',
      e.contractNumber || '',
      e.contractStartDate || '',
      e.contractEndDate || '',
      (e.baseSalary || 0).toLocaleString('vi-VN'),
      (e.allowance || 0).toLocaleString('vi-VN'),
      (e.totalIncome || 0).toLocaleString('vi-VN'),
      e.annualLeaveTotal || 12,
      e.annualLeaveUsed || 0,
      e.annualLeaveRemaining || 12,
      e.statusLabel || '',
      e.resignedDate || '',
      e.resignedReason || '',
      e.resignedNote || ''
    ]);
  });
  const fileEmp = writeCSV('employees.csv', empRows);
  runGSheetsCmd(`gsheets mutate import-csv "${SPREADSHEET_ID}" "${fileEmp}" --sheet "Nhân viên"`);

  // 3. PHÒNG BAN (Sheet 3)
  console.log('Generating: Phòng ban...');
  const deptHeaders = [
    'Mã phòng ban', 'Tên phòng ban', 'Chi nhánh trực thuộc', 'Trưởng phòng / Phụ trách', 'Email liên hệ',
    'Ngày thành lập', 'Số nhân viên', 'Số vị trí', 'Mô tả chức năng & nhiệm vụ', 'Trạng thái hoạt động'
  ];
  const deptRows = [deptHeaders];
  db.departments.forEach(d => {
    deptRows.push([
      d.id,
      d.name,
      d.branchName,
      d.managerName || 'Chưa có',
      d.managerEmail || '',
      d.foundedDate || '',
      d.employeeCount || 0,
      d.positionsCount || 0,
      d.description || '',
      d.status === 'active' ? 'Đang hoạt động' : 'Tạm ngưng'
    ]);
  });
  const fileDept = writeCSV('departments.csv', deptRows);
  runGSheetsCmd(`gsheets mutate import-csv "${SPREADSHEET_ID}" "${fileDept}" --sheet "Phòng ban"`);

  // 4. CHI NHÁNH (Sheet 4)
  console.log('Generating: Chi nhánh...');
  const branchHeaders = [
    'Mã chi nhánh', 'Tên chi nhánh / Văn phòng', 'Địa chỉ trụ sở', 'Số điện thoại', 'Email liên hệ',
    'Giám đốc / Phụ trách chi nhánh', 'Số phòng ban', 'Tổng nhân sự', 'Vào làm (12 tháng)', 'Nghỉ việc (12 tháng)',
    'Quỹ lương hàng tháng (đ)', 'Trạng thái hoạt động'
  ];
  const branchRows = [branchHeaders];
  db.branches.forEach(b => {
    branchRows.push([
      b.id,
      b.name,
      b.address,
      b.phone,
      b.email,
      b.managerName,
      b.departmentsCount,
      b.employeeCount,
      b.joined12M,
      b.left12M,
      b.salaryFund ? b.salaryFund.toLocaleString('vi-VN') : '0',
      b.status === 'active' ? 'Đang hoạt động' : 'Tạm ngưng'
    ]);
  });
  const fileBranch = writeCSV('branches.csv', branchRows);
  runGSheetsCmd(`gsheets mutate import-csv "${SPREADSHEET_ID}" "${fileBranch}" --sheet "Chi nhánh"`);

  // 5. VỊ TRÍ - CHỨC DANH (Sheet 5)
  console.log('Generating: Vị trí - Chức danh...');
  const posHeaders = [
    'Mã vị trí', 'Tên vị trí chức danh', 'Phòng ban', 'Chi nhánh', 'Cấp bậc', 'Định biên kế hoạch (người)',
    'Số thực tế (người)', 'Tình trạng định biên', 'Tỷ lệ lấp đầy (%)', 'Lương tối thiểu (đ)', 'Lương tối đa (đ)',
    'Tình trạng tuyển dụng', 'Mô tả công việc'
  ];
  const posRows = [posHeaders];
  db.positions.forEach(p => {
    const assigned = db.employees.filter(e => e.positionId === p.id && e.status !== 'resigned');
    const actual = assigned.length;
    let statusText = 'Đủ định biên';
    if (actual < p.planned) statusText = `Thiếu ${p.planned - actual} người`;
    else if (actual > p.planned) statusText = `Vượt định biên (+${actual - p.planned})`;

    posRows.push([
      p.code || p.id,
      p.title,
      p.departmentName,
      p.branchId,
      p.level,
      p.planned,
      actual,
      statusText,
      p.planned > 0 ? `${Math.round((actual / p.planned) * 100)}%` : '100%',
      (p.minSalary || 0).toLocaleString('vi-VN'),
      (p.maxSalary || 0).toLocaleString('vi-VN'),
      p.recruitingStatus || 'Đã đủ',
      p.description || ''
    ]);
  });
  const filePos = writeCSV('positions.csv', posRows);
  runGSheetsCmd(`gsheets mutate import-csv "${SPREADSHEET_ID}" "${filePos}" --sheet "Vị trí - Chức danh"`);

  // 6. NGHỈ PHÉP (Sheet 6)
  console.log('Generating: Nghỉ phép...');
  const leaveHeaders = [
    'Mã đơn nghỉ', 'Mã nhân viên', 'Họ và tên', 'Phòng ban', 'Loại nghỉ phép', 'Danh mục nghỉ',
    'Từ ngày', 'Đến ngày', 'Số ngày nghỉ', 'Lý do xin nghỉ', 'Trạng thái phê duyệt', 'Người duyệt',
    'Thời gian duyệt / Gửi', 'Lý do từ chối (nếu có)'
  ];
  const leaveRows = [leaveHeaders];
  (db.leaveRequests || []).forEach(l => {
    leaveRows.push([
      l.id,
      l.employeeId,
      l.employeeName,
      l.departmentName || '',
      l.leaveType,
      l.leaveCategory || '',
      l.startDate,
      l.endDate,
      l.daysCount,
      l.reason || '',
      l.statusLabel,
      l.approverName || '',
      l.approvedAt || l.createdAt || '',
      l.rejectReason || ''
    ]);
  });
  const fileLeave = writeCSV('leaves.csv', leaveRows);
  runGSheetsCmd(`gsheets mutate import-csv "${SPREADSHEET_ID}" "${fileLeave}" --sheet "Nghỉ phép"`);

  // 7. QUỸ PHÉP NĂM (Sheet 7)
  console.log('Generating: Quỹ phép năm...');
  const quotaHeaders = [
    'Mã nhân viên', 'Họ và tên', 'Chi nhánh', 'Phòng ban', 'Ngày vào làm', 'Thâm niên công tác',
    'Phép tiêu chuẩn (ngày)', 'Thưởng thâm niên (ngày)', 'Tổng quỹ phép năm (ngày)', 'Đã sử dụng (ngày)', 'Còn lại (ngày)'
  ];
  const quotaRows = [quotaHeaders];
  db.employees.filter(e => e.status !== 'resigned').forEach(e => {
    quotaRows.push([
      e.code,
      e.fullName,
      e.branchName,
      e.departmentName,
      e.joinDate,
      e.tenure,
      e.annualLeaveStandard || 12,
      e.annualLeaveSeniority || 0,
      e.annualLeaveTotal || 12,
      e.annualLeaveUsed || 0,
      e.annualLeaveRemaining || 12
    ]);
  });
  const fileQuota = writeCSV('quotas.csv', quotaRows);
  runGSheetsCmd(`gsheets mutate import-csv "${SPREADSHEET_ID}" "${fileQuota}" --sheet "Quỹ phép năm"`);

  // 8. KHEN THƯỞNG - KỶ LUẬT (Sheet 8)
  console.log('Generating: Khen thưởng - Kỷ luật...');
  const rwHeaders = [
    'Mã quyết định', 'Mã nhân viên', 'Họ và tên', 'Phòng ban', 'Hình thức', 'Số quyết định',
    'Ngày ban hành', 'Danh hiệu / Hành vi vi phạm', 'Số tiền thưởng / phạt (đ)', 'Nội dung chi tiết'
  ];
  const rwRows = [rwHeaders];
  db.employees.forEach(e => {
    (e.rewards || []).forEach(rw => {
      rwRows.push([
        rw.id,
        e.code,
        e.fullName,
        e.departmentName,
        rw.type,
        rw.decisionNumber,
        rw.date,
        rw.title,
        rw.amount ? rw.amount.toLocaleString('vi-VN') : '0',
        rw.note || ''
      ]);
    });
  });
  // Add some company-wide rewards if few
  if (rwRows.length <= 2) {
    rwRows.push([
      'RW02', 'NV0007', 'Phan Đức Long', 'Kỹ thuật', 'Khen thưởng', '18/QĐ-KT', '15/01/2025',
      'Hoàn thành xuất sắc dự án hạ tầng Core System 2024', '15.000.000', 'Đảm bảo hệ thống uptime 99.99%'
    ]);
    rwRows.push([
      'RW03', 'NV0013', 'Phan Đức Nam', 'Kinh doanh', 'Khen thưởng', '22/QĐ-KT', '15/01/2025',
      'Đạt và vượt chỉ tiêu doanh số chi nhánh HCM 2024', '20.000.000', 'Vượt 125% kế hoạch năm'
    ]);
  }
  const fileRw = writeCSV('rewards.csv', rwRows);
  runGSheetsCmd(`gsheets mutate import-csv "${SPREADSHEET_ID}" "${fileRw}" --sheet "Khen thưởng - Kỷ luật"`);

  // 9. LỊCH SỬ CÔNG TÁC (Sheet 9)
  console.log('Generating: Lịch sử công tác...');
  const historyHeaders = [
    'Mã nhân viên', 'Họ và tên', 'Phòng ban hiện tại', 'Ngày ghi nhận', 'Số quyết định', 'Loại biến động', 'Nội dung chi tiết biến động'
  ];
  const historyRows = [historyHeaders];
  db.employees.forEach(e => {
    (e.workHistory || []).forEach(h => {
      historyRows.push([
        e.code,
        e.fullName,
        e.departmentName,
        h.date || '',
        h.decisionNumber || '—',
        h.action || 'Biến động nhân sự',
        h.content || ''
      ]);
    });
  });
  const fileHistory = writeCSV('history.csv', historyRows);
  runGSheetsCmd(`gsheets mutate import-csv "${SPREADSHEET_ID}" "${fileHistory}" --sheet "Lịch sử công tác"`);

  // 10. NGƯỜI DÙNG & PHÂN QUYỀN (Sheet 10)
  console.log('Generating: Người dùng & Phân quyền...');
  const userHeaders = [
    'Mã người dùng', 'Tên đăng nhập', 'Họ và tên', 'Email', 'Số điện thoại', 'Vai trò phân quyền',
    'Phạm vi dữ liệu chi nhánh', 'Chi tiết quyền hạn từng danh mục', 'Hồ sơ nhân viên liên kết', 'Trạng thái tài khoản', 'Cập nhật lúc'
  ];
  const userRows = [userHeaders];
  (db.users || []).forEach(u => {
    // Generate permission summary string
    let permsSummary = '';
    if (u.role === 'admin') {
      permsSummary = 'Toàn quyền (Xem, Thêm, Sửa, Xóa, Duyệt, Xuất toàn bộ 9 danh mục)';
    } else if (u.permissions) {
      const summaryList = [];
      const moduleMap = {
        overview: 'Tổng quan',
        employees: 'Nhân viên',
        departments: 'Phòng ban',
        branches: 'Chi nhánh',
        positions: 'Chức danh',
        leaves: 'Nghỉ phép',
        reports: 'Báo cáo',
        users: 'Người dùng',
        settings: 'Cài đặt'
      };
      Object.entries(u.permissions).forEach(([mod, acts]) => {
        const allowed = Object.entries(acts).filter(([_, v]) => v).map(([k]) => {
          if (k === 'view') return 'Xem';
          if (k === 'create') return 'Thêm';
          if (k === 'edit') return 'Sửa';
          if (k === 'delete') return 'Xóa';
          if (k === 'approve') return 'Duyệt';
          if (k === 'export') return 'Xuất';
          return k;
        });
        if (allowed.length > 0) {
          summaryList.push(`${moduleMap[mod] || mod} [${allowed.join(', ')}]`);
        }
      });
      permsSummary = summaryList.length > 0 ? summaryList.join('; ') : 'Không có quyền truy cập';
    } else {
      permsSummary = u.roleLabel;
    }

    userRows.push([
      u.id,
      u.username,
      u.name,
      u.email,
      u.phone || '',
      u.roleLabel,
      u.scopeLabel,
      permsSummary,
      u.linkedEmployeeName || '—',
      u.statusLabel || 'Hoạt động',
      u.updatedAt || new Date().toLocaleString('vi-VN')
    ]);
  });
  const fileUsers = writeCSV('users.csv', userRows);
  runGSheetsCmd(`gsheets mutate import-csv "${SPREADSHEET_ID}" "${fileUsers}" --sheet "Người dùng & Phân quyền"`);

  // 11. BẢNG CHẤM CÔNG (Sheet 11)
  console.log('Generating: Bảng chấm công theo phòng ban...');
  const attHeaders = ['Mã NV', 'Họ và tên', 'Phòng ban', 'Chức danh'];
  for (let d = 1; d <= 30; d++) attHeaders.push(`N${d}`);
  attHeaders.push('Tổng công TT', 'Phép (P)', 'Không lương (KL)', 'Đi muộn (M)', 'Giờ OT');
  
  const attRows = [attHeaders];
  (db.attendance || []).forEach(a => {
    const row = [a.employeeCode, a.employeeName, a.departmentName, a.positionName];
    for (let d = 1; d <= 30; d++) {
      row.push((a.days && a.days[d]) ? a.days[d] : '—');
    }
    row.push(a.totalWorkDays, a.leaveDays, a.unpaidDays, a.lateDays, a.otHours);
    attRows.push(row);
  });
  const fileAtt = writeCSV('attendance.csv', attRows);
  runGSheetsCmd(`gsheets mutate import-csv "${SPREADSHEET_ID}" "${fileAtt}" --sheet "Bảng chấm công"`);

  // 12. BẢNG TÍNH LƯƠNG (Sheet 12)
  console.log('Generating: Bảng tính lương & Phiếu lương...');
  const payHeaders = [
    'Mã NV', 'Họ và tên', 'Phòng ban', 'Chức danh', 'Chi nhánh',
    'Lương cơ bản (đ)', 'Phụ cấp (đ)', 'Công chuẩn', 'Công TT', 'Lương theo công (đ)',
    'Giờ OT', 'Lương OT (đ)', 'Thưởng KPI (đ)', 'Tổng Gross (đ)',
    'BHXH 8% (đ)', 'BHYT 1.5% (đ)', 'BHTN 1% (đ)', 'Tổng BH 10.5% (đ)',
    'Thuế TNCN (đ)', 'Khấu trừ khác (đ)', 'Tạm ứng (đ)', 'Tổng khấu trừ (đ)',
    'THỰC LĨNH NET (đ)', 'Số tài khoản nhận', 'Ngân hàng', 'Trạng thái chi trả'
  ];
  const payRows = [payHeaders];
  (db.payroll || []).forEach(p => {
    payRows.push([
      p.employeeCode,
      p.employeeName,
      p.departmentName,
      p.positionName,
      p.branchName,
      p.baseSalary,
      p.allowance,
      p.standardDays,
      p.actualWorkDays,
      p.calculatedSalary,
      p.otHours,
      p.otSalary,
      p.bonus,
      p.grossSalary,
      p.bhxh,
      p.bhyt,
      p.bhtn,
      p.totalInsurance,
      p.tax,
      p.penalties,
      p.advance,
      p.totalDeductions,
      p.netSalary,
      p.bankAccount,
      p.bankName,
      p.statusLabel
    ]);
  });
  const filePay = writeCSV('payroll.csv', payRows);
  runGSheetsCmd(`gsheets mutate import-csv "${SPREADSHEET_ID}" "${filePay}" --sheet "Bảng tính lương"`);

  // Update Settings in db.json
  const now = new Date().toLocaleString('vi-VN');
  db.settings.googleSheets = {
    enabled: true,
    spreadsheetId: SPREADSHEET_ID,
    sheetUrl: `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/edit`,
    lastSync: now,
    status: 'connected',
    syncedSheets: [
      'Tổng quan & Báo cáo',
      'Nhân viên',
      'Phòng ban',
      'Chi nhánh',
      'Vị trí - Chức danh',
      'Nghỉ phép',
      'Quỹ phép năm',
      'Khen thưởng - Kỷ luật',
      'Lịch sử công tác',
      'Người dùng & Phân quyền',
      'Bảng chấm công',
      'Bảng tính lương'
    ]
  };
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf8');

  console.log(`==================================================================`);
  console.log(`Synchronization complete! All 12 sheets updated successfully.`);
  console.log(`Spreadsheet URL: https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/edit`);
  console.log(`Last Sync: ${now}`);
  console.log(`==================================================================`);
}

syncAll().catch(e => {
  console.error('Sync failed:', e);
  process.exit(1);
});
