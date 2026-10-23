# Kiến trúc

## Ràng buộc thật của bài toán

- 500 phiếu, một buổi thi, **chỉ có điện thoại**. Không máy scan, không đầu đọc OMR.
- Phiếu đã in sẵn, không được thiết kế lại (đã có 4 dấu góc + lưới ô).
- Người chấm là giáo viên, không phải kỹ thuật viên. Sai một câu là ảnh hưởng điểm thật.
- Không có ngân sách hạ tầng: không VPS, không GPU, không dịch vụ trả tiền.

## Quyết định

| Quyết định | Vì sao | Khi nào đổi |
|---|---|---|
| Chạy toàn bộ trên máy (PWA, không server) | Không phụ thuộc mạng, không lộ dữ liệu học sinh, không phải vận hành gì | Khi có ≥2 điện thoại cùng chấm một đợt và cần gộp kết quả |
| Tự viết CV bằng TypeScript, không OpenCV.js | Chỉ cần homography + ngưỡng + lấy mẫu đĩa: ~300 dòng. OpenCV.js là 8 MB wasm, tải chậm trên 4G, khó debug | Khi phải nhận dạng chữ viết tay hoặc phiếu cong nặng |
| Không dùng model học sâu | Bài toán tô đen ô tròn; sai số đến từ ảnh và bản in, không từ mô hình | Gần như không |
| Không framework UI | Một màn hình, 14 KB bundle | Khi thêm màn duyệt tay phức tạp (M2) |
| Template dạng lưới, không phải toạ độ từng ô | 240 ô → 8 khối × (gốc, bước). Sửa một số là xong, dễ kiểm tra bằng overlay | Khi phiếu không còn là lưới đều |
| Từ chối phiếu thay vì đoán | Một phiếu sai âm thầm tệ hơn một lần chụp lại | Không |

## Luồng

```
 ảnh điện thoại (JPEG, ≤1800 px sau khi giải mã)
        │
        ├─ anchors.ts   tìm 21 dấu góc → homography canvas → ảnh
        │               (không đủ dấu / fit xấu ⇒ từ chối, yêu cầu chụp lại)
        │
        ├─ image.ts     warp về canvas 1000 × 961 @ 1.5 px/đơn vị
        │
        ├─ grade.ts     lấy mẫu 240 ô → phân loại theo từng "đơn vị trả lời"
        │               → 52 đơn vị: 9 mã SV + 3 mã đề + 10 câu A–D + 30 ý Đ/S
        │
        └─ store.ts     localStorage  →  export.ts  →  CSV
```

Không có bước nào cần mạng. Ảnh gốc hiện **không được lưu** (xem roadmap M4 — cần cho khiếu nại).

## Mô hình dữ liệu

Một bản ghi cho mỗi phiếu (`web/src/store.ts`):

```ts
{
  id, at, ok, reason?,            // ok=false ⇒ chụp lại
  studentId: "912345678",         // 9 chữ số, "?" ở vị trí không đọc được
  examCode: "042",
  p1: { "1": "B", ..., "10": "C" },
  p2: { "11": "DSSDSS", ... },    // 6 ý A–F, D=Đúng, S=Sai, "" nếu trống/mờ
  flags: ["cau7:multi", "id[3]:blank"],
  anchors: { used: 20, residual: 0.6 }
}
```

Không có bảng `answers` riêng, không có index: 500 bản ghi ≈ 400 KB, thừa sức cho localStorage.
Khi nào cần nhiều thiết bị thì mới thêm server, và lúc đó `SheetRecord` chính là payload đồng bộ.

## Xử lý sai

Ba mức, cố ý tách bạch:

1. **Từ chối** (`ok=false`): không thấy đủ dấu góc, hoặc fit lệch >0.25% chiều rộng ảnh, hoặc
   ảnh xoay/lật. Người dùng chỉ việc chụp lại; app không đưa ra con số nào.
2. **Cờ** (`flags`): phiếu đọc được nhưng có ô trống / tô nhiều / mờ. Vẫn lưu, vẫn xuất CSV,
   nhưng giáo viên phải xem. Đây là nơi hệ thống thật sự kiếm độ chính xác.
3. **Im lặng**: ô đọc rõ. Không bao giờ suy đoán cho hai trường hợp trên.

## Phạm vi cố tình bỏ

Chấm tự luận, OCR chữ viết tay, nhận diện phách, chấm điểm theo thang của Bộ, đồng bộ nhiều
trường, phân quyền, dashboard thống kê. Cần thì làm sau, mỗi thứ đều có thể dựng trên
`SheetRecord`.
