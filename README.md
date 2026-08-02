# AI Typing Practice

Ứng dụng luyện gõ desktop cho English và Tiếng Việt, xây dựng bằng Next.js App Router.

## Phase hiện tại

Phase 4 hoàn tất roadmap hiện tại: engine luyện gõ chạy hoàn toàn ở client, nội dung tĩnh và AI, tài khoản Supabase email/password tùy chọn, lịch sử/dashboard và gợi ý Daily Practice theo lịch sử 7 ngày. Guest vẫn luyện gõ và generate bình thường; banner cá nhân hóa chỉ được tải sau khi xác thực tài khoản.

## Chạy local

```bash
npm install
npm run dev
```

Mở `http://localhost:3000` trên máy desktop có bàn phím vật lý.

## Cấu hình Supabase và AI

1. Tạo Supabase project free tier.
2. Chạy lần lượt ba migration:
   - [`supabase/migrations/20260801_phase_2_ai_content.sql`](supabase/migrations/20260801_phase_2_ai_content.sql)
   - [`supabase/migrations/20260802_phase_3_user_experience.sql`](supabase/migrations/20260802_phase_3_user_experience.sql)
   - [`supabase/migrations/20260803_phase_4_personalization.sql`](supabase/migrations/20260803_phase_4_personalization.sql)
3. Sao chép `.env.example` thành `.env.local`.
4. Điền Supabase URL, anon key, service-role key và thông tin OpenAI-compatible provider. `OPENAI_API_BASE_URL` nên kết thúc ở API version, ví dụ `https://api.openai.com/v1`.

`SUPABASE_SERVICE_ROLE_KEY` chỉ được đọc trong API route phía server. Không đặt key này trong biến có tiền tố `NEXT_PUBLIC_`.

Khi thiếu cấu hình hoặc provider gặp lỗi, `/api/generate` trả nội dung tĩnh cùng thông báo fallback để phiên luyện không bị treo.

Supabase Auth cần bật email/password. Tùy cấu hình project, người dùng có thể phải xác nhận email trước khi đăng nhập. Hai bảng Phase 3 bật RLS và chỉ cho session `authenticated` đọc/ghi row có `user_id = auth.uid()`.

Cache `topic_suggestions` của Phase 4 dùng chung giữa các tài khoản nhưng chỉ API server với service-role key được truy cập. Mỗi topic xuất hiện ít nhất 3 lần trong lịch sử 7 ngày được xem là quen thuộc. Gợi ý liên quan được gọi AI một lần rồi cache; nếu chưa đủ lịch sử hoặc AI lỗi, ứng dụng dùng danh sách chủ đề mặc định tĩnh. Trình duyệt giữ một bản sao gợi ý theo `userId + ngày UTC` trong `localStorage` để không tính lại mỗi lần tải trang.

Schema Phase 3 không lưu nguyên văn bài tĩnh hoặc cặp `difficulty/length` của bài AI. Vì vậy dashboard hiển thị lịch sử và topic nhưng không giả lập tính năng luyện lại chính xác khi thiếu dữ liệu.

## Kiểm tra

```bash
npm run validate:data
npm test
npm run typecheck
npm run lint
npm run build
```
