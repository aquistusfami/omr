# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Giáo viên hoặc người được phân công chấm bài trắc nghiệm, làm một mình, ngay tại bàn chấm
hoặc trong phòng thi. Mỗi buổi vài trăm phiếu (mục tiêu 500). Người dùng chỉ có một chiếc điện
thoại, không có máy scan, không có máy tính trong lúc chấm. Tay bận nhấc phiếu, mắt nhìn
điện thoại từ khoảng một mét.

## Product Purpose

Chấm phiếu trắc nghiệm đã tô bằng camera điện thoại, ngay tại chỗ, và lưu kết quả trên chính
máy đó. Thành công là chấm xong một buổi mà không phải nhập lại tay, không phải chụp lại vì
không biết máy đã nhận phiếu hay chưa, và không mất dữ liệu đã chấm.

## Positioning

Toàn bộ đường đi — tìm 4 dấu góc, hiệu chỉnh phép biến đổi phối cảnh, lấy mẫu 240 ô, phân loại —
chạy trong trình duyệt điện thoại, không gửi ảnh lên máy chủ nào. Phiếu nào không đọc chắc thì
bị từ chối kèm lý do thay vì đoán, vì một ô sai trong sổ điểm tốn hơn một lần chụp lại.

## Operating Context

- Phiếu đã in sẵn từ file gốc của trường (không được thiết kế lại). Điện thoại thường được đặt
  trên giá treo cố định, camera chĩa xuống mặt bàn; người chấm đặt phiếu vào, đợi tín hiệu, nhấc ra.
- Ánh sáng phòng học (đèn huỳnh quang), thường đủ sáng; màn hình bị nhìn nghiêng.
- Kết quả nằm trong IndexedDB của trình duyệt, gắn với địa chỉ web đang dùng. Không có máy chủ,
  không đồng bộ. Ảnh gốc không được lưu, chỉ giữ ảnh thu nhỏ 900 px của phiếu đã nhận.
- Cuối buổi xuất CSV / XLSX / JSON để làm báo cáo và đối chiếu.
- Trong phòng thi có thể không có mạng; app đã tải một lần vẫn phải chấm được.

## Capabilities and Constraints

- Phiếu: 240 ô tròn. Mã sinh viên 9 chữ số, mã đề 3 chữ số, PHẦN I 10 câu × A–D,
  PHẦN II 5 câu × 6 ý (A–F) × Đúng/Sai.
- Hình học bám theo 4 dấu góc cực trị, nên tỉ lệ in và lề giấy không quan trọng, chỉ tỉ lệ khung in.
- Ngưỡng phân loại nằm một chỗ duy nhất (`classify()`); so sánh tương đối trong từng cụm nên
  không phụ thuộc độ sáng tuyệt đối.
- Một phiếu chỉ được ghi một lần: chỉ nhận sau khi hai lần đọc cách nhau ~350 ms trùng khớp, và
  phải nhấc phiếu ra mới nhận phiếu tiếp.
- Camera trình duyệt cần https (hoặc localhost). Chế độ chụp thủ công dùng được ở nơi khác.
- Không có: nhập đáp án, tính điểm, sửa tay từng ô, chống trùng phiếu (chỉ gắn cờ trùng mã SV).
- Chưa có số liệu trên phiếu thật; mọi con số độ chính xác hiện tại đến từ ảnh tổng hợp.

## Brand Commitments

Tên hiển thị: "Chấm phiếu trắc nghiệm". Không logo, không tên trường, không màu nhận diện.
Giao diện tiếng Việt; mã nguồn và chú thích tiếng Anh.

## Evidence on Hand

- `fixtures/blank-form.png` — phiếu gốc đã in, 960×891.
- `fixtures/template.json` — hợp đồng hình học sinh ra từ phiếu đó.
- `fixtures/synthetic/*` — phiếu tổng hợp để test, không phải phiếu thật.
- Chưa có: phiếu thật đã tô, bảng điểm chấm tay, ảnh chụp bằng điện thoại thật. Không được
  tuyên bố độ chính xác trên phiếu thật cho đến khi có (mốc M1).

## Product Principles

1. Từ chối còn hơn đoán sai: mọi trạng thái mơ hồ phải nói ra và cho chụp lại.
2. Đọc được từ khoảng cách một mét, một tay, trong ba giây.
3. Không bao giờ để mất phiếu đã chấm: ghi xong mới báo "đã nhận", xuất file định kỳ.
4. Không phụ thuộc mạng, không phụ thuộc máy chủ, không thêm dependency cho việc nhỏ.

## Accessibility & Inclusion

Tương phản chữ ≥ 4.5:1, chữ lớn ≥ 3:1 (đo trên cả hai theme). Vùng chạm ≥ 48 px. Trạng thái
không chỉ phân biệt bằng màu: mỗi trạng thái luôn kèm câu chữ. Hoạt động được bằng một tay,
không cần cuộn trong lúc quét.
