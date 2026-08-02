# Phase 0 — Data & Content Foundation

> Đọc `project-brief.md` trước, đặc biệt mục 2 (cấu trúc thư mục) và
> mục 5 (nguyên tắc kỹ thuật). Prompt này chỉ chứa phạm vi riêng của
> Phase 0.

## Mục tiêu

Chuẩn bị dữ liệu tĩnh để Phase 1 hoạt động độc lập, không phụ thuộc AI.

## Vị trí file (bắt buộc)

Tạo đúng 6 file trong `data/`:

```
data/words-en.json
data/words-vi.json
data/sentences-en.json
data/sentences-vi.json
data/paragraphs-en.json
data/paragraphs-vi.json
```

## Schema JSON (bắt buộc theo đúng field name)

Word list:
```json
{ "language": "en", "words": ["the", "of", "..."] }
```

Sentence bank:
```json
{ "language": "en", "sentences": ["Câu ví dụ...", "..."] }
```

Paragraph bank:
```json
{ "language": "en", "paragraphs": ["Đoạn văn ví dụ...", "..."] }
```

`language` là `"en"` hoặc `"vi"` tương ứng file.

## Số lượng tối thiểu (bắt buộc cho bản dùng thật, không phải demo)

| Loại | Tối thiểu mỗi ngôn ngữ |
|---|---|
| Words | 300 |
| Sentences | 100 |
| Paragraphs | 30 |

Nếu vì lý do nào đó không đạt được số lượng này ở lần chạy đầu, phải
nêu rõ trong tóm tắt cuối phase và số lượng thực tế đã tạo.

## Yêu cầu chất lượng nội dung

- Sentences và paragraphs phải là **nội dung tự viết mới**, không copy
  nguyên văn từ sách/báo/bài viết có bản quyền.
- Đa dạng độ dài câu (ngắn/trung bình/dài) để sau này dễ map sang khái
  niệm Difficulty ở Phase 2 (không cần gắn field difficulty ở Phase 0,
  chỉ cần đa dạng để dùng được).
- Word list ưu tiên từ thông dụng tần suất cao (không cần từ hiếm/từ
  chuyên ngành).
- Tiếng Việt: câu/đoạn dùng dấu câu và dấu thanh chuẩn, không viết tắt
  kiểu teencode.

## Việc cần làm

- Tạo 6 file theo đúng vị trí và schema ở trên.
- Viết 1 script hoặc unit test đơn giản kiểm tra: mỗi file JSON hợp lệ,
  đúng field bắt buộc, đủ số lượng tối thiểu.

## Tiêu chí hoàn thành

- [ ] Đủ 6 file đúng vị trí, đúng schema.
- [ ] Đạt số lượng tối thiểu ở bảng trên (hoặc nêu rõ lý do nếu chưa
      đạt).
- [ ] Có thể chạy Words / Sentences / Paragraph mode cho cả English và
      Tiếng Việt chỉ bằng dữ liệu tĩnh, không gọi AI.
- [ ] Script/test kiểm tra JSON hợp lệ chạy pass.

## Khi hoàn thành

Tóm tắt: số lượng entry thực tế mỗi file, nguồn gốc dữ liệu (tự viết
hay tổng hợp từ đâu), và bất kỳ rủi ro/nợ kỹ thuật nào. Dừng lại chờ
xác nhận trước khi nhận `phase-1-prompt.md`.
