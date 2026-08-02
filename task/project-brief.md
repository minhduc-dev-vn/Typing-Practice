# Project Brief: AI Typing Practice

File này chứa ràng buộc chung, áp dụng cho **mọi phase**. Đọc kỹ trước
khi bắt đầu bất kỳ phase nào — các file `phase-N-prompt.md` sẽ không
lặp lại nội dung ở đây, chỉ bổ sung phần riêng của phase đó.

Bạn là AI coding agent (Claude Code hoặc tương đương) xây dựng dự án
**AI Typing Practice** từ đầu. Đây là project mini cá nhân — ưu tiên
đơn giản, hiệu năng, và chi phí vận hành $0/tháng.

## 1. Ràng buộc sản phẩm

- **Thiết bị**: chỉ desktop / bàn phím vật lý. Không xử lý touch, không
  cần responsive cho mobile, không cần PWA.
- **Truy cập**: mọi tính năng luyện gõ + AI generate phải dùng được
  **không cần đăng nhập** (guest mode). Đăng nhập chỉ mở khoá lưu lịch
  sử và dashboard.
- **Triển khai**: 1 web service Next.js duy nhất trên Render.com free
  tier. Free tier sleep sau 15 phút không hoạt động, cold start 30-60s
  ở request đầu — bắt buộc có loading state, không được để màn hình
  trắng quá 1-2 giây không phản hồi gì.
- **Database**: Supabase free tier (Postgres + Auth). Không dùng Render
  Postgres free (tự xoá sau ~30 ngày không hoạt động).
- **Ngân sách**: giữ chi phí $0/tháng. Không thêm dịch vụ trả phí nếu
  chưa được yêu cầu rõ ràng.
- **Ngôn ngữ giao tiếp**: tiếng Việt khi trao đổi với người dùng.

## 2. Cấu trúc thư mục dự án (bắt buộc tuân theo)

```
/
├── app/                      # Next.js App Router
│   ├── page.tsx              # màn hình luyện gõ chính
│   ├── result/               # màn hình kết quả (nếu tách route)
│   ├── dashboard/             # Phase 3+
│   └── api/
│       └── generate/route.ts  # Phase 2
├── components/
│   ├── TypingScreen.tsx
│   ├── ResultScreen.tsx
│   └── ui/                    # component UI dùng chung
├── lib/
│   ├── typing-engine/          # logic thuần TS, KHÔNG import React
│   │   ├── engine.ts
│   │   └── vietnamese.ts       # xử lý Telex/VNI, syllable counting
│   ├── supabase/
│   │   ├── client.ts           # browser client
│   │   └── server.ts           # server client (API routes)
│   └── ai/
│       └── generate.ts         # gọi OpenAI-compatible API
├── store/
│   ├── typingStore.ts          # Zustand: mode, language, timer, kết quả
│   └── authStore.ts            # Phase 3+
├── data/                        # corpus tĩnh Phase 0
│   ├── words-en.json
│   ├── words-vi.json
│   ├── sentences-en.json
│   ├── sentences-vi.json
│   ├── paragraphs-en.json
│   └── paragraphs-vi.json
├── .env.example
└── README.md
```

Nếu có lý do kỹ thuật chính đáng để đổi cấu trúc, agent phải nêu rõ lý
do trong phần tóm tắt cuối phase.

## 3. Tech Stack cố định

- Next.js (App Router), TypeScript (strict mode), Tailwind CSS, Zustand
- Animation: Framer Motion — **chỉ dùng cho UI phụ** (transition màn
  hình, fade...), tuyệt đối không dùng trong vòng lặp core của Typing
  Engine.
- Backend: Next.js API routes (không dùng NestJS hay service riêng).
- Database + Auth: Supabase (`@supabase/supabase-js`, `@supabase/ssr`
  nếu cần server-side auth), free tier.
- AI: gọi qua OpenAI-compatible API, endpoint/model cấu hình qua env
  var, không hardcode key.

## 4. Biến môi trường (tạo `.env.example` từ Phase 1, điền giá trị thật
   khi cần ở Phase 2-3)

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=        # chỉ dùng server-side, không lộ ra client
OPENAI_API_BASE_URL=
OPENAI_API_KEY=
OPENAI_MODEL=
```

## 5. Nguyên tắc kỹ thuật xuyên suốt

- **Typing Core Engine** (`lib/typing-engine/engine.ts`) phải là logic
  thuần TypeScript, không phụ thuộc React, không gọi `setState`. Engine
  cập nhật DOM trực tiếp qua ref (mỗi ký tự là 1 `<span>` có index,
  engine set `className` trực tiếp) hoặc dùng
  `requestAnimationFrame` để batch update — không re-render component
  cha mỗi keystroke.
- **Công thức WPM/CPM**:
  - English: `WPM = (số ký tự gõ đúng / 5) / (thời gian tính bằng phút)`.
  - Vietnamese: `WPM = (số cụm gõ đúng) / (thời gian tính bằng phút)`,
    trong đó 1 "cụm gõ" = 1 âm tiết (tách theo khoảng trắng, không tách
    theo ký tự Unicode). Ví dụ "xin chào" = 2 cụm gõ, không phải 8 hay
    9 ký tự.
  - CPM = số ký tự gõ đúng / thời gian phút (áp dụng chung cho cả 2
    ngôn ngữ, đây vẫn tính theo ký tự thô để phản ánh tốc độ gõ tay).
- **Telex/VNI**: xử lý chuyển đổi ngay tại input, client-side, không
  gọi API. Có thể dùng thư viện có sẵn (ví dụ tương tự cách
  Unikey/OpenKey xử lý logic Telex) hoặc tự viết bộ chuyển đổi trong
  `lib/typing-engine/vietnamese.ts`. Agent tự chọn cách đơn giản nhất
  miễn đáp ứng được test case gõ dấu cơ bản (ví dụ: "as" → "á", "aw" →
  "ă", "ow" → "ơ" theo Telex).
- **Cache AI content**: bảng Supabase dùng chung (không gắn theo
  user), khoá theo `(language, topic, difficulty, length)` — chi tiết
  schema ở `phase-2-prompt.md`.
- **Rate-limit generate**: bộ đếm đơn giản, không cần hạ tầng riêng —
  chi tiết ở `phase-2-prompt.md`.
- **Lọc từ khoá**: danh sách tĩnh trong code, không gọi dịch vụ ngoài.
- Không có tính năng nào ở Phase 1-2 yêu cầu đăng nhập.

## 6. Testing & chất lượng

- Không bắt buộc coverage cao (đây là project mini), nhưng
  **Typing Core Engine** (`lib/typing-engine/`) là phần dễ lỗi nhất và
  nên có unit test cho: tính WPM/CPM đúng công thức, xử lý
  đúng/sai từng ký tự, xử lý backspace, xử lý Telex/VNI cơ bản.
- Dùng Vitest cho unit test nếu cần thêm test framework.
- Chạy `tsc --noEmit` và lint trước khi coi 1 phase là xong.

## 7. Quy ước Git

- Commit theo Conventional Commits: `feat:`, `fix:`, `chore:`,
  `test:`, `docs:`.
- Mỗi phase nên có commit history rõ ràng, tách theo từng phần việc
  nhỏ thay vì 1 commit khổng lồ cho cả phase.

## 8. Cách agent nên làm việc

1. Trước khi code phase được giao, đọc "Tiêu chí hoàn thành" trong file
   prompt của phase đó và xác nhận hiểu đúng phạm vi.
2. Nếu có quyết định kỹ thuật không được nêu rõ, agent tự đề xuất
   phương án đơn giản nhất phù hợp với ràng buộc ở mục 1-5, **nêu rõ
   giả định** trong tóm tắt cuối phase — không dừng lại chờ hỏi trừ khi
   ảnh hưởng đến kiến trúc tổng thể (ví dụ: đổi tech stack, đổi mô
   hình database).
3. Sau khi xong phase: chạy test/lint, tóm tắt những gì đã làm, liệt
   kê giả định đã tự quyết định, liệt kê rủi ro/nợ kỹ thuật còn lại,
   rồi dừng chờ xác nhận trước khi nhận prompt phase kế tiếp.
4. Không thêm tính năng ngoài phạm vi phase hiện tại, kể cả khi có vẻ
   liên quan đến phase sau.

## Danh sách các phase

- `phase-0-prompt.md` — Data & Content Foundation
- `phase-1-prompt.md` — Core Typing Engine (MVP)
- `phase-2-prompt.md` — AI Content Generation
- `phase-3-prompt.md` — User Experience (Optional Login)
- `phase-4-prompt.md` — AI Personalization
