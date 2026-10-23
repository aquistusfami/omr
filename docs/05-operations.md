# Vận hành: chấm 500 phiếu

Dành cho người chấm, không cần biết code.

## Trước buổi thi

1. **In phiếu** theo `docs/04-sheet-layout.md`. Đo dấu góc tờ đầu và tờ cuối.
2. **Chuẩn bị chỗ chấm**: một mặt bàn phẳng, một đèn bàn hoặc cửa sổ chiếu sáng đều, không nắng
   trực tiếp. Tránh bóng người chấm đổ lên phiếu.
3. **Giá đỡ điện thoại**: tripod/kẹp bàn 50–100k, hoặc chặn 4 cuốn sách. Điện thoại song song
   mặt bàn, cách phiếu **30–40 cm**, phiếu chiếm ~80% khung hình và **thấy đủ 4 dấu góc**.
   Chụp bằng tay không giá đỡ được, nhưng tỉ lệ phải chụp lại sẽ tăng.
4. **Chạy thử 10 phiếu** đã tô sẵn, có đáp án biết trước. Nếu sai một ô nào, dừng lại: xem
   `docs/03-pipeline.md` mục "Chế độ hỏng đã biết" trước khi chấm thật.
5. Cắm sạc hoặc mang pin dự phòng. Chấm 500 phiếu liên tục rất tốn pin và màn hình sáng.

## Trình tự chấm

```
mở web (đã lưu địa chỉ)  →  bấm "Chụp phiếu"  →  chụp  →  đọc kết quả ngay
   ↳ nếu hiện "Không đọc được phiếu": đặt lại phiếu, chụp lại (không cần xoá gì)
   ↳ nếu hiện "cần xem: ...": phiếu vẫn được lưu, ghi chú lại để xem sau
```

- Giữ **thứ tự xếp phiếu** trùng thứ tự chụp. Không cần đánh số: mã sinh viên đã nằm trong kết quả.
- Mỗi phiếu ~8–10 giây kể cả căn lại. 500 phiếu ≈ **75–90 phút** cho một người; hai người chia
  đôi thì nhanh hơn nhưng phải dùng hai điện thoại và gộp CSV sau (chưa hỗ trợ gộp tự động —
  mở hai file CSV trong Excel là xong, cột `ma_sv` để đối chiếu).
- **Xuất CSV mỗi 50 phiếu.** Kết quả nằm trong bộ nhớ trình duyệt; xoá dữ liệu trang web hoặc
  chế độ ẩn danh là mất sạch. Đây là rủi ro vận hành lớn nhất, không phải thuật toán.
- Không tắt trình duyệt giữa chừng. Không dùng tab ẩn danh.

## Sau khi chụp xong

1. Xuất CSV lần cuối. Tên file có ngày.
2. Lọc cột `can_kiem_tra` khác rỗng. Mỗi dòng là một phiếu cần xem:
   - `cau7:multi` — tô nhiều ô ở câu 7.
   - `cau11.c:blank` — ý C câu 11 không tô.
   - `id[3]:blank` — chữ số thứ 3 của mã sinh viên không đọc được (`?` trong CSV).
3. Với mỗi dòng đó, mở ảnh gốc của phiếu (xem mục dưới) và sửa trực tiếp trong Excel.
4. Đối chiếu số dòng CSV với số phiếu thật. Thiếu là do có phiếu bị từ chối mà không chụp lại.

Tỉ lệ có cờ phụ thuộc bút chì và ánh sáng; thực tế nên chuẩn bị tâm thế **10–20% phiếu cần xem**.
Nếu vượt 30%, đừng cố sửa từng dòng — kiểm tra lại ánh sáng và bút chì trước.

## Ảnh gốc

App **không** lưu ảnh (xem roadmap M4). Ảnh do app camera của điện thoại tạo ra thường vẫn nằm
trong thư viện ảnh. Trước khi chấm, kiểm tra: chụp một phiếu rồi mở thư viện xem ảnh có được lưu
không. Nếu có, **giữ nguyên toàn bộ ảnh đến khi hết khiếu nại** — đó là bằng chứng duy nhất khi
một sinh viên thắc mắc.

Nếu ảnh không được lưu: dùng app camera có sẵn để chụp trước vào thư viện, rồi chọn ảnh từ thư viện
trong web (nút "Chụp phiếu" cho phép chọn ảnh có sẵn). Chậm hơn nhưng có bằng chứng.

## Khi có khiếu nại

Kết quả trong CSV chỉ là kết luận của máy. Đối chiếu theo thứ tự:

1. Ảnh gốc của phiếu đó.
2. Nếu ảnh mờ/thiếu góc: đó là lỗi chụp, phải chấm tay phiếu giấy.
3. Nếu ảnh rõ mà máy đọc sai: ghi lại mã phiếu, câu, giá trị máy đọc và giá trị đúng. Đây là dữ
   liệu để chỉnh ngưỡng — đừng chỉ sửa CSV rồi bỏ qua.

## Sai số chấp nhận

- Trên phiếu **được nhận**: không có đáp án sai (mọi ca khó đều thành cờ).
- Tỉ lệ **từ chối**: <5% là tốt, >10% là ánh sáng hoặc giá đỡ có vấn đề.
- Tỉ lệ **có cờ**: 10–20%.

Ba con số này đo trên ảnh thật, không phải ảnh giả lập. Hiện chưa có phép đo nào trên phiếu thật
(roadmap M1).
