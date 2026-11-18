# Rosi Rạp Phim

Ứng dụng xem phim giao diện mobile-first, không yêu cầu đăng nhập. Được đóng gói Android bằng Capacitor.

## Tính năng trong source
- Giao diện Rosi Rạp Phim, lời chào khi mở ứng dụng và nút tải lại.
- Trang chủ, tìm kiếm, lọc phim lẻ/phim bộ/hoạt hình và lọc theo thể loại có trong dữ liệu API.
- Chi tiết phim, danh sách tập, chọn nguồn phát khi API trả về nhiều nguồn.
- Trình phát video HTML5/HLS, toàn màn hình, chuyển khung hình vừa màn hình/lấp đầy màn hình.
- Chọn chất lượng HLS theo các mức thực tế trong manifest. 4K/2160p chỉ hiển thị khi nguồn thực sự cung cấp mức đó; không thể nâng video HD thành 4K bằng phần mềm giao diện.
- Lịch sử xem, yêu thích, lưu tiến độ trên thiết bị và tự động phát tập kế tiếp.
- Tài khoản email/password Supabase tùy chọn; đồng bộ đám mây yêu thích, lịch sử, tiến độ và cache phim khi đã cấu hình project Supabase.
- Android Back: đóng trình phát/hộp thoại/trang con trước; ở trang chủ nhấn Back hai lần trong 2,2 giây để thoát. Có thêm lối tắt vuốt hai ngón xuống hai lần trên thiết bị hỗ trợ.
- Nút thêm API riêng (URL máy chủ cần tương thích cấu trúc endpoint của adapter).

## Cấu trúc
- `www/`: giao diện, ứng dụng và API adapter.
- `capacitor.config.json`: tên và mã ứng dụng Android.
- `.github/workflows/build-apk.yml`: workflow tự động build APK.

## Build APK bằng GitHub Actions
1. Tải toàn bộ nội dung thư mục dự án lên thư mục gốc của repository GitHub, giữ nguyên `.github/workflows/build-apk.yml` và thư mục `www/`.
2. Mở tab **Actions**.
3. Chọn **Build Rosi Rap Phim APK** rồi nhấn **Run workflow**.
4. Khi hoàn tất, mở lần chạy thành công và tải artifact `Rosi-Rap-Phim-debug-apk`.
5. Giải nén artifact để lấy `app-debug.apk`.

Workflow dùng Node.js 22, Java 21, bundle mã nguồn và cài Capacitor Android/plugin App rồi tạo APK debug. Các GitHub Actions được cập nhật theo major hiện hành tại thời điểm tạo source. APK debug phù hợp để thử nghiệm; muốn phát hành rộng rãi cần cấu hình ký bản release.

## Đồng bộ đám mây (tùy chọn)
Xem `SUPABASE-SETUP.md` để tạo bảng, bật Row Level Security và cấu hình `www/cloud-config.js`. Khi chưa cấu hình Supabase, ứng dụng vẫn dùng dữ liệu cục bộ. Không đưa service_role key vào ứng dụng.

## API và chất lượng video
Adapter hiện gọi API được khai báo trong `www/api-service.js`, mặc định là `https://phimapi.com`, ảnh mặc định từ `https://phimimg.com`. Đây là nguồn bên ngoài; không cam kết uptime, tính tương thích, quyền phân phối hay quyền truy cập nội dung. Chỉ dùng nội dung và luồng phát bạn có quyền sử dụng.

Chọn chất lượng thủ công cần nguồn HLS có master playlist liệt kê các mức phân giải. Nếu nguồn là MP4 đơn, HLS native hoặc embed không cung cấp thông tin mức chất lượng, ứng dụng chỉ có thể phát ở chất lượng do nguồn quyết định. DRM có thể không phát được trong player này.

## Giới hạn hiện tại
- Đồng bộ đám mây cần người dùng cấu hình dự án Supabase và đăng nhập; source không chứa sẵn backend hoặc khóa dự án.
- Mục Tải xuống hiện là trang thông tin, chưa triển khai tải video ngoại tuyến.
- Vuốt hai ngón là lối tắt phụ; thao tác Android Back hai lần là cách thoát chính.
- Cần kiểm thử với API và thiết bị thực tế trước khi phát hành. Build thành công không bảo đảm mọi link phim đều phát được.

## Chạy local
```bash
npm install
npx cap add android
npx cap sync android
```
Sau đó mở thư mục Android trong Android Studio hoặc dùng GitHub Actions theo hướng dẫn trên.


## Bổ sung API PHP (get.php + nguonc.php)

- Mã PHP được đặt trong `server/php/`. Upload cả thư mục này lên hosting có PHP 8+ và cURL, giữ `get.php` và `nguonc.php` cùng một thư mục.
- Bật HTTPS trên hosting. Không tắt xác minh chứng chỉ TLS.
- Sau khi upload, sửa `www/php-api-config.js`: đặt `window.ROSI_PHP_API_BASE` thành URL HTTPS của thư mục chứa hai file, ví dụ `https://api.example.com/php`.
- `get.php?slug=ten-phim` trả chi tiết phim và các server/tập đã tổng hợp; `nguonc.php?page=1` trả danh sách phim NguồnC; `nguonc.php?slug=ten-phim` trả chi tiết NguồnC.
- App dùng PHP như nguồn bổ sung; nếu PHP không cấu hình hoặc không phản hồi, app vẫn thử API tích hợp hiện tại.
- Chỉ kết nối và phát nội dung mà bạn có quyền truy cập/phát. API bên thứ ba có thể thay đổi hoặc ngừng hoạt động.
