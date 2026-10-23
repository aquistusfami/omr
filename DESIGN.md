# Design

Ghi lại hệ thống thị giác của bản dựng hiện tại, không phải một đề xuất. Nguồn sự thật cho token
là `web/src/styles.css`; tài liệu này nói *vì sao* các con số đó như vậy.

## Thế giới

Máy đo cầm tay, không phải trang web. Người dùng đang làm việc: tay nhấc phiếu, mắt liếc điện thoại
cách một mét. Vì vậy màn hình có đúng một việc: nói trạng thái đọc. Trạng thái chiếm cả bề ngang và
đổi cả viền khung ngắm; mọi thứ khác rút về đường ray mảnh hoặc nằm dưới màn hình đầu.

Điều bị từ chối: bố cục "tiêu đề lớn → banner → danh sách thẻ", nơi trạng thái chỉ là một khối
ngang hàng với các khối khác. Không dùng card, không lồng card, không gradient chữ, không icon emoji.

## Màu

Hai theme, người dùng chọn; mặc định theo `prefers-color-scheme`. Nền tối không dùng đen tuyệt đối.

| Token | Sáng | Tối | Dùng cho |
|---|---|---|---|
| `--ground` | `#eef1ec` | `#0e1310` | nền trang (trung tính lệch lục) |
| `--surface` | `#ffffff` | `#161c17` | nút phụ, vùng nổi |
| `--ink` | `#10150f` | `#e9eee6` | chữ chính, nút chính (đảo màu) |
| `--ink-2` | `#4a5246` | `#a6afa2` | chữ phụ, chú thích |
| `--line` | `#d5dbd0` | `#2a3229` | đường kẻ 1 px |
| `--accent` | `#16574a` | `#7cd3bc` | focus ring, chọn text |
| `--ok` | `#0b6b36` | `#63d08d` | viền khung khi đã nhận |
| `--ok-wash` / `--ok-ink` | `#e3f2e8` / `#075429` | `#122a1b` / `#a7ecbf` | nền và chữ dải "đã nhận" |
| `--bad` | `#a82a1d` | `#ff9e90` | viền khung khi từ chối |
| `--bad-wash` / `--bad-ink` | `#fbe8e5` / `#7e1f15` | `#2b1613` / `#ffc4ba` | nền và chữ dải "đặt lại" |

Đo tương phản thực tế (WCAG 2.1, công thức sRGB): chữ chính 16.2:1 (sáng) / 15.9:1 (tối);
chữ phụ 7.1:1 / 8.3:1; chữ trên dải trạng thái 7.9:1 / 11.2:1. Tất cả trên ngưỡng 4.5:1.

Màu trạng thái **luôn đi kèm câu chữ**, không bao giờ chỉ dựa vào màu.

## Chữ

Stack hệ thống (`ui-sans-serif, system-ui, …`), không tải font ngoài: app phải chấm được khi phòng
thi không có mạng, và 60 kB font không đáng cho một công cụ. Số dùng `font-variant-numeric:
tabular-nums` để bộ đếm không nhảy bề ngang.

| Vai | Cỡ / đậm |
|---|---|
| Dải trạng thái | 25 px / 650, line-height 1.15 (28 px ở ≥720 px) |
| Bộ đếm phiếu | 24 px / 700 |
| Nút | 16 px / 600 |
| Chữ thân, nhãn | 15 px / 400–600 |
| Chú thích, trạng thái phụ | 12–13 px |
| Đáp án trong danh sách | 12 px mono |

## Khối

- `.rail` — 56 px, tên app trái, bộ đếm + nút theme phải, kẻ 1 px dưới.
- `.stage` — khung ngắm, nền `#0a0d0a` ở cả hai theme, `aspect-ratio` lấy từ luồng video thật,
  viền trong 3 px mang màu trạng thái (`box-shadow: inset`), khung nét đứt là gợi ý vị trí phiếu.
- `.banner` — dải trạng thái, cao tối thiểu 84 px, chữ căn giữa, nền `--state-wash`, kẻ 1 px
  `--line`. Ở trạng thái `wait` nền là `--surface` để dải vẫn đọc ra là một khối, không phải chữ trôi.
- `.last` — một dòng chi tiết phiếu vừa nhận (MSV · đề · số ô cần xem · trùng).
- `.controls` — hai nút 52 px chia đôi bề ngang; nút đang bật có chấm tròn `::before`.
- `.utility` — bốn hành động nhỏ kiểu chữ có gạch chân mảnh; "Xoá hết" đẩy sang phải, chỉ đỏ khi hover.
- `.row` — hàng dữ liệu, không phải card: kẻ 1 px trên/dưới, không bo góc, không nền. Lưới ba cột
  `1fr auto auto`: đầu hàng (MSV · đề · giờ) | điểm | nút xoá, nên điểm luôn thẳng cột dù đầu hàng dài.
- `.panel` — `<details>` gấp lại được cho "Đáp án & điểm": một đường viền 14 px, không đổ bóng,
  phần thân là lưới 1 cột; ô nhập dùng `--ground` để tách khỏi nền `--surface`.
- `.score` — điểm của phiếu, đẩy sang phải hàng dữ liệu, chữ đậm + số tabular.

Bán kính: 14 px cho nút và dải, 16 px cho khung ngắm, 10 px cho nút icon. Hàng dữ liệu bo 0.

## Chuyển động

Một nhịp duy nhất: `cubic-bezier(0.16, 1, 0.3, 1)`, 180 ms cho màu nền/viền, 220 ms cho bộ đếm
(trượt lên 0.35em + mờ dần). Không hiệu ứng lặp, không bounce. `prefers-reduced-motion` tắt hết.

## Trạng thái

`body[data-state]` là nguồn duy nhất: `wait` (mặc định, nền `--surface`), `ok`, `bad`. CSS suy ra màu dải,
viền khung và màu chữ từ đó, nên chỉ cần đổi một thuộc tính khi logic đổi trạng thái.

Nhãn cố định: "Đưa phiếu vào khung" · "Đang đọc…" · "Đã nhận — nhấc phiếu ra" ·
"Mờ hoặc lệch — đặt lại" · "Thiếu dấu góc — đặt lại" · "Không đọc được phiếu".

## Chưa làm

- Chưa chụp trên điện thoại thật. Giao diện đã được dựng bằng Firefox headless ở 360×844 và
  390×844, cả hai theme, với dữ liệu mẫu — đủ để bắt lỗi bố cục, chưa đủ để nói về cảm giác trên máy.
- `.impeccable/design.json` chưa ghi; token ở trên và trong `styles.css` là nguồn duy nhất.
