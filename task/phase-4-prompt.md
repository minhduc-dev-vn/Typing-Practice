# Phase 4 — AI Personalization

> Đọc `project-brief.md` trước. Prompt này chỉ chứa phạm vi riêng của
> Phase 4. Giả định Phase 3 (`practice_history`, dashboard) đã hoàn
> thành. Đây là phase cuối trong roadmap hiện tại.

## Mục tiêu

Cá nhân hoá gợi ý dựa trên lịch sử — chỉ áp dụng cho tài khoản đã đăng
nhập.

## Thuật toán gợi ý (rule-based, không cần ML — bắt buộc theo hướng
   đơn giản này trừ khi có lý do kỹ thuật để đổi)

1. Query `practice_history` của user trong 7 ngày gần nhất, group theo
   `topic`, đếm số lần luyện.
2. Nếu 1 topic có **≥ 3 lần** trong 7 ngày → đây là "topic quen thuộc",
   đủ điều kiện gợi ý topic liên quan.
3. Với mỗi topic quen thuộc, kiểm tra bảng `topic_suggestions` (xem
   schema dưới) xem đã có gợi ý liên quan chưa:
   - Nếu có → dùng luôn (không gọi AI lại).
   - Nếu chưa → gọi AI 1 lần để sinh ra 1 topic liên quan (ví dụ input
     "Artificial Intelligence" → output "Machine Learning"), lưu vào
     `topic_suggestions`.
4. Nếu user chưa đủ dữ liệu (chưa có topic nào ≥ 3 lần/7 ngày) → hiện
   1 topic ngẫu nhiên từ danh sách gợi ý mặc định tĩnh trong code
   (không cần gọi AI).

## Schema Supabase

```sql
create table topic_suggestions (
  id uuid primary key default gen_random_uuid(),
  source_topic text not null unique,
  related_topic text not null,
  created_at timestamptz not null default now()
);
```

Bảng này dùng chung (không gắn theo user) — giống nguyên tắc cache ở
Phase 2.

## Daily Practice

- Hiển thị 1 gợi ý mỗi ngày trên trang chủ (chỉ khi đã đăng nhập), ví
  dụ dạng banner: "Bạn đã luyện chủ đề {topic} nhiều lần, hôm nay hãy
  thử {related_topic}."
- Logic tính lại 1 lần/ngày (không cần tính real-time mỗi lần load
  trang) — agent có thể cache kết quả gợi ý trong ngày theo cách đơn
  giản nhất (ví dụ tính lại nếu `created_at` gợi ý gần nhất khác ngày
  hôm nay).

## Tiêu chí hoàn thành

- [ ] Gợi ý thay đổi theo lịch sử thực tế của từng tài khoản (kiểm tra
      bằng cách tạo dữ liệu test với topic khác nhau, xác nhận gợi ý
      ra đúng topic tương ứng).
- [ ] User guest (chưa đăng nhập) không thấy banner gợi ý cá nhân hoá
      này, nhưng vẫn dùng được Phase 1-2 bình thường.
- [ ] Gợi ý cùng 1 `source_topic` không gọi AI lại lần 2 (đã cache
      trong `topic_suggestions`).

## Khi hoàn thành

Tóm tắt: logic gợi ý đã implement, ví dụ input/output thực tế đã test,
và bất kỳ giới hạn nào (ví dụ: gợi ý có thể chưa đa dạng nếu ít dữ liệu
lịch sử). Đây là phase cuối — tổng kết lại toàn bộ trạng thái dự án
sau khi xong, liệt kê những phần có thể cải thiện thêm nếu tiếp tục
phát triển ngoài roadmap hiện tại.
