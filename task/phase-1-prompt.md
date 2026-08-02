# Phase 1 — Core Typing Engine (MVP)

> Đọc `project-brief.md` trước, đặc biệt mục 2 (cấu trúc thư mục), mục
> 5 (công thức WPM/CPM, Telex/VNI, kiến trúc engine), mục 6 (testing).
> Prompt này chỉ chứa phạm vi riêng của Phase 1. Giả định Phase 0 (data
> tĩnh trong `data/`) đã hoàn thành.

## Mục tiêu

Trải nghiệm luyện gõ mượt, ổn định, chạy hoàn toàn ở client, không cần
tài khoản.

## Kiến trúc bắt buộc

- `lib/typing-engine/engine.ts`: class hoặc closure quản lý:
  - index con trỏ hiện tại
  - mảng trạng thái từng ký tự: `correct | incorrect | pending`
  - hàm `onKeyPress(char)`, `onBackspace()`, `reset()`
  - engine **không** import React, không gọi `setState`.
- Component `TypingScreen.tsx` giữ 1 ref tới container chứa các
  `<span>` ký tự; engine cập nhật `className` của từng `<span>` trực
  tiếp qua DOM API (`element.classList`), không qua React re-render
  cho từng keystroke.
- `store/typingStore.ts` (Zustand) chỉ giữ state cấp cao, cập nhật
  không thường xuyên: `mode`, `language`, `timeLimit`, `isRunning`,
  `finalResult`. **Không** lưu toàn bộ mảng trạng thái ký tự trong
  store.

## Công thức tính toán (bắt buộc theo đúng, xem chi tiết ở
   `project-brief.md` mục 5)

- English WPM = (ký tự đúng / 5) / phút.
- Vietnamese WPM = (số cụm gõ/âm tiết đúng) / phút — tách theo khoảng
  trắng, ví dụ "xin chào" = 2 cụm.
- CPM = ký tự đúng / phút (cả 2 ngôn ngữ).
- Accuracy = ký tự đúng / tổng ký tự đã gõ × 100.

## Xử lý Vietnamese Telex/VNI (`lib/typing-engine/vietnamese.ts`)

- Chuyển đổi ngay tại input, client-side.
- Test case tối thiểu cần pass (Telex):
  - `as` → `á`, `af` → `à`, `ar` → `ả`, `ax` → `ã`, `aj` → `ạ`
  - `aw` → `ă`, `ow` → `ơ`, `w` sau nguyên âm tương ứng → dấu mũ/móc
  - `dd` → `đ`
- Agent tự chọn cách implement (tự viết state machine hoặc dùng thư
  viện có sẵn), miễn pass được các test case trên.

## Chức năng UI

- Màn hình luyện gõ desktop-only, Dark/Light mode.
- Modes: Words, Sentences, Paragraph — cả English và Tiếng Việt, lấy
  dữ liệu từ `data/*.json` (Phase 0).
- Time Mode: 30s / 60s / 120s, đếm ngược, tự dừng khi hết giờ.
- Highlight ký tự hiện tại (con trỏ), đánh dấu đúng/sai real-time.
- Màn hình kết quả: WPM, Accuracy, CPM, Errors, thời gian.

## Ngưỡng hiệu năng (đo được, không đánh giá cảm tính)

- Latency từ keystroke đến khi UI cập nhật: **< 16ms** (tương đương 1
  frame ở 60fps), đo bằng `performance.now()` trước/sau xử lý
  keystroke, log ra console trong môi trường dev hoặc viết vào 1 test
  đo latency giả lập.
- Không có state toàn bộ ký tự nằm trong Zustand store (kiểm tra bằng
  cách review code, không phải đo runtime).

## Test case bắt buộc (unit test hoặc test thủ công có ghi lại kết quả)

1. Gõ đúng toàn bộ câu → Accuracy 100%, WPM/CPM tính đúng công thức.
2. Gõ sai 1 ký tự, dùng backspace sửa lại → error count không tăng sai,
   trạng thái ký tự cập nhật đúng.
3. Chuyển mode giữa chừng (đang gõ Sentences chuyển sang Paragraph) →
   engine reset đúng, không giữ state cũ.
4. Time Mode hết giờ → tự động dừng, hiện màn hình kết quả, không cho
   gõ tiếp.
5. Gõ tiếng Việt bằng Telex → ra đúng ký tự có dấu theo các case ở
   mục "Xử lý Vietnamese Telex/VNI".

## Tiêu chí hoàn thành

- [ ] Đạt ngưỡng latency < 16ms.
- [ ] Cả 5 test case ở trên pass.
- [ ] Hoạt động đầy đủ không cần AI, không cần đăng nhập.
- [ ] Cả 3 mode hoạt động cho cả 2 ngôn ngữ, dùng dữ liệu Phase 0.

## Khi hoàn thành

Chạy test/lint. Tóm tắt: cách engine tách khỏi re-render (đoạn code
minh hoạ ngắn), kết quả đo latency thực tế, cách Telex/VNI được
implement, và bất kỳ giả định/nợ kỹ thuật nào. Dừng lại chờ xác nhận
trước khi nhận `phase-2-prompt.md`.
