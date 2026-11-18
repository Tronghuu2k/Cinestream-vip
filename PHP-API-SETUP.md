# Thiết lập API PHP cho Rosi Rạp Phim

1. Dùng hosting riêng hỗ trợ PHP 8+ và PHP cURL, bật HTTPS.
2. Upload nguyên thư mục `server/php/` lên hosting, ví dụ thành `https://api.example.com/php/get.php` và `https://api.example.com/php/nguonc.php`. Hai file phải nằm cùng thư mục.
3. Kiểm tra `https://api.example.com/php/nguonc.php?page=1` trả JSON. Kiểm tra chi tiết bằng `?slug=slug-phim`.
4. Sửa `www/php-api-config.js` thành:
   `window.ROSI_PHP_API_BASE = 'https://api.example.com/php';`
5. Commit source và chạy GitHub Actions để tạo APK mới.

Không đặt `service_role`, mật khẩu hosting hoặc thông tin bí mật trong file JavaScript. Endpoint hiện bật CORS công khai để app có thể gọi từ thiết bị; cân nhắc giới hạn tần suất và giám sát lưu lượng trên hosting.
