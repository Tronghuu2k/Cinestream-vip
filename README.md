# ROSI CINEMA 2.0 STABLE

Bản nâng cấp từ source ROSI Cinema 1.0.1. Giữ nguyên API phim gốc `https://phimapi.com`, CDN ảnh `https://phimimg.com`, các route API tùy chọn và cấu trúc dữ liệu hiện có.

## Đã nâng cấp trong source

- Gỡ giao diện cấu hình/cập nhật khỏi giao diện người dùng; không tự bật popup hoặc cảnh báo `version.json` khi khởi động.
- Giữ lại `updater.js` ở chế độ kiểm tra metadata im lặng, không tự tải/cài APK.
- Chuẩn hóa request API với timeout, kiểm tra HTTP status, xử lý timeout và giải phóng timer.
- Giữ cơ chế máy chủ chính/dự phòng tùy chọn và chế độ Direct CDN.
- Cải thiện trình phát HLS: cấu hình buffer vừa phải, thử phục hồi lỗi mạng/media, báo lỗi rõ ràng khi thiết bị không hỗ trợ HLS, chuyển nguồn dự phòng khi lỗi fatal không thể phục hồi.
- Bổ sung Fit / Fill / Stretch / Original Ratio và lưu chế độ khung hình.
- Bổ sung CSS player phủ toàn màn hình theo `100dvh`, loại bỏ lề/padding không cần thiết.
- Thêm kiểm tra URL media và escape nội dung động ở các vùng hiển thị quan trọng.
- Tắt cleartext HTTP và mixed content mặc định.
- Thêm kiểm tra source bằng `npm test`.
- GitHub Actions cài HLS.js nội bộ trước khi đồng bộ Capacitor và build APK Debug.

## Cấu trúc chính

- `www/index.html`: giao diện và trình phát.
- `www/css/style.css`: giao diện responsive.
- `www/js/api-service.js`: API phim, cache và xử lý request.
- `www/js/app.js`: điều hướng, lịch sử, yêu thích và trình phát.
- `www/js/updater.js`: kiểm tra phiên bản im lặng, không popup.
- `version.json`: metadata phiên bản 2.0.0.
- `.github/workflows/build-apk.yml`: kiểm tra source và build APK.

## Chạy kiểm tra source

Yêu cầu Node.js 20 trở lên.

```bash
npm install
npm test
npm run vendor:copy
```

Nếu mở web preview trực tiếp mà chưa chạy `npm run vendor:copy`, HLS.js sẽ thử tải bản CDN dự phòng. Khi build APK qua workflow, HLS.js được đóng gói nội bộ trong `www/vendor/`.

## Build APK qua GitHub

1. Tải ZIP và giải nén.
2. Đưa toàn bộ nội dung lên repository GitHub mới hoặc repository hiện có.
3. Vào tab Actions.
4. Chọn workflow `ROSI CINEMA 2.0 - Build Android APK`.
5. Chọn Run workflow.
6. Khi chạy thành công, tải artifact `ROSI-CINEMA-2.0.0-APK`.

Workflow hiện xuất APK Debug để cài thử. APK phát hành chính thức cần cấu hình ký Release bằng keystore riêng và GitHub Secrets; không đưa keystore hoặc mật khẩu vào source công khai.

## Giới hạn cần biết trước khi phát hành

- Source này chưa tích hợp Supabase/Firebase Cloud Sync vì cần project URL, anon key và cấu hình bảo mật của chủ ứng dụng.
- Chưa triển khai tải video ngoại tuyến có giấy phép; tính năng này cần nguồn nội dung cho phép download và tích hợp native download/DRM phù hợp.
- Trình phát hiện tại vẫn là HTML5 video + HLS.js trong WebView; chưa thay bằng native Media3 ExoPlayer.
- Chưa thể xác nhận mọi nguồn phim, phụ đề hoặc embed hoạt động vì phụ thuộc API/CDN bên ngoài và quyền truy cập của từng nguồn.
- Cần kiểm thử trên điện thoại Android và TV Box thật trước khi phát hành rộng rãi.

## Bảo toàn API

Không thay đổi host API gốc trong source. Mọi endpoint Direct CDN hiện tại được giữ lại; các endpoint máy chủ tùy chọn vẫn được đọc từ các khóa localStorage cũ.
