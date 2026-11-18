# CineStream VIP

Starter project giao diện xem phim, không yêu cầu đăng nhập, tối ưu responsive cho điện thoại và Android TV.

## Có sẵn
- Trang chủ, tìm kiếm, danh mục, chi tiết phim.
- Yêu thích, lịch sử xem, lưu tiến độ xem trên thiết bị.
- Tự động phát tập kế tiếp nếu nguồn có danh sách tập.
- Thêm nguồn JSON API hoặc JSON riêng.
- Trình phát HTML5 video, toàn màn hình.
- Capacitor để đóng gói Android.

## Chạy thử trên máy tính
Cài Node.js LTS, trong thư mục dự án chạy:
```bash
npm install
npm run build
```
Có thể mở `www/index.html` bằng trình duyệt hoặc chạy local server.

## Thêm nguồn phim
Nhấn **+ Thêm nguồn** trong ứng dụng và nhập URL JSON có thể truy cập bằng HTTPS, CORS phù hợp. Dữ liệu chấp nhận mảng JSON hoặc object có `results`, `movies`, hay `items`.

Ví dụ cấu trúc:
```json
[
  {
    "id": "film-001",
    "title": "Tên phim",
    "type": "movie",
    "genre": "Hành động",
    "year": 2025,
    "desc": "Mô tả phim",
    "poster": "https://example.com/poster.jpg",
    "backdrop": "https://example.com/backdrop.jpg",
    "videoUrl": "https://example.com/video.mp4"
  },
  {
    "id": "series-001",
    "title": "Tên phim bộ",
    "type": "series",
    "episodes": [
      {"title":"Tập 1","url":"https://example.com/episode-1.mp4"},
      {"title":"Tập 2","url":"https://example.com/episode-2.mp4"}
    ]
  }
]
```
Bạn cần tự cấu hình adapter nếu API thực tế dùng tên trường khác hoặc cần API key. Không nhúng API key bí mật vào ứng dụng client.

## Build APK Android
Cần máy tính Windows/macOS/Linux với Node.js LTS, Android Studio và Android SDK:
```bash
npm install
npx cap add android
npx cap sync android
npx cap open android
```
Trong Android Studio: đợi Gradle sync xong, chọn **Build > Build Bundle(s) / APK(s) > Build APK(s)**. APK debug thường nằm tại `android/app/build/outputs/apk/debug/app-debug.apk`.

### Android TV
Trong Android Studio, cấu hình activity manifest để hỗ trợ Leanback/launcher TV, kiểm tra điều hướng bằng D-pad và build lại. CSS đã có chế độ TV focus cơ bản, nhưng để phát hành Android TV cần bổ sung icon/banner TV và kiểm thử trên thiết bị thật.

## Đồng bộ nhiều thiết bị
Hiện lịch sử/yêu thích/tiến độ được lưu trong `localStorage` trên thiết bị hiện tại. Đây **không phải** đồng bộ đám mây. Muốn đồng bộ thật giữa điện thoại và TV, cần backend (ví dụ Supabase/Firebase) và một mã ghép nối hoặc hồ sơ người dùng ẩn danh; chưa cấu hình backend trong bản này.

## Lưu ý nguồn và phát video
Chỉ thêm API, poster, luồng video mà bạn sở hữu hoặc được cấp quyền sử dụng. Một số luồng HLS/DASH, DRM hoặc định dạng đặc biệt không phát được bằng thẻ video HTML5 mặc định; cần tích hợp player tương thích và tuân thủ giấy phép. Mẫu demo không đi kèm phim thương mại hay máy chủ phim.


## Build APK tự động bằng GitHub Actions (có thể thao tác trên điện thoại)
1. Tạo repository GitHub mới và tải toàn bộ nội dung ZIP này lên (giữ nguyên thư mục `.github/workflows`).
2. Mở tab **Actions** của repository, chọn workflow **Build CineStream VIP APK**.
3. Nhấn **Run workflow** (hoặc push lên nhánh `main` để tự chạy).
4. Khi workflow thành công, mở lần chạy đó, kéo xuống **Artifacts**, tải `CineStream-VIP-debug-apk` và giải nén để lấy APK.
5. APK debug dùng để thử nghiệm; muốn phát hành rộng rãi cần tạo khóa ký release và cấu hình ký APK/AAB an toàn.

Lưu ý: GitHub Actions tạo thư mục Android và build trên máy chủ Ubuntu; thư mục `android/` không được đóng gói sẵn vì Capacitor sinh nó bằng `npx cap add android`.


## API phim đã tích hợp
Đã đưa `api-service.js` vào `www/` và nạp trước `app.js`. Adapter này gọi các endpoint được khai báo trong file bạn cung cấp:
- API gốc: `https://phimapi.com`
- CDN ảnh mặc định: `https://phimimg.com`
- Trang chủ: danh sách phim mới, phim bộ, phim lẻ, phim chiếu rạp, hoạt hình.
- Danh mục, tìm kiếm, chi tiết phim, danh sách tập và nguồn phát HLS/embed.
- Cache trong bộ nhớ khoảng 3 phút; có hỗ trợ endpoint máy chủ chính/phụ theo cấu trúc `/api/...` mà file API mô tả.

**Lưu ý:** Tích hợp mã API không đồng nghĩa đã xác minh tính ổn định, điều khoản sử dụng, quyền phân phối phim hoặc quyền truy cập các luồng video. Chỉ sử dụng nội dung bạn có quyền xem/phân phối. Các endpoint bên ngoài có thể thay đổi, giới hạn truy cập hoặc không cho phép gọi trực tiếp từ WebView (CORS). Chưa thực hiện kiểm thử kết nối mạng thực tế trong môi trường build này.


## Bản PHONE ONLY
Bản này được tinh chỉnh dành riêng cho điện thoại Android:
- Bố cục nội dung giới hạn chiều rộng dạng mobile, kể cả khi mở trên màn hình lớn.
- Bỏ mục TV Live và công tắc giao diện Android TV.
- Giữ thanh điều hướng, tìm kiếm, thư viện, lịch sử, yêu thích và trình phát.
- APK được build bằng Capacitor cho Android; kiểm tra trên điện thoại thật trước khi phát hành.
