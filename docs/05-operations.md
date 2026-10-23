# Vận hành: chấm 500 phiếu

Dành cho người chấm, không cần biết code.

## Trước buổi thi

1. **In phiếu** theo `docs/04-sheet-layout.md`. Đo dấu góc tờ đầu và tờ cuối.
2. **Chuẩn bị chỗ chấm**: một mặt bàn phẳng, một đèn bàn hoặc cửa sổ chiếu sáng đều, không nắng
   trực tiếp. Tránh bóng người chấm đổ lên phiếu.
3. **Giá đỡ điện thoại**: tripod/kẹp bàn 50–100k, hoặc chặn 4 cuốn sách. Điện thoại song song
   mặt bàn, cách phiếu **30–40 cm**, phiếu chiếm ~80% khung hình và **thấy đủ 4 dấu góc**.
   Điện thoại phải **cố định**: đây là điều kiện để chế độ quét tự động dùng được.
4. **Mở web bằng https**, không phải http. Camera trình duyệt chỉ chạy trên https; lần đầu điện
   thoại sẽ cảnh báo chứng chỉ tự ký — bấm "Nâng cao" → "Vẫn tiếp tục". Nếu không mở được camera,
   dùng "Chụp thủ công" (vẫn chấm được, chỉ chậm hơn).
5. **Nhập đáp án** (mục "Đáp án & điểm", mở sẵn khi chưa có đáp án): mỗi mã đề một dòng, gồm mã
   3 số rồi 40 ký tự — 10 đáp án A–D phần I, tiếp 30 ý Đ/S phần II. Dán thẳng từ Excel được (dấu
   tab, dấu cách, chữ thường, "Đ" đều nhận). Mặc định đúng thang của trường: **2 điểm/câu, phải đúng 100% mới có điểm** (phần
   II là cả 6 ý), tổng 30 điểm. Vẫn sửa được trọng số nếu môn khác dùng thang khác. Không có đáp
   án thì vẫn chấm và xuất được, chỉ trống cột điểm.
6. **Chạy thử 10 phiếu** đã tô sẵn, có đáp án biết trước. Nếu sai một ô nào, dừng lại: xem
   `docs/03-pipeline.md` mục "Chế độ hỏng đã biết" trước khi chấm thật.
7. Cắm sạc hoặc mang pin dự phòng. Chấm 500 phiếu liên tục rất tốn pin và màn hình sáng.

## Trình tự chấm — quét tự động

```
bấm "Quét tự động"  →  đặt phiếu vào khung  →  chờ tiếng bíp + banner xanh
   →  nhấc phiếu ra  →  đặt phiếu tiếp theo
```

- **Bíp + banner xanh** = phiếu đã được lưu xong vào máy. Chỉ nhấc phiếu khi nghe bíp.
  Banner ghi mã sinh viên, mã đề và số ô cần xem.
- Banner đỏ = chưa đọc được (mờ, lệch, thiếu dấu góc). Nhấc phiếu ra, đặt lại. Không cần bấm gì.
- Hệ thống **không nhận lại cùng một phiếu** khi nó vẫn nằm dưới camera: phải nhấc ra ít nhất
  ~0,5 giây rồi đặt phiếu khác.
- Giữ **thứ tự xếp phiếu** trùng thứ tự quét. Không cần đánh số: mã sinh viên đã nằm trong kết quả.
- Mỗi phiếu ~4 giây. 500 phiếu ≈ **35–45 phút** cho một người.

Chế độ "Chụp thủ công" dùng khi không mở được camera: bấm "Chụp phiếu", chụp, đọc kết quả ngay.
Mỗi phiếu ~8–10 giây.

- **Xuất file mỗi 50 phiếu.** Kết quả nằm trong IndexedDB của trình duyệt; xoá dữ liệu trang web
  hoặc dùng chế độ ẩn danh là mất sạch. Đây là rủi ro vận hành lớn nhất, không phải thuật toán.
- Không tắt trình duyệt giữa chừng. Không dùng tab ẩn danh. Rời tab là camera tự dừng.
- Mã sinh viên đã có trong máy mà quét lại sẽ hiện **"trùng"**: phiếu vẫn được lưu, nhưng phải
  xoá một dòng trước khi xuất file cuối.

## Sau khi chấm xong

1. Xuất lần cuối — chọn định dạng:
   - **CSV**: mở bằng Excel/Google Sheets, mỗi phiếu một dòng.
   - **Excel** (.xlsx): mở thẳng, không cần import, giữ nguyên số 0 đầu của mã sinh viên.
   - Cột `thoi_gian` ghi theo **giờ của điện thoại** (không phải UTC), dạng `2026-05-16 10:31:05`.
   - **JSON**: bản đầy đủ để lưu trữ hoặc đưa sang công cụ khác.
2. Lọc cột `can_kiem_tra` khác rỗng. Mỗi dòng là một phiếu cần xem:
   - `cau7:multi` — tô nhiều ô ở câu 7 (hoặc có mực nhưng không phân biệt được).
   - `cau11C:blank` — ý C câu 11 không tô.
   - `student_id[3]:blank` — chữ số thứ 3 của mã sinh viên không đọc được (`?` trong file).
   - `exam_code[1]:blank` — chữ số thứ nhất của mã đề không đọc được.
3. Với mỗi dòng đó, mở ảnh phiếu đã lưu trong app (xem mục dưới) và sửa trực tiếp trong Excel.
4. Đối chiếu số dòng với số phiếu thật. Dòng bị từ chối có `can_kiem_tra = REJECT:<lý do>`;
   nếu đã chụp lại phiếu đó thì **bấm "xoá" dòng đỏ trong app** trước khi xuất file cuối, không
   thì file có hai dòng cho cùng một phiếu. Cột `trung` đánh dấu các dòng cùng mã sinh viên.

Tỉ lệ có cờ phụ thuộc bút chì và ánh sáng; thực tế nên chuẩn bị tâm thế **10–20% phiếu cần xem**.
Nếu vượt 30%, đừng cố sửa từng dòng — kiểm tra lại ánh sáng và bút chì trước.

## Ảnh phiếu

App lưu **một ảnh đã nắn phẳng, rộng 900 px** cho mỗi phiếu (nằm trong IndexedDB, không nằm
trong thư viện ảnh). Ảnh này đủ để đối chiếu ô nào được tô khi có khiếu nại.

- Dung lượng: ~60 KB/phiếu, 500 phiếu ≈ 30 MB — thoải mái cho điện thoại.
- Ảnh **mất khi xoá dữ liệu trang web**. Xuất file và sao lưu trước khi xoá.
- Ảnh không có trong file CSV/Excel/JSON. Nếu cần bằng chứng lâu dài, giữ nguyên dữ liệu trình
  duyệt trên máy đã chấm cho đến khi hết khiếu nại.

## Khi có khiếu nại

Kết quả trong file chỉ là kết luận của máy. Đối chiếu theo thứ tự:

1. Ảnh phiếu đã lưu trong app của đúng dòng đó.
2. Nếu ảnh mờ/thiếu góc: đó là lỗi chụp, phải chấm tay phiếu giấy.
3. Nếu ảnh rõ mà máy đọc sai: ghi lại mã phiếu, câu, giá trị máy đọc và giá trị đúng. Đây là dữ
   liệu để chỉnh ngưỡng — đừng chỉ sửa file rồi bỏ qua.

## Sai số chấp nhận

- Trên phiếu **được nhận**: không có đáp án sai (mọi ca khó đều thành cờ).
- Tỉ lệ **từ chối**: <5% là tốt, >10% là ánh sáng hoặc giá đỡ có vấn đề.
- Tỉ lệ **có cờ**: 10–20%.

Ba con số này đo trên ảnh thật, không phải ảnh giả lập. Hiện chưa có phép đo nào trên phiếu thật
(roadmap M1).
