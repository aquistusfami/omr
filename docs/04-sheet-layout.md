# Bố cục phiếu

Nguồn sự thật: `fixtures/blank-form.png` (960 × 891 px) và `fixtures/template-overlay.png`.

## Dấu góc

21 ô đen in trên phiếu, là mốc để nắn ảnh và kiểm tra đúng phiếu:

| Vị trí | Kích thước | Số lượng |
|---|---|---|
| Hai góc trên | 28 × 28 px (≈6 mm) | 2 |
| Hàng dưới "Mã số sinh viên"/"Mã đề thi" | 14 × 14 px (≈3 mm) | 2 |
| Hàng ngay dưới khối mã | 14 × 14 px | 2 |
| Hàng đầu PHẦN I | 14 × 14 px | 5 |
| Hàng đầu PHẦN II | 14 × 14 px | 5 |
| Hàng đáy | 14 × 14 px | 5 |

Tổng **21**. Không có dấu ở góc dưới-trái/dưới-phải cỡ lớn — hộp bao của cả 21 dấu mới là khung
chuẩn, nên đừng "sửa" phiếu bằng cách thêm dấu.

## Các khối ô

```
┌ 1. Mã số sinh viên ─────┐ ┌ 2. Mã đề thi ┐
│  9 cột × 10 hàng         │ │ 3 cột × 10   │      (hàng = chữ số 0..9, in ở lề trái)
│  90 ô                   │ │ 30 ô         │
└─────────────────────────┘ └──────────────┘

PHẦN I  (10 câu × 4 phương án = 40 ô, cộng 8 ô trống)
  hộp 1: câu 1–4     hộp 2: câu 5–8     hộp 3: câu 9–10 + 2 hàng trống

PHẦN II (5 câu × 6 ý × Đúng/Sai = 60 ô, cộng 12 ô trống)
  hộp 1: câu 11, 12   hộp 2: câu 13, 14   hộp 3: câu 15 + 2 cột trống
```

- Tổng **240 ô**: 90 mã SV + 30 mã đề + 48 PHẦN I + 72 PHẦN II.
- **220 ô có nghĩa**, 20 ô trống là phần thừa của lưới in (không được `sections` nhắc tới nên bị
  bỏ qua). Nếu thí sinh tô vào ô trống, hiện tại app không báo — chưa cần.
- Mỗi câu PHẦN II có 6 ý **A–F**, mỗi ý chọn **Đúng** hoặc **Sai**. Đây không phải dạng A/B/C/D:
  đáp án lưu thành chuỗi 6 ký tự `D`/`S`, ví dụ `"DSSDSS"`.
- Mã sinh viên là **9 chữ số**, không phải 10. Đã đối chiếu: 9 ô kẻ ở dòng 1 và 9 cột ô tròn.

## Kích thước

1 đơn vị canvas = 1/1000 chiều rộng khung dấu. Ô tròn đường kính **19.82 đơn vị**.
Nếu in khung dấu rộng 210 mm thì ô ≈ **4.2 mm**, dấu nhỏ 3 mm, dấu lớn 6 mm — đúng cỡ phiếu OMR
thông thường.

## Yêu cầu in

Đây là phần dễ hỏng nhất của cả hệ thống, và không có code nào cứu được:

1. **In đúng 100%**, không "Fit to page", không "Scale to paper size". Kéo giãn làm đổi tỉ lệ
   khung → mọi toạ độ sai → app từ chối (hoặc tệ hơn: đọc lệch một hàng).
2. **Một máy in cho cả 500 phiếu.** Trộn máy in là trộn tỉ lệ.
3. **In từ file gốc (PDF/DOCX)**, không in từ `blank-form.png` — ảnh này chỉ 960 px, in ra sẽ
   nhoè nét ô và dấu góc, làm giảm độ tương phản.
4. Giấy **mờ (matte)**, ≥80 gsm. Giấy bóng sẽ loá đèn.
5. Máy in laser cho nét đen đều hơn phun mực; nếu dùng phun mực, in thử 5 tờ và kiểm tra dấu góc
   có bị nhoè không.
6. Sau khi in, **đo khoảng cách giữa hai dấu góc trên** ở tờ đầu và tờ cuối. Phải bằng nhau.
   Nếu lệch, dừng lại và in lại.

## Kiểm tra phiếu in đạt

```bash
# 1. Chụp 3 tờ trống bằng đúng điện thoại sẽ dùng, đúng điều kiện ánh sáng
# 2. Chấm thử: app phải trả về ok=false với lý do "anchors" (không có ô nào tô)
#    nhưng anchors.used phải = 21 và residual nhỏ — nếu bị từ chối vì quality thì
#    ảnh in/ánh sáng có vấn đề.
```

Cách nhanh hơn: đặt tờ trống lên bàn, chụp, mở `template-overlay.png` cạnh ảnh chụp và so bằng
mắt — các dấu góc phải nằm cùng vị trí tương đối.

## Nếu phải thiết kế lại phiếu

Đừng. Nhưng nếu buộc phải: giữ nguyên 21 dấu góc, giữ lưới đều, chỉ đổi số câu thì sửa `SECTIONS`
trong `tools/build_template.py` là đủ (xem `docs/02-template-format.md`).
