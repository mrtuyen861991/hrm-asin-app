# 🏢 ASIN GROUP - Ứng dụng Quản lý Hồ sơ Nhân sự Toàn diện (HRM)

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/mrtuyen861991/hrm-asin-app)
[![Node.js](https://img.shields.io/badge/Node.js-v20+-green.svg)](https://nodejs.org/)
[![Express.js](https://img.shields.io/badge/Express-5.x-blue.svg)](https://expressjs.com/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-CSS-38bdf8.svg)](https://tailwindcss.com/)
[![Google Sheets](https://img.shields.io/badge/Google%20Sheets-Synced-0f9d58.svg)](https://docs.google.com/spreadsheets/d/12DE0YcDFU-4gw7z2K-d4SXxVRRXwvtGYtZrySLEEt0E/edit)

Hệ thống quản lý nhân sự chuyên nghiệp, chuẩn SaaS hiện đại, tối ưu hóa cho doanh nghiệp nhiều chi nhánh, phòng ban, tích hợp đồng bộ dữ liệu thời gian thực 2 chiều với Google Sheets và hoạt động mượt mà trên cả máy tính lẫn điện thoại (Mobile Responsive).

---

## 🚀 Triển khai 1-Click lên Render

Bấm nút dưới đây để tạo website trực tuyến trên Render hoàn toàn miễn phí:

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/mrtuyen861991/hrm-asin-app)

Render sẽ tự động đọc tệp `render.yaml`, cài đặt các gói phụ thuộc và khởi chạy máy chủ Express trên cổng môi trường (mặc định mở cổng `10000` hoặc `$PORT`).

---

## ✨ 20 Tính năng chính nổi bật

1. **Quản lý hồ sơ nhân viên đầy đủ, chi tiết**: Quản lý 76 nhân sự với 6 tab chuyên sâu: Thông tin cơ bản, Công việc & Hợp đồng, Tài liệu & Đính kèm, Nghỉ phép cá nhân, Khen thưởng - Kỷ luật, và Lịch sử công tác.
2. **Quản lý nhiều chi nhánh, phòng ban, vị trí chức danh**: Mạng lưới 3 chi nhánh (Trụ sở chính Hà Nội, Chi nhánh TP. Hồ Chí Minh, Chi nhánh Đà Nẵng), 12 phòng ban nghiệp vụ và 31 vị trí chức danh.
3. **Sơ đồ tổ chức tự vẽ (Org Chart)**: Mô hình hoá phân cấp Ban Giám đốc ➔ Giám đốc khối / Trưởng phòng ➔ Nhân viên trực thuộc, hỗ trợ phóng to, thu nhỏ và xuất hình ảnh.
4. **Định biên, khung lương, cảnh báo thiếu người**: Theo dõi số lượng nhân sự định biên so với thực tế, cấp bậc từ Thực tập sinh đến Giám đốc, thanh đo % lấp đầy và cảnh báo tự động khi vị trí bị thiếu nhân sự.
5. **Tự tính ngày hết hạn hợp đồng**: Tự động cộng số tháng theo loại hợp đồng (Thử việc 2 tháng, Có thời hạn 12/24/36 tháng, Không thời hạn).
6. **Cảnh báo hợp đồng & thử việc sắp hết hạn**: Hệ thống chuông thông báo và danh sách cảnh báo trước 30 ngày (tùy chỉnh trong Cài đặt).
7. **Ký hợp đồng chính thức, gia hạn 1 bước**: Chuyển đổi trạng thái từ thử việc sang chính thức hoặc gia hạn hợp đồng mới chỉ với 1 cú click chuột.
8. **Điều chuyển & điều chỉnh lương kèm ngày hiệu lực**: Lưu số quyết định, phòng ban mới, vị trí mới, mức lương mới và ngày bắt đầu áp dụng.
9. **Tự ghi lịch sử công tác mỗi khi thay đổi**: Mọi biến động tiếp nhận, ký HĐ, tăng lương, điều chuyển, bổ nhiệm đều được tự động ghi nhận vào dòng thời gian công tác.
10. **Ghi nhận nghỉ việc & nhận lại làm việc**: Lưu lý do nghỉ việc (thu nhập, chuyển công tác, gia đình, hết HĐ...) và hỗ trợ kích hoạt nhận lại nhân viên cũ.
11. **Tài liệu & ảnh đại diện**: Tải ảnh đại diện, dán link Google Drive công khai, xem trước ảnh ngay trên hồ sơ.
12. **Nhân viên tạo đơn nghỉ & HR duyệt trực tuyến**: Nhân viên tự gửi đơn xin nghỉ (phép năm, ốm đau, thai sản, không lương...), quản lý và HR duyệt/từ chối ngay trên ứng dụng.
13. **Tự tính quỹ phép năm theo thâm niên**: Mặc định 12 ngày phép/năm, tự động cộng thêm 1 ngày mỗi 5 năm thâm niên công tác.
14. **Khen thưởng, kỷ luật kèm số quyết định**: Ghi nhận khen thưởng bằng tiền/bằng khen hoặc kỷ luật khiển trách, cảnh cáo với ngày hiệu lực và số quyết định.
15. **Nhập nhân viên hàng loạt từ Excel**: Tải file mẫu `.xlsx`, kéo thả file tải lên, tự động kiểm tra lỗi từng dòng trước khi nhập vào hệ thống.
16. **Cảnh báo trùng lặp thông tin**: Tự động phát hiện trùng số điện thoại, email hoặc số CCCD/CMND khi tạo mới hoặc nhập Excel.
17. **Tổng quan trực quan với thẻ KPI & biểu đồ**: Biến động nhân sự 12 tháng, tỷ lệ nghỉ việc, số lượng nhân viên mới, sinh nhật trong tháng.
18. **Báo cáo chuyên sâu**: Biểu đồ tháp tuổi (Nam/Nữ), tỷ lệ giới tính, thâm niên trung bình, phân bổ quỹ lương theo phòng ban và theo chi nhánh.
19. **Phân quyền Quản trị, Nhân sự, Chỉ xem & Ma trận 9 danh mục x 6 mức độ**: Phân quyền chi tiết cho từng tài khoản:
    - 9 Danh mục: Tổng quan, Nhân viên, Phòng ban, Chi nhánh, Chức danh, Nghỉ phép, Báo cáo, Người dùng, Cài đặt.
    - 6 Mức độ: Xem, Thêm, Sửa, Xóa, Duyệt, Xuất/Sync.
    - Phạm vi dữ liệu theo từng chi nhánh hoặc phòng ban trực thuộc.
20. **Đồng bộ tự động lên Google Sheets & dùng mượt trên điện thoại**: Tích hợp trực tiếp Google Sheet ID `12DE0YcDFU-4gw7z2K-d4SXxVRRXwvtGYtZrySLEEt0E` với 10 sheet dữ liệu độc lập.

---

## 📊 Google Sheets Data Hub

Toàn bộ dữ liệu của hệ thống được đồng bộ vào Google Sheets:
🔗 [Xem Google Sheet Trực Tuyến](https://docs.google.com/spreadsheets/d/12DE0YcDFU-4gw7z2K-d4SXxVRRXwvtGYtZrySLEEt0E/edit)

Danh sách 10 Sheet dữ liệu tự động đồng bộ:
1. `Tổng quan & Báo cáo`
2. `Nhân viên` (76 hồ sơ)
3. `Phòng ban` (12 phòng ban)
4. `Chi nhánh` (3 chi nhánh)
5. `Vị trí - Chức danh` (31 chức danh)
6. `Nghỉ phép`
7. `Quỹ phép năm` (76 nhân viên)
8. `Khen thưởng - Kỷ luật`
9. `Lịch sử công tác`
10. `Người dùng & Phân quyền`

---

## 💻 Hướng dẫn chạy trên môi trường cục bộ (Localhost)

```bash
# 1. Clone repository
git clone https://github.com/mrtuyen861991/hrm-asin-app.git
cd hrm-asin-app

# 2. Cài đặt các thư viện phụ thuộc
npm install

# 3. Khởi chạy ứng dụng
npm start

# 4. Mở trình duyệt và truy cập
http://localhost:1000
```

---

## 🛡️ Tài khoản đăng nhập mẫu

| Tên đăng nhập | Mật khẩu | Vai trò | Phạm vi dữ liệu |
| :--- | :--- | :--- | :--- |
| `admin` | `Asin@2026` | Quản trị viên (Toàn quyền) | Tất cả chi nhánh |
| `hr` | `Asin@2026` | Quản lý Nhân sự (HR) | Tất cả chi nhánh |
| `nhanvien` | `Asin@2026` | Chỉ xem (Nhân viên) | Chi nhánh TP. Hồ Chí Minh |

---

*Bản quyền © 2026 ASIN GROUP. Phát triển bởi Huu Tuyen.*
