# 07 — Chạy trên máy tính (hub nội bộ)

Điện thoại là thứ duy nhất chấm được phiếu (có camera), nhưng nơi làm báo cáo là máy
tính. Tài liệu này mô tả cách đưa dữ liệu sang máy tính **trong cùng mạng LAN, không
qua internet**, và những gì được/không được bảo vệ.

## 1. Sơ đồ

```
 điện thoại (trình duyệt)                    máy tính (1 tiến trình Node)
 ┌───────────────────────────┐              ┌──────────────────────────────┐
 │ app: quét phiếu           │  https LAN   │ tools/hub.mjs                │
 │ indexDB: nguồn sự thật    │ ───────────► │  GET  /            (app)     │
 │ hàng đợi: chưa gửi        │  POST /api/  │  POST /api/sheets   (token)  │
 └───────────────────────────┘              │  POST /api/key      (token)  │
                                            │      │                       │
                                            │      ▼                       │
                                            │ data/omr/sheets.jsonl        │
                                            │ data/omr/thumbs/<uid>.jpg    │
                                            │ data/omr/key.json            │
                                            └──────────────┬───────────────┘
                                                           │
                                              tools/report.py → bao-cao.xlsx
```

Không có bước nào gọi ra internet. Máy tính không mở cổng nào khác ngoài cổng hub
(mặc định 8443), và chỉ trong LAN.

## 2. Chạy

```bash
cd web
npm run build          # một lần, hoặc sau mỗi lần sửa code
npm run hub            # in ra link cho điện thoại
```

Hub in ra:

```
  Mở trên điện thoại:  https://192.168.1.89:8443/?t=d2936d17fde5
  Dữ liệu lưu tại:     /home/.../omr/data/omr
```

Mở đúng link đó trên điện thoại (có `?t=`). Mã kết nối được lưu vào trình duyệt điện
thoại và bị xoá khỏi thanh địa chỉ ngay, nên lần sau chỉ cần mở `https://<ip>:8443/`.

- **iPhone/Safari** sẽ cảnh báo chứng chỉ ("This Connection Is Not Private") vì chứng chỉ
  tự ký: bấm *Show Details → visit this website*. Phải làm bước này thì trình duyệt mới
  cho phép mở camera. Cảnh báo sẽ lặp lại mỗi lần mở tab mới.
- Chứng chỉ phải chứa **đúng địa chỉ IP** trong `subjectAltName`, nếu không iPhone từ chối
  thẳng (không hiện nút "tiếp tục", trang quay mãi). Hub tự tạo lại chứng chỉ khi IP máy tính
  đổi — nếu vừa đổi wifi mà điện thoại không vào được, xoá `data/omr/.cert.json` rồi chạy lại.
- **Android/Chrome**: *Advanced → Proceed*.
- Chứng chỉ được tạo một lần và lưu ở `data/omr/.cert.json`, nên không phải chấp nhận lại
  sau mỗi lần khởi động hub (trừ khi đổi IP máy tính).

## 3. Đồng bộ hoạt động thế nào

- Mỗi phiếu chấm xong được ghi vào IndexedDB **trước**, rồi mới đẩy lên hub. Trạng thái
  `sent` chỉ bật khi hub trả `200`.
- Mất wifi, tắt máy tính, hết pin: phiếu vẫn nằm trong điện thoại; lần sau mở app hoặc
  chấm xong phiếu kế tiếp, hàng đợi tự gửi lại theo thứ tự cũ (20 phiếu mỗi lượt).
- Mỗi phiếu có `uid` sinh một lần. Hub nhớ các `uid` đã nhận nên gửi lại không tạo dòng
  trùng — kể cả khi hub khởi động lại (nó đọc lại `sheets.jsonl` khi bật).
- Dòng trạng thái dưới danh sách hiện `đã gửi 37/40` khi trang đang chạy từ hub.
- Đáp án + trọng số điểm cũng được gửi (POST `/api/key`) mỗi khi sửa, để `report.py` tính
  điểm giống hệt app.

Phiếu **bị từ chối** cũng được gửi (để biết còn tờ nào chưa chấm được).

## 4. Báo cáo

```bash
python3 tools/report.py                       # data/omr → data/omr/bao-cao.xlsx
python3 tools/report.py --dir data/omr -o /tmp/bao-cao.xlsx
# nếu máy chưa có openpyxl:
uv run --with openpyxl python3 tools/report.py
```

File Excel có 4 sheet:

| Sheet | Nội dung |
|---|---|
| `Danh sach` | 49 cột: giờ, mã SV, mã đề, từng đáp án, điểm, số câu đúng, trùng mã SV, cờ cần xem |
| `Phong diem` | số phiếu theo từng khoảng 1 điểm, điểm TB, trung vị, cao/thấp nhất |
| `Theo ma de` | số phiếu, điểm TB, cao/thấp nhất, số ô cần xem cho mỗi mã đề |
| `Nghi van` | phiếu bị từ chối / có cờ / trùng mã SV, kèm đường dẫn ảnh `thumbs/<uid>.jpg` |

Điểm **không được lưu** trong dữ liệu; `report.py` tính lại từ `key.json` mỗi lần chạy.
Sửa đáp án rồi chạy lại là toàn bộ điểm đổi theo.

## 5. Bảo mật: được gì và không được gì

Giả định: 500 phiếu là dữ liệu cá nhân của học sinh, không được ra ngoài.

**Đã chặn**

| Nguy cơ | Cách chặn |
|---|---|
| Người khác trong cùng wifi mở link, đọc bài | Không có endpoint đọc dữ liệu. Chỉ `GET /api/health` trả `{ok,count}`, không có nội dung phiếu. |
| Người khác gửi phiếu rác / ghi đè | Mọi lệnh ghi cần `Bearer <token>` 48 bit sinh ngẫu nhiên mỗi lần cài; sai 5 lần/phút thì chặn IP đó (429). |
| Nghe lén trên wifi trường | HTTPS với chứng chỉ tự ký. |
| Ghi ra ngoài thư mục dữ liệu | `uid` phải khớp `[a-z0-9-]{8,64}`, tên file do hub tự đặt, không nhận đường dẫn từ điện thoại. |
| Gửi quá lớn / làm treo hub | Body tối đa 3 MB, trả 413. |
| Máy khác nhúng app vào iframe để lừa bấm | `X-Frame-Options: DENY`, `nosniff`, `no-referrer`. |
| Điện thoại gửi trùng | `uid` + tập đã nhận, ghi nối thêm `sheets.jsonl` (append) nên không mất dòng cũ. |
| Dữ liệu đi ra internet | Không có mã nào trong `web/src` gọi `fetch` ra ngoài origin (chỉ `/api/...` cùng origin). |

**Chưa chặn (phải tự lo)**

- **Ai có token thì ghi được.** Token in ra terminal; đừng chụp màn hình gửi nhóm lớp.
- **Máy tính đang mở khoá** thì người cầm máy đọc được `data/`. Không mã hoá ổ đĩa là
  quyết định có ý thức: mã hoá file mà khoá nằm cạnh file thì chỉ là hình thức. Muốn chắc
  thì bật mã hoá ổ đĩa của hệ điều hành.
- **Điện thoại**: IndexedDB đọc được nếu mở khoá máy + vào phần dữ liệu trang web. Dùng
  máy riêng, có mã khoá.
- **File Excel xuất ra** là bản sao đầy đủ. Đừng để trong thư mục đồng bộ cloud nếu không
  muốn nó lên cloud.
- **Mất điện thoại** = mất ảnh phiếu và dữ liệu chưa gửi. Hub giảm rủi ro này xuống gần
  bằng 0 vì mỗi phiếu lên máy tính ngay.

**Dọn sau đợt chấm**: `data/omr` (dữ liệu gốc) và `bao-cao.xlsx` (bản sao) — chuyển vào ổ
riêng hoặc xoá theo quy định của trường; trên điện thoại bấm **Xoá hết** sau khi đã xác
nhận `đã gửi N/N`.

## 6. LAN không dùng được: xuất gói .zip

Không phải lúc nào điện thoại cũng thấy được máy tính (wifi trường bật cách ly thiết bị, dùng
4G, hoặc trình duyệt trong app chat từ chối chứng chỉ tự ký). Khi đó bỏ hub, dùng gói:

1. Trên điện thoại bấm **Gói .zip** (hàng nút dưới nút quét). File `omr-2026-10-24.zip` chứa
   `sheets.jsonl`, `key.json` và `thumbs/<uid>.jpg` — **đủ để làm báo cáo, kèm cả ảnh phiếu**.
2. Gửi file sang máy tính bằng cách bạn thích (Zalo, Drive, AirDrop, cáp). Nút này dùng bảng
   chia sẻ của hệ điều hành nếu có, không thì tải xuống.
3. Trên máy tính:

```bash
python3 tools/report.py --dir omr-2026-10-24.zip -o bao-cao.xlsx
```

`report.py` tự giải nén cạnh file báo cáo (thư mục `bao-cao-data/`) để đường dẫn ảnh trong sheet
`Danh sach`... `Nghi van` vẫn mở được.

Gói này cũng là **bản lưu trữ** của một buổi chấm: một file, mở được bằng `unzip`, không phụ
thuộc app hay database của điện thoại. Nên xuất cuối mỗi buổi dù có dùng hub hay không.

## 7. Khi không có máy tính

App vẫn chạy độc lập (mở từ GitHub Pages hoặc `npm run dev`) và lưu trong điện thoại.
Khi đó dùng **CSV / Excel / JSON** trong hàng nút để mang dữ liệu đi, và không có
`report.py`. Panel "Gửi về máy tính" tự ẩn khi trang không được phục vụ bởi hub.

## 8. Giới hạn đã biết

- Điện thoại phải **cùng wifi** với máy tính. Nhiều router bật "client isolation" (cách ly
  thiết bị) hoặc tách băng tần 2.4/5 GHz thành hai mạng — khi đó điện thoại không thấy máy
  tính dù cả hai đều "có mạng". Đây là nguyên nhân số một của "mở link quay mãi".
- Hub là một tiến trình Node chạy tay; không có dịch vụ nền, không tự khởi động lại. Tắt
  terminal là tắt hub (dữ liệu đã ghi vẫn còn).
- Không có xác thực người dùng, không có nhiều tài khoản: một lớp = một lần chạy.
- Chứng chỉ tự ký khiến iPhone cảnh báo mỗi tab mới. Cách sạch hơn là dùng chứng chỉ do
  một CA nội bộ tin cậy phát hành, nhưng phải cài profile — không đáng cho một buổi chấm.
- `report.py` cần `openpyxl`; máy này chỉ có qua `uv run --with openpyxl`.
