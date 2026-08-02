# Phase 3 — User Experience (Optional Login)

> Đọc `project-brief.md` trước. Prompt này chỉ chứa phạm vi riêng của
> Phase 3. Giả định Phase 1-2 đã hoàn thành và chạy ổn định ở guest
> mode.

## Mục tiêu

Thêm lịch sử/dashboard nhưng **không được** phá nguyên tắc guest mode
đã có ở Phase 1-2.

## Schema Supabase

```sql
create table practice_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  mode text not null,               -- words | sentences | paragraph
  language text not null,           -- en | vi
  topic text,                       -- null nếu không phải AI-generated
  wpm numeric not null,
  accuracy numeric not null,
  cpm numeric not null,
  errors int not null,
  duration_seconds int not null,
  created_at timestamptz not null default now()
);

create table favorite_topics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  topic text not null,
  created_at timestamptz not null default now(),
  unique (user_id, topic)
);
```

Bật Row Level Security cho cả 2 bảng: user chỉ đọc/ghi được row của
chính mình (`auth.uid() = user_id`).

## Auth

- Dùng Supabase Auth (email/password hoặc magic link — agent chọn
  phương án đơn giản nhất để implement, nêu rõ đã chọn cái nào).
- Đăng nhập/đăng xuất không được nằm chắn trước màn hình luyện gõ
  chính — người dùng vào thẳng trang chủ là luyện gõ được ngay.
- Vị trí nút đăng nhập: góc trên UI, không chiếm không gian chính.

## Hành vi guest vs đã đăng nhập

- **Guest**: sau khi hoàn thành 1 lần luyện gõ, màn hình kết quả hiện
  thêm dòng nhỏ: "Đăng nhập để lưu lại lịch sử luyện tập" — không chặn
  xem kết quả, không popup che màn hình.
- **Đã đăng nhập**: mỗi lần hoàn thành, tự động lưu 1 row vào
  `practice_history`.
- **Không merge lịch sử guest vào tài khoản** khi người dùng đăng nhập
  sau đó — đây là giới hạn được chấp nhận, không cần xử lý.

## Dashboard

- Thống kê: tổng thời gian luyện (tổng `duration_seconds`), WPM trung
  bình, Accuracy trung bình.
- Biểu đồ theo ngày/tuần/tháng — dùng thư viện chart nhẹ (ví dụ
  Recharts), query `practice_history` group theo ngày.
- Trang `/dashboard` chỉ truy cập được khi đã đăng nhập; nếu chưa đăng
  nhập, redirect về trang chủ hoặc hiện thông báo yêu cầu đăng nhập
  (không lỗi 500/trang trắng).

## History & chủ đề

- "Luyện lại bài cũ": lấy lại đúng nội dung đã luyện từ
  `practice_history` (nếu là AI-generated, join với
  `ai_content_cache` qua topic/difficulty/length; nếu không đủ thông
  tin để khôi phục chính xác, agent nêu rõ giới hạn này thay vì cố
  làm phức tạp).
- "Chủ đề gần đây": lấy distinct `topic` từ `practice_history`, sắp
  theo `created_at` giảm dần.
- "Chủ đề yêu thích": CRUD đơn giản trên bảng `favorite_topics`.

## Tiêu chí hoàn thành

- [ ] Người dùng không đăng nhập vẫn luyện gõ và generate AI bình
      thường như Phase 1-2, không có tính năng nào bị chặn.
- [ ] Người dùng đã đăng nhập: mỗi lần luyện gõ xong tự lưu vào
      `practice_history`, xem được trên dashboard.
- [ ] RLS hoạt động đúng: user A không đọc được lịch sử của user B
      (kiểm tra bằng cách thử query trực tiếp hoặc test).
- [ ] Không có bug regressing tính năng guest mode của Phase 1-2.

## Khi hoàn thành

Tóm tắt: phương án Auth đã chọn (email/password hay magic link), schema
đã tạo, kết quả kiểm tra RLS, và bất kỳ nợ kỹ thuật nào. Dừng lại chờ
xác nhận trước khi nhận `phase-4-prompt.md`.
