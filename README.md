# ROSI CINEMA - Ứng Dụng Xem Phim 4K VIP (Standalone Direct CDN + Auto Update + Custom Icon & Splash)

Ứng dụng xem phim chuẩn Netflix cho điện thoại Android, chạy **độc lập 100% không cần máy chủ riêng**, tự động kiểm tra cập nhật từ GitHub `version.json` và tích hợp sẵn bộ **App Icon + Splash Screen VIP** tự động đóng gói trên GitHub Actions.

## Cấu Trúc Thư Mục
- `resources/`: Bộ ảnh gốc độ phân giải cao để `@capacitor/assets` tự sinh icon & splash screen mọi kích thước:
  - `icon-only.png` (`1024x1024`): Icon chính thức của Rosi Cinema.
  - `icon-foreground.png` (`1024x1024`): Lớp biểu tượng trong suốt chuẩn Android Adaptive Icon.
  - `icon-background.png` (`1024x1024`): Nền tối `#09090c` cho Adaptive Icon.
  - `splash.png` & `splash-dark.png` (`2732x2732`): Màn hình chờ tối màu chuẩn rạp phim VIP.
- `version.json`: Khai báo phiên bản (`version`, `versionCode`, `changelog`, `downloadUrl`) cho hệ thống kiểm tra cập nhật.
- `www/`: Mã nguồn ứng dụng (`index.html`, `css/style.css`, `js/api-service.js`, `js/updater.js`, `js/app.js`).
- `capacitor.config.json` & `package.json`: Cấu hình Capacitor 6 và plugin `@capacitor/splash-screen`.
- `.github/workflows/build-apk.yml`: Tự động sinh icon/splash bằng `capacitor-assets` và xuất `Rosi-Cinema.apk`.

## Cách Đổi Icon hoặc Splash Screen Theo Ý Muốn
1. Thay thế các file PNG tương ứng trong thư mục `resources/` (giữ nguyên tên file và kích thước `1024x1024` cho icon, `2732x2732` cho splash).
2. Push lên GitHub, workflow **Build Rosi Cinema Android APK** sẽ tự động cập nhật icon và màn hình chờ vào file `Rosi-Cinema.apk`.
