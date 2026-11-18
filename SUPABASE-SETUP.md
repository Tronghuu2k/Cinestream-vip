# Rosi Rạp Phim MAX — thiết lập đồng bộ đám mây

Đồng bộ đám mây dùng Supabase Auth (email/mật khẩu) và một hàng JSONB cho mỗi tài khoản. Không có máy chủ Supabase thì ứng dụng vẫn chạy và lưu dữ liệu cục bộ, nhưng đồng bộ đám mây sẽ không hoạt động.

## 1. Tạo dự án Supabase
1. Tạo project mới tại https://supabase.com/.
2. Trong Project Settings → API, sao chép Project URL và anon/public key (hoặc publishable key). Không bao giờ đưa `service_role` key vào ứng dụng.
3. Mở SQL Editor, chạy SQL dưới đây.

```sql
create table if not exists public.rosi_user_data (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.rosi_user_data enable row level security;
drop policy if exists "Users can read own Rosi data" on public.rosi_user_data;
create policy "Users can read own Rosi data" on public.rosi_user_data
  for select to authenticated using (auth.uid() = user_id);
drop policy if exists "Users can insert own Rosi data" on public.rosi_user_data;
create policy "Users can insert own Rosi data" on public.rosi_user_data
  for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "Users can update own Rosi data" on public.rosi_user_data;
create policy "Users can update own Rosi data" on public.rosi_user_data
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

## 2. Cấu hình ứng dụng
Mở `www/cloud-config.js` và thay các giá trị mẫu:
- `YOUR_SUPABASE_PROJECT_URL` → Project URL
- `YOUR_SUPABASE_ANON_OR_PUBLISHABLE_KEY` → anon/public hoặc publishable key

Chỉ dùng public/anon key ở client; bảo vệ dữ liệu bằng RLS. Không commit bất kỳ `service_role` key hay secret nào.

## 3. Xác thực email
Trong Supabase Authentication → URL Configuration, cấu hình Site URL theo URL trang web nếu có. Với app chỉ dùng email/password, người dùng có thể cần xác nhận email trước lần đăng nhập đầu tiên. Có thể điều chỉnh Email provider trong Auth settings.

## 4. Kiểm tra
1. Build APK mới sau khi cấu hình.
2. Mở app → biểu tượng đám mây → Tạo tài khoản.
3. Xác nhận email nếu Supabase yêu cầu, sau đó đăng nhập.
4. Thêm phim yêu thích/xem thử, nhấn Đồng bộ ngay.
5. Đăng nhập cùng tài khoản trên thiết bị thứ hai để kiểm tra.

## Dữ liệu được đồng bộ
Yêu thích, lịch sử xem, tiến độ và bộ nhớ đệm thông tin phim. Dữ liệu được lưu trong bảng `rosi_user_data` theo user_id. Bản hiện tại gộp danh sách yêu thích/lịch sử từ các thiết bị; nếu bỏ yêu thích trên một máy, mục đó có thể được nhập lại từ máy khác khi đồng bộ tiếp.
