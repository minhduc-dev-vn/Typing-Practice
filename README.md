# Keysteady Typing Practice

Ứng dụng luyện gõ desktop cho English và Tiếng Việt, xây dựng bằng Next.js App Router. Nội dung luyện tập được lấy hoàn toàn từ dữ liệu tĩnh đóng gói cùng ứng dụng; ứng dụng không gọi dịch vụ AI.

## Tính năng chính

- Hai mode `Words` và `Paragraph`.
- Thời gian chọn nhanh 15, 30, 60 giây hoặc tùy chỉnh từ 10 đến 3600 giây.
- Nội dung tự quay vòng cho đến khi hết giờ và giữ số liệu chính xác qua nhiều vòng.
- Chỉ hiển thị dòng hiện tại cùng dòng xem trước; số cột tự thích ứng với chiều rộng thực tế.
- Space xác nhận từ sau khi đã nhập ít nhất một ký tự; Space lặp lại ở đầu từ mới bị bỏ qua.
- Ký tự thừa hiển thị đỏ và được tính lỗi nhưng không đi vào từ tiếp theo.
- Backspace không thể quay lại từ đã xác nhận; ArrowRight bỏ qua phần còn thiếu của từ hiện tại.
- Hỗ trợ input method của hệ điều hành, bao gồm Vietnamese Telex trên Windows, qua IME composition real-time.
- Bàn phím ảo và âm thanh bàn phím cơ tùy chọn.
- Tài khoản Supabase, lịch sử và dashboard là tùy chọn; guest vẫn luyện tập bình thường.

## Chạy local

```bash
npm install
npm run dev
```

Mở `http://localhost:3000` trên máy desktop có bàn phím vật lý.

## Cấu hình Supabase tùy chọn

1. Tạo Supabase project.
2. Chạy migration [`supabase/migrations/20260802_phase_3_user_experience.sql`](supabase/migrations/20260802_phase_3_user_experience.sql).
3. Sao chép `.env.example` thành `.env.local`.
4. Điền `NEXT_PUBLIC_SUPABASE_URL` và `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
5. Bật phương thức đăng nhập email/password trong Supabase Auth.

Các migration AI và personalization cũ được giữ trong repository để bảo toàn lịch sử database đã triển khai, nhưng không còn được runtime sử dụng. Không cần xóa các bảng cũ trên Supabase.

## Kiểm tra

```bash
npm run validate:data
npm test
npm run typecheck
npm run lint
npm run build
```
