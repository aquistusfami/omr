# Định dạng template

`fixtures/template.json` mô tả **phiếu đang in**: 21 dấu góc + 8 khối ô + cách gán ô vào câu hỏi.
File này do `tools/build_template.py` sinh ra, **không sửa tay**.

## Hệ toạ độ canvas

Bốn dấu xa nhất của phiếu được ánh xạ vào bốn góc canvas:

```
TL (min x+y)  ────────────────  TR (max x−y)
   (0,0)                          (1000,0)
      │                              │
      │       canvas 1000 × H        │
      │                              │
   (0,H)                          (1000,H)
BL (min x−y)  ────────────────  BR (max x+y)
```

`H` lấy theo đúng tỉ lệ khung của bản in (ở phiếu hiện tại `H = 961.34`).

Hệ quả — đây là lý do chọn cách này:

- In to/nhỏ, lề rộng hẹp, khổ A4 hay A5 đều **không ảnh hưởng**: mọi toạ độ là tương đối với
  khung dấu góc.
- Chỉ **tỉ lệ khung** phải giữ nguyên. Kéo giãn không đều (in "stretch to fit" trên khổ khác
  tỉ lệ) sẽ làm sai — bước kiểm tra chất lượng sẽ bắt được và từ chối phiếu.
- 1 đơn vị canvas ≈ 0.21 mm nếu in rộng 210 mm. Ô tròn đường kính 19.82 đơn vị ≈ **4.2 mm**.

## Cấu trúc

```jsonc
{
  "schema": 1,
  "id": "ptit-15cau",
  "canvas": { "width": 1000, "height": 961.34 },
  "source": { "file": "fixtures/blank-form.png", "width": 960, "height": 891 },
  "bubble": { "diameter": 19.82, "sample_radius": 0.75 },

  "anchors": [                       // trong canvas
    { "x": 0, "y": 0, "corner": true },
    { "x": 268.4, "y": 103.9, "corner": false },
    ...
  ],
  "source_anchors": [ { "x": 31, "y": 31 }, ... ],   // cùng thứ tự, toạ độ ảnh gốc

  "blocks": {
    "student_id": { "origin": [34.86, 129.7], "pitch": [19.82, 28.42], "cols": 9, "rows": 10 },
    ...
  },

  "sections": [
    { "id": "student_id", "kind": "digits", "block": "student_id",
      "positions": 9, "labels": ["0","1",...,"9"] },
    { "id": "p1", "kind": "choice", "choices": ["A","B","C","D"],
      "questions": [ { "q": 1, "block": "p1a", "row": 0 }, ... ] },
    { "id": "p2", "kind": "truefalse", "labels": ["D","S"], "rows": 6,
      "questions": [ { "q": 11, "block": "p2a", "col": 0 }, ... ] }
  ]
}
```

### `anchors`

21 dấu in trên phiếu: 2 ô đen lớn 28 px ở hai góc trên, 19 ô nhỏ 14 px ở các mốc giữa và đáy.
`corner` chỉ để debug. Toạ độ canvas suy ra từ chính `source_anchors` qua phép biến đổi ở trên.

Khi dò, không tìm đúng 4 dấu cụ thể: lấy **hộp bao của tất cả dấu** (bỏ 1 outlier mỗi phía) làm
khởi tạo, rồi khớp lặp. Nhờ vậy một dấu bị cắt khỏi khung ảnh vẫn chấm được.

### `blocks` — lưới

Ô `(i, j)` có tâm:

```
x = origin[0] + i * pitch[0]
y = origin[1] + j * pitch[1]
```

`i` là cột (0..cols−1), `j` là hàng (0..rows−1), gốc ở trên-trái. Chỉ số tuyến tính trong khối là
`j * cols + i`.

Ô tròn trên phiếu **tiếp xúc nhau**, nên `pitch` xấp xỉ `diameter` theo phương ngang. Không có
khe hở để dựa vào — lấy mẫu ở 0.75 bán kính để không chạm viền ô.

### `sections` — gán ô vào câu hỏi

Ba loại:

**`digits`** — mã sinh viên, mã đề. Khối có `cols = số chữ số`, `rows = 10`.
Ô `(cột = vị trí chữ số, hàng = giá trị 0..9)`. Đọc từng cột, chọn hàng đậm nhất.

**`choice`** — câu A/B/C/D. Mỗi câu chiếm một hàng trong khối; ô của phương án `k` là
`(k, row)`. Ô thứ tự tuyến tính: `row * cols + k`.

**`truefalse`** — mỗi câu 6 ý A–F, mỗi ý 2 ô Đúng/Sai. Câu đặt tại cột `col`, dùng hai cột
`col` (Đúng) và `col + 1` (Sai); ý thứ `r` là hàng `r`. Vì vậy một khối 4 cột chứa 2 câu.

Ô **không được nhắc tới** trong `sections` là ô dự phòng của phiếu (ví dụ 2 hàng trống ở
PHẦN I hộp 3, 2 cột trống ở PHẦN II hộp 3). Chúng vẫn nằm trong lưới nhưng bị bỏ qua.

## Sinh lại / thêm phiếu mới

```bash
python3 tools/build_template.py
```

Mở `fixtures/template-overlay.png`: vòng xanh phải trùng khít **từng** ô, hộp đỏ phải nằm trên
từng dấu góc. Script in ra "worst bubble-to-lattice distance"; >4 px là sai.

Đổi sang phiếu khác:

1. Thay `fixtures/blank-form.png` bằng ảnh phẳng (scan/export PDF) của phiếu mới.
2. Sửa `BLOCKS` trong `tools/build_template.py`: hộp bao từng khối + số cột/hàng **theo bản in**
   (không theo số ô dò được — cột sát viền có thể bị dính vào đường kẻ).
3. Sửa `SECTIONS` cho khớp cách đánh số câu.
4. Chạy script, xem overlay, chạy `python3 tools/make_fixtures.py` rồi `cd web && npm test`.

Nếu phiếu mới không phải lưới đều (ô so le, khoảng cách khác nhau), phải đổi `blocks` sang danh
sách toạ độ tường minh — chưa hỗ trợ, và cũng chưa cần.

## Kiểm tra tự động

`python3 tools/build_template.py --check` trả về 1 nếu `template.json` không còn khớp với
phiếu mẫu (ai đó sửa template bằng tay, hoặc đổi ảnh mà quên sinh lại).
