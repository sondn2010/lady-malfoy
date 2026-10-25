# Lady Malfoy: Dracaena Malfoy & The Boy Who Lived

> *Một góc nhỏ lưu giữ câu chuyện và hành trình đồng hành cùng con gái trong thế giới phép thuật.*

---

## 📖 Lý do ra đời của dự án

Con gái tôi rất thích đọc Harry Potter và hai bố con thường xuyên cùng nhau tìm hiểu về những câu chuyện bên lề câu chuyện gốc. 

Trong một lần tình cờ, chúng tôi xem được bộ serial từ các hãng phim với chủ đề vô cùng độc đáo: *"What if Draco Malfoy is a girl?"* (Nếu Draco Malfoy là con gái). Hình tượng một nàng tiểu thư Malfoy kiêu kỳ nhưng giằng xé nội tâm đã cuốn hút hai bố con ngay từ những thước phim đầu tiên.

Tò mò tìm hiểu sâu hơn về kịch bản bắt nguồn cho các bộ phim diễn đàn này, tôi phát hiện ra câu chuyện khởi nguồn chính là tác phẩm *"Dracaena Malfoy and the Boy Who Lived"* của tác giả Sergio Xalambrí. Để hai bố con dễ dàng theo dõi, tôi đã nhờ AI hỗ trợ dịch lại toàn bộ tác phẩm đó sang tiếng Việt một cách mượt mà và trọn vẹn nhất.

Thế nhưng, khi các chương nguyên tác dần khép lại, sự tò mò về chặng đường tiếp theo của các nhân vật vẫn chưa hề dừng lại. Quá hào hứng muốn biết diễn biến câu chuyện, chúng tôi đã tiếp tục nhờ AI sáng tác nối dài các chương mới để hai bố con cùng đọc và đắm chìm vào thế giới phép thuật kỳ diệu này. Kho lưu trữ này được tạo ra để lưu giữ trọn vẹn hành trình đó.

---

## 📂 Cấu trúc Repository

Dự án được đóng gói kèm một giao diện web đọc truyện hiện đại, mượt mà và tối ưu hóa cho cả máy tính lẫn thiết bị di động:

```
lady-malfoy/
├── README.md                                  # Giới thiệu dự án
├── .gitignore                                 # Danh sách file loại trừ của git
└── dracaena_malfoy_and_the_boy_who_lived/     # Thư mục truyện & Ứng dụng đọc truyện web
    ├── index.html                             # Giao diện đọc truyện chính (AJAX + Markdown)
    ├── start_server.bat                       # Script chạy nhanh local server trên Windows
    ├── start_server.py                        # Script Python khởi chạy HTTP server local
    ├── 01_phien_ban_co_dong/                  # 24 chương phiên bản tóm tắt, cô đọng (.md / .html)
    ├── 02_phien_ban_chi_tiet/                 # 24 chương phiên bản dịch đầy đủ, chi tiết (.md / .html)
    ├── assets/                                # CSS tùy biến giao diện, Dark Mode & fallback data
    └── images/                                # Tranh ảnh minh họa truyện chất lượng cao
```

---

## 🚀 Hướng dẫn đọc truyện

Bạn có thể thưởng thức tác phẩm theo 2 cách đơn giản:

### Cách 1: Khởi chạy máy chủ cục bộ (Khuyên dùng để tối ưu tính năng AJAX)
1. Mở thư mục `dracaena_malfoy_and_the_boy_who_lived/`.
2. Chạy file `start_server.bat` (hoặc mở terminal gõ `python start_server.py`).
3. Trình duyệt sẽ tự động mở trang đọc truyện tại địa chỉ: `http://localhost:8000`.

### Cách 2: Mở trực tiếp file HTML
- Nhấp đúp chuột trực tiếp vào file `dracaena_malfoy_and_the_boy_who_lived/index.html` trong trình duyệt của bạn. Hệ thống tích hợp sẵn cơ chế fallback dữ liệu giúp bạn đọc truyện bình thường mà không cần qua server.

---

## ✨ Tính năng nổi bật của ứng dụng đọc

- **2 Phiên bản đọc song song**: Chuyển đổi linh hoạt giữa bản dịch chi tiết và bản cô đọng.
- **Tùy biến giao diện**: 4 chế độ màu (Slytherin Tối, Giấy Cổ Điển, Sáng, OLED), tùy chỉnh kích cỡ phông chữ và canh lề.
- **Zen Mode**: Chế độ đọc tập trung, ẩn toàn bộ thanh công cụ phân tâm.
- **Hỗ trợ đầy đủ phím tắt**: Điều hướng chương nhanh bằng các phím mũi tên (`←` / `→`), cuộn trang theo chuẩn Kindle (`Space`).
- **Tương thích Mobile**: Hỗ trợ cử chỉ vuốt chạm chuyển chương, thanh điều hướng thông minh và tự động lưu vị trí trang đang đọc dở.

---

## ✍️ Tác quyền & Nguồn gốc

- **Nguyên tác**: *Dracaena Malfoy and The Boy Who Lived* của tác giả **Sergio Xalambrí** ([Wattpad Story](https://www.wattpad.com/story/416871248-dracaena-malfoy-and-the-boy-who-lived)).
- **Dịch thuật & Sáng tác tiếp nối**: Thực hiện với sự hỗ trợ của AI, phục vụ nhu cầu đọc truyện và giải trí gia đình.
