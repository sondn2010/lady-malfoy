# Dracaena Malfoy and The Boy Who Lived — Bộ Truyện Tiếng Việt Toàn Tập (CSV + Mobile + 36 Tranh Minh Họa)

- **Tác giả nguyên tác**: Sergio Xalambrí (`sergiodxa`)
- **Nguồn gốc**: [Wattpad — Dracaena Malfoy and The Boy Who Lived](https://www.wattpad.com/story/416871248-dracaena-malfoy-and-the-boy-who-lived)
- **Số chương hiện tại**: 36 Chương (Năm Thứ Nhất: Chương 1–12 | Năm Thứ Hai: Chương 13–24 | Năm Thứ Ba: Chương 25–36)

## Điểm Mới Nổi Bật Ở Phiên Bản Này

1. **Quản lý danh sách chương động bằng file `chapters.csv`**:
   - Toàn bộ danh sách chương không còn fix cứng trong `index.html`.
   - Khi viết tiếp các chương mới (ví dụ Chương 37 — Năm Thứ Tư), bạn chỉ cần:
     1. Thêm file `.md` vào `01_phien_ban_co_dong/` và `02_phien_ban_chi_tiet/`.
     2. Thêm file ảnh minh họa vào `images/`.
     3. Thêm 1 dòng vào cuối file `chapters.csv` (hoặc dùng công cụ tạo dòng CSV ngay trong tab **Quản Lý CSV & File MD** trên web).
   - Trang web sẽ tự động cập nhật tổng số chương, tự động sinh thêm nút lọc Năm học mới (`Năm 4`), mục lục và thư viện ảnh mà không cần chỉnh sửa code HTML/CSS/JS.

2. **Tách biệt hoàn toàn CSS và JS vào thư mục `assets/`**:
   - `assets/style.css`: Chứa toàn bộ định dạng giao diện, tối ưu hiển thị mobile, thanh ngăn kéo chương (Mobile Drawer), thanh công cụ cố định dưới đáy màn hình điện thoại, và 3 chế độ màu nền (Tối Slytherin, Giấy Cổ Hogwarts, Sepia Đọc Đêm).
   - `assets/app.js`: Xử lý nạp `chapters.csv` qua AJAX, nạp file `.md` qua AJAX, nạp trước (pre-fetch) chương kế tiếp, tự động lưu vị trí cuộn trang từng chương, cử chỉ vuốt màn hình điện thoại và hệ thống phím tắt.
   - `assets/chapter_reader.js`: Script dùng chung cho 72 trang `.html` đọc riêng từng chương.
   - `assets/md_fallback.js`: Dữ liệu dự phòng tự động kích hoạt khi bạn mở trực tiếp qua giao thức `file://` mà không chạy local web server.

3. **Bộ 36 tranh minh họa riêng biệt cho từng chương (`images/chuong_01...jpg` – `images/chuong_36...jpg`)**:
   - Mỗi chương từ Chương 1 đến Chương 36 đều có một bức tranh minh họa riêng khắc họa đúng phân cảnh tiêu biểu của chương đó.

4. **Hệ thống Phím tắt (`Shortcuts`) & Tối ưu Đọc Mobile**:
   - `←` / `A` / `J` (hoặc vuốt sang phải trên điện thoại): Chương trước
   - `→` / `D` / `K` (hoặc vuốt sang trái trên điện thoại): Chương tiếp theo
   - `M`: Chuyển đổi nhanh giữa Bản Dịch Chi Tiết và Bản Viết Cô Đọng
   - `C`: Bật/tắt chế độ Đọc Song Song 2 Bản
   - `F`: Bật/tắt Chế độ Tập trung (Zen Focus Mode — ẩn banner & thanh bên)
   - `T`: Đổi màu nền đọc (Tối Slytherin / Giấy Cổ / Sepia Đọc Đêm)
   - `S` hoặc `/`: Mở danh sách chương & đặt con trỏ vào ô tìm kiếm
   - `B`: Đánh dấu (Bookmark) chương đang đọc
   - `+` / `-`: Tăng / giảm cỡ chữ
   - `?` hoặc `H`: Mở bảng hướng dẫn phím tắt
