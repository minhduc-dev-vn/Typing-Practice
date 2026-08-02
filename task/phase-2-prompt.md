# Phase 2 — AI Content Generation

> Đọc `project-brief.md` trước, đặc biệt mục 3 (env var), mục 5 (cache,
> rate-limit, lọc từ khoá). Prompt này chỉ chứa phạm vi riêng của Phase
> 2. Giả định Phase 1 (Typing Engine) đã hoàn thành và chạy ổn định.

## Mục tiêu

AI tạo nội dung luyện gõ theo chủ đề, dùng được ngay không cần đăng
nhập.

## API route

`POST /api/generate`

Request body:
```json
{
  "language": "en | vi",
  "topic": "string",
  "difficulty": "easy | medium | hard",
  "length": "short | medium | long"
}
```

Response:
```json
{
  "content": ["string", "..."],
  "cached": true
}
```

`content` là mảng câu/đoạn tuỳ theo mode đang chọn ở UI (words nối
thành câu, sentences, hoặc paragraph — quyết định cấu trúc cụ thể khi
implement, miễn tương thích với Typing Engine ở Phase 1).

## Schema Supabase — bảng cache dùng chung

```sql
create table ai_content_cache (
  id uuid primary key default gen_random_uuid(),
  language text not null,
  topic text not null,
  difficulty text not null,
  length text not null,
  content jsonb not null,
  created_at timestamptz not null default now(),
  unique (language, topic, difficulty, length)
);
```

Luồng xử lý: trước khi gọi AI, query bảng này theo
`(language, topic, difficulty, length)`. Nếu có → trả về `cached:
true`. Nếu không → gọi AI, lưu kết quả vào bảng, trả về `cached:
false`.

## Prompt template gửi AI (yêu cầu bắt buộc)

- Yêu cầu model **chỉ trả về JSON thuần**, không kèm text giải thích,
  không markdown code fence.
- Prompt phải nêu rõ: ngôn ngữ output, độ khó (từ vựng đơn giản/phức
  tạp tương ứng difficulty), độ dài tương ứng length.
- Parse response, nếu parse JSON thất bại → thử lại tối đa 1 lần, nếu
  vẫn lỗi → fallback (xem phần Xử lý lỗi).

## Rate-limit generate (đơn giản, không cần hạ tầng riêng)

- Tạo bảng `generate_usage`:
```sql
create table generate_usage (
  session_id text primary key,
  count int not null default 0,
  reset_at timestamptz not null
);
```
- `session_id` là 1 UUID random tạo phía client, lưu trong cookie
  (không cần đăng nhập). Giới hạn đề xuất: **20 lần generate/ngày/
  session** — agent có thể điều chỉnh số này nếu thấy hợp lý hơn nhưng
  phải nêu rõ số đã chọn và lý do.
- Khi vượt giới hạn: trả lỗi rõ ràng, UI hiển thị thông báo, vẫn cho
  dùng nội dung tĩnh từ Phase 0.
- Nêu rõ trong tóm tắt: giới hạn này có thể bị lách nếu người dùng xoá
  cookie — chấp nhận được ở quy mô project mini, không cần xử lý thêm.

## Lọc từ khoá cơ bản

- Danh sách từ khoá cấm dạng mảng string trong code (ví dụ file
  `lib/ai/blocked-keywords.ts`), kiểm tra topic trước khi gọi AI
  (không phân biệt hoa/thường, kiểm tra cả tiếng Việt không dấu).
- Nếu topic chứa từ khoá cấm → từ chối, không gọi AI, trả lỗi rõ ràng
  cho UI hiển thị.

## Xử lý lỗi (bắt buộc)

- Nếu gọi AI API thất bại (timeout, lỗi mạng, lỗi parse sau khi đã thử
  lại) → **không để UI treo**, tự động fallback dùng nội dung tĩnh từ
  `data/*.json` (Phase 0) theo đúng ngôn ngữ đang chọn, kèm thông báo
  nhỏ cho người dùng biết đang dùng nội dung mặc định.

## Tiêu chí hoàn thành

- [ ] AI sinh nội dung tự nhiên cho cả tiếng Việt và tiếng Anh.
- [ ] Người dùng chưa đăng nhập vẫn generate được bài mới.
- [ ] Cùng một tổ hợp (language/topic/difficulty/length) lần gọi thứ 2
      trả về `cached: true`, không gọi AI lại (kiểm tra qua log hoặc
      query Supabase).
- [ ] Rate-limit hoạt động đúng: vượt giới hạn thì bị chặn generate mới
      nhưng vẫn dùng được nội dung tĩnh.
- [ ] Lọc từ khoá chặn được ít nhất các case test cơ bản đã tự định
      nghĩa.
- [ ] Khi AI API lỗi, UI fallback về nội dung tĩnh, không bị treo.

## Khi hoàn thành

Tóm tắt: schema bảng đã tạo trong Supabase, giới hạn generate đã chọn
và lý do, cách lọc từ khoá hoạt động, chi phí ước tính mỗi lần gọi AI
(nếu tính được), và bất kỳ nợ kỹ thuật nào. Dừng lại chờ xác nhận trước
khi nhận `phase-3-prompt.md`.
