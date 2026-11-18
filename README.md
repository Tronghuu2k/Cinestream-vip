# Rosi Rạp Phim 2.1

Ứng dụng Rosi Rạp Phim giao diện điện ảnh tối, tối ưu điện thoại và màn hình lớn. Dự án dùng Capacitor 7 để đóng gói Android.

## Điểm nâng cấp 2.1
- Làm mới giao diện theo phong cách rạp phim hiện đại: nền tối, điểm nhấn đỏ, poster bo góc, hàng phim cuộn ngang và bố cục thích ứng màn hình lớn.
- Sửa lỗi cú pháp `constructor()` bị khai báo lặp trong `www/api-service.js` — lỗi khiến API adapter không thể nạp.
- Thêm kiểm tra HTTP, thời gian chờ 12 giây và thông báo lỗi rõ hơn khi API không phản hồi.
- Chuẩn hóa loại phim lẻ, phim bộ và hoạt hình để bộ lọc hoạt động ổn định hơn.
- Giữ duy nhất API gốc PhimAPI (`https://phimapi.com`) và CDN ảnh gốc (`https://phimimg.com`); không thêm nguồn phim mới.
- Giữ tìm kiếm, danh mục, chi tiết phim, lịch sử, yêu thích, tiến độ xem, HLS và đồng bộ Supabase tùy chọn.
- Build script tự kiểm tra cú pháp JavaScript trước khi tạo bundle.

## Cấu trúc
- `www/index.html`: khung giao diện.
- `www/styles.css`: giao diện responsive.
- `www/app.js`: logic giao diện, thư viện, lịch sử và đồng bộ.
- `www/api-service.js`: adapter API PhimAPI gốc.
- `www/cloud-config.js`: cấu hình Supabase tùy chọn.
- `capacitor.config.json`: tên và mã ứng dụng Android.
- `.github/workflows/build-apk.yml`: workflow tự động build APK.

## Build APK bằng GitHub Actions
1. Tải toàn bộ nội dung bên trong thư mục `Rosi-Rap-Phim` lên thư mục gốc repository GitHub.
2. Kiểm tra repository có `package.json`, `capacitor.config.json`, `www/` và `.github/workflows/build-apk.yml`.
3. Mở **Actions** → **Build Rosi Rap Phim APK** → **Run workflow**.
4. Chờ workflow hoàn tất. Mở lần chạy thành công và tải artifact `Rosi-Rap-Phim-debug-apk`.
5. Giải nén artifact để lấy `app-debug.apk`.

Workflow dùng Node.js 22 và Java 21, cài dependencies, kiểm tra cú pháp và bundle ứng dụng, thêm Capacitor Android rồi build APK debug. APK debug phù hợp để thử nghiệm; muốn phát hành rộng rãi cần cấu hình ký bản release.

## Đồng bộ đám mây (tùy chọn)
Xem `SUPABASE-SETUP.md` để tạo bảng, bật Row Level Security và cấu hình `www/cloud-config.js`. Khi chưa cấu hình Supabase, ứng dụng vẫn lưu lịch sử/yêu thích trên thiết bị. Không đưa `service_role` key vào ứng dụng.

## API và giới hạn
- API danh mục/chi tiết: `https://phimapi.com`.
- CDN ảnh: `https://phimimg.com`.
- API là dịch vụ bên ngoài nên uptime, CORS, cấu trúc phản hồi và quyền sử dụng nội dung phụ thuộc nhà cung cấp; mã nguồn không thể bảo đảm dịch vụ luôn hoạt động.
- Chất lượng HLS chỉ chọn được khi manifest của nguồn cung cấp nhiều mức phân giải. MP4 đơn, HLS native hoặc embed có thể không cho chọn chất lượng riêng.
- DRM có thể không phát được trong player này.
- Không có tải video ngoại tuyến. Đồng bộ cloud cần cấu hình Supabase và tài khoản riêng.

## Kiểm tra trước khi giao
- `node --check www/api-service.js`: đạt.
- `node --check www/app.js`: đạt.
- Kiểm tra mô phỏng API: trang chủ, tìm kiếm, chi tiết và danh sách nguồn trả dữ liệu mẫu thành công.
- Chưa xác nhận kết nối thật tới PhimAPI và chưa build APK thực tế trong môi trường này. Cần chạy GitHub Actions và thử trên thiết bị Android trước khi phát hành.
