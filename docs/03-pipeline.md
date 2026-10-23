# Thuật toán

Toàn bộ nằm trong `web/src/`. Mỗi bước dưới đây ghi rõ file, ngưỡng và lý do.

## 1. Giải mã ảnh

`main.ts → toGray()`. `createImageBitmap` (tôn trọng EXIF), vẽ xuống canvas với cạnh dài ≤ **1800 px**,
chuyển xám theo `0.299R + 0.587G + 0.114B`.

1800 px là đủ: ô tròn 4.2 mm khi đó rộng ~30 px, mép ô ~2 px. Lớn hơn chỉ tốn thời gian.

## 2. Dò dấu góc và nắn phối cảnh

`anchors.ts → findAnchors()`, chạy trên ảnh thu về **800 px** cho nhanh.

| Bước | Ngưỡng | Vì sao |
|---|---|---|
| Nhị phân | Otsu × 0.9, sàn 60 | Tự thích nghi ảnh sáng/tối; nhân 0.9 để ăn cả nét xám do in mờ |
| Thành phần liên thông | flood fill 4 hướng, lặp (không đệ quy) | Ảnh 800 px ≈ 0.6 M px, chạy <20 ms |
| Lọc dấu | cạnh ≥1.1% và ≤8% chiều rộng, `fill ≥ 0.86`, vuông trong 25% | Ô tròn đã tô có `fill ≈ 0.785` (π/4) nên bị loại; dấu vuông ≈ 1.0. Đây là điểm phân biệt quan trọng nhất |
| Khởi tạo | hộp bao của **tất cả** dấu, bỏ 1 outlier mỗi phía | Không phụ thuộc 4 dấu cụ thể; một dấu bị cắt khỏi khung vẫn fit được |
| Khớp | 3 lượt, dung sai 8% → 5% → 3.5% chiều rộng | Lượt đầu là affine gần đúng, các lượt sau siết dần; mỗi lượt fit lại bình phương tối thiểu |
| Fit cuối | bình phương tối thiểu trên toạ độ ảnh gốc | Nắn bằng đa điểm, không chỉ 4 điểm |
| Chấp nhận | dùng ≥70% số dấu **và** RMS ≤0.25% chiều rộng ảnh | Fit xấu mà vẫn đọc thì nguy hiểm hơn từ chối |

`quadOrder()` chỉ dùng để mô tả 4 cực trị (TL = min x+y, BR = max x+y, TR = max x−y, BL = min x−y).

### Vì sao ảnh xoay 90° bị loại

Bố cục dấu không đối xứng, nên xoay 90° sẽ khớp 4 góc vào sai vị trí và các dấu còn lại lệch
xa → RMS vọt lên → từ chối. Không cần code riêng cho xoay.

## 3. Nắn về canvas

`image.ts → warp()`. Ảnh ra: `1000 × 961` đơn vị × **1.5 px/đơn vị** = 1500 × 1442.
Lấy mẫu song tuyến; điểm ra ngoài ảnh gốc = trắng.

## 4. Lấy mẫu ô

`grade.ts → blockValues()`. Mỗi ô: trung bình xám trong đĩa bán kính
`0.75 × bán kính ô` = 0.375 × 19.82 = **7.4 đơn vị** (≈11 px sau nắn).

0.75 là mức lớn nhất còn nằm trong lòng ô: viền ô ở bán kính 1.0, nét in ~0.15. Lấy rộng hơn sẽ
dính viền và ô trống cũng thành "đậm".

## 5. Phân loại

`grade.ts → classify()`. Đầu vào là **các phương án của cùng một câu** (4 đáp án, 10 chữ số, hoặc
2 ô Đúng/Sai). So sánh **tương đối trong câu**, không dùng ngưỡng tuyệt đối — nhờ vậy ảnh tối,
lệch sáng, chụp bằng máy khác nhau đều cho cùng kết quả.

```
đậm_nhất  < 0.7 × nhạt_nhất   → có mực, ngược lại: để trống
khoảng_cách ≥ max(20, 10% × nhạt_nhất)  → chọn ô đậm nhất
ngược lại (có mực nhưng không phân biệt) → "multi" (tô nhiều ô)
```

- `0.7`: một nét bút chì nhạt vẫn tối hơn giấy rõ rệt; nhiễu cảm biến thì không.
- `max(20, 10%)`: 20 mức xám là mức tối thiểu để gọi là khác nhau; 10% để ảnh tối không bị
  ngưỡng tuyệt đối bóp méo.
- Không có trường hợp "đoán": tô nhiều hay mờ đều thành cờ, không thành đáp án.

## 6. Cờ và từ chối

| Tình huống | Kết quả |
|---|---|
| Không thấy dấu / fit lệch | `ok=false`, `reason="anchors" \| "quality"` → chụp lại |
| Ô trống | cờ `:blank`, giá trị `""` |
| Tô ≥2 ô | cờ `:multi` |
| Có mực nhưng không phân biệt | cờ `:multi` (cùng nhánh) |
| Mã sinh viên trống ở một vị trí | hiện `?` trong CSV |

Cờ **không** chặn việc xuất CSV. Giáo viên xem cờ trước, sửa trong Excel (M2 sẽ cho sửa trong app).

## 7. Chỉnh ngưỡng

Tất cả nằm ở `classify()` và `findAnchors()`. Nguyên tắc:

- Nới `fill` của dấu (<0.86) → nhận thêm dấu nhưng có nguy cơ nhận cả ô đã tô.
- Nới dung sai khớp → chấm được ảnh nghiêng nhiều hơn nhưng dễ khớp sai dấu.
- Giảm `0.7` → nhận cả vết bẩn nhạt; tăng → bỏ sót bút chì mờ.
- Giảm `max(20, 10%)` → tách được nét rất nhạt nhưng bắt đầu chia đôi nhiễu.

Sau **mỗi** thay đổi: chạy `make_fixtures.py --count 30` và so số ô sai. Xem AGENTS.md.

## 8. Chế độ hỏng đã biết

| Hiện tượng | Nguyên nhân | Xử lý |
|---|---|---|
| Nhiều cờ `:blank` | Bút chì quá nhạt, hoặc tô bằng bút bi mực xanh nhạt | Yêu cầu 2B, tô kín; hoặc hạ `0.7` xuống 0.62 sau khi đo trên phiếu thật |
| `:multi` hàng loạt | Tô nhầm ô, hoặc ô bị bẩn | Đúng là phải xem tay |
| Từ chối `quality` | Phiếu cong, chụp nghiêng, thiếu dấu góc | Đặt phẳng, chụp đủ 4 góc |
| Đọc đúng nhưng lệch 1 ô ở nửa dưới | Phiếu bị cong (gáy vở, mép bàn) | Nắn theo từng khối (roadmap M3); trước mắt: miết phẳng phiếu |
| Lệch toàn bộ | In "fit to page" khác tỉ lệ ở một số phiếu, hoặc trộn 2 máy in | In lại đúng 100%, một máy in |

Hiện chỉ dùng **một** homography cho toàn trang. Với phiếu đặt phẳng thì dư; nếu gặp cong thật,
nâng cấp là: dùng 19 dấu nhỏ làm mốc cục bộ, mỗi khối nắn theo dấu gần nó nhất.

## 9. Hiệu năng

38 ms/phiếu trong Node ở ảnh 1400 px (ảnh 1800 px ~60 ms). Trên điện thoại tầm trung dự kiến
150–400 ms. 500 phiếu ⇒ 2–4 phút tính toán; thời gian còn lại là chụp và căn phiếu.

## 10. Quét tự động

`web/src/scan.ts` là máy trạng thái thuần (không đụng DOM, có test riêng). Mỗi ~220 ms lấy một
khung hình, chấm, rồi đẩy kết quả vào `Scanner`:

```
idle ──đọc được──▶ settle ──hai lần khớp sau ≥350 ms──▶ cooldown
  ▲                   │                                      │
  └──2 khung không thấy dấu◀─────────────────────────────────┘
      4 khung có dấu nhưng không đọc được ⇒ "reject" một lần, sang cooldown
```

Ba tham số, đổi ở constructor:

| Tham số | Mặc định | Ý nghĩa |
|---|---|---|
| `settleMs` | 350 | hai lần đọc phải cách nhau ít nhất chừng này mới tin là phiếu đứng yên |
| `badFramesNeeded` | 4 | ~0,9 s có dấu góc nhưng fit hỏng thì mới báo đỏ (tránh báo khi đang đặt phiếu) |
| `emptyFramesNeeded` | 2 | phải thấy 2 khung không có dấu mới cho phép nhận phiếu tiếp |

Hai lần đọc "khớp" = mã SV, mã đề và **mọi** đáp án giống nhau (`sameAnswers()`); chất lượng
ảnh có thể khác. Nhờ vậy một khung bị nhoè giữa chừng không tạo ra kết quả nửa vời.

Điều quan trọng nhất: sau khi nhận, `cooldown` chặn mọi lần nhận tiếp cho đến khi phiếu được
nhấc ra. Đây là thứ duy nhất khiến "treo điện thoại và đặt phiếu" không sinh ra 20 dòng cho một
phiếu. Đừng bỏ.
