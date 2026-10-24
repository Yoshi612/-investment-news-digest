#!/usr/bin/env python3
"""Build 中規模中古車販売会社リスト.xlsx from companies.json.
companies.json: list of dicts with keys matching COLS (except No), plus
  "stores": [{"name":..., "pref":...}], "status": "list" | "over30" | "under5" | "excluded_type"
"""
import json, sys, re, os
from collections import Counter
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment
from openpyxl.utils import get_column_letter

COLS = ["No", "会社名（正式名称）", "店舗数（全国）", "店舗を持つ都道府県", "店舗名一覧", "本社所在地",
        "本社電話番号", "本社FAX番号", "代表者名", "公式サイトURL", "問い合わせフォームURL",
        "代表メールアドレス", "社長または会社のSNS", "買取・業販・仕入れの部署の有無", "従業員数",
        "情報の出典URL", "確度", "メモ"]
PREF_ORDER = ["北海道", "青森県", "岩手県", "宮城県", "秋田県", "山形県", "福島県", "茨城県", "栃木県", "群馬県",
              "埼玉県", "千葉県", "東京都", "神奈川県", "新潟県", "富山県", "石川県", "福井県", "山梨県", "長野県",
              "岐阜県", "静岡県", "愛知県", "三重県", "滋賀県", "京都府", "大阪府", "兵庫県", "奈良県", "和歌山県",
              "鳥取県", "島根県", "岡山県", "広島県", "山口県", "徳島県", "香川県", "愛媛県", "高知県", "福岡県",
              "佐賀県", "長崎県", "熊本県", "大分県", "宮崎県", "鹿児島県", "沖縄県"]


def row_for(c):
    stores = c.get("stores", [])
    prefs = sorted({s["pref"] for s in stores if s.get("pref")}, key=PREF_ORDER.index)
    return {
        "会社名（正式名称）": c["name"],
        "店舗数（全国）": c.get("count", len(stores)),
        "店舗を持つ都道府県": "、".join(prefs),
        "店舗名一覧": "、".join(s["name"] for s in stores),
        "本社所在地": c.get("hq", ""), "本社電話番号": c.get("tel", ""), "本社FAX番号": c.get("fax", ""),
        "代表者名": c.get("rep", ""), "公式サイトURL": c.get("url", ""),
        "問い合わせフォームURL": c.get("form", ""), "代表メールアドレス": c.get("email", ""),
        "社長または会社のSNS": "\n".join(c.get("sns", [])),
        "買取・業販・仕入れの部署の有無": c.get("dept", ""), "従業員数": c.get("employees", ""),
        "情報の出典URL": "\n".join(c.get("sources", [])), "確度": c.get("confidence", ""),
        "メモ": c.get("memo", ""),
    }


def write_sheet(ws, rows):
    ws.append(COLS)
    for i, r in enumerate(rows, 1):
        ws.append([i] + [r[k] for k in COLS[1:]])
    style(ws)


def style(ws):
    hdr = PatternFill("solid", fgColor="1F4E78")
    for cell in ws[1]:
        cell.font = Font(bold=True, color="FFFFFF")
        cell.fill = hdr
        cell.alignment = Alignment(wrap_text=True, vertical="center")
    widths = {"A": 5, "B": 30, "C": 10, "D": 22, "E": 60, "F": 36, "G": 15, "H": 15, "I": 16, "J": 30,
              "K": 30, "L": 26, "M": 40, "N": 24, "O": 12, "P": 50, "Q": 18, "R": 60}
    for col, w in widths.items():
        ws.column_dimensions[col].width = w
    for row in ws.iter_rows(min_row=2):
        for cell in row:
            cell.alignment = Alignment(wrap_text=True, vertical="top")
    ws.freeze_panes = "C2"


def main(src, out):
    data = json.load(open(src, encoding="utf-8"))
    MIN = int(os.environ.get("MIN_STORES", "3"))  # 下限（当初は5、2026-10に3へ引き下げ）
    def n(c): return c.get("count", len(c.get("stores", [])))
    inlist = lambda c: c["status"] == "list" or (c["status"] == "under5" and n(c) >= MIN)
    listed = [c for c in data if inlist(c)]
    listed.sort(key=lambda c: (-c.get("count", len(c.get("stores", []))), c["name"]))
    excluded = [c for c in data if not inlist(c)]
    excluded.sort(key=lambda c: (-c.get("count", 0), c["name"]))

    wb = Workbook()
    ws = wb.active
    ws.title = "リスト"
    write_sheet(ws, [row_for(c) for c in listed])

    s = wb.create_sheet("集計")
    s.append(["都道府県別の社数（その都道府県に店舗を持つ会社の数。1社が複数県に数えられる）"])
    pc = Counter(p for c in listed for p in {st["pref"] for st in c.get("stores", [])})
    s.append(["都道府県", "社数"])
    for p in PREF_ORDER:
        if pc.get(p):
            s.append([p, pc[p]])
    s.append([])
    s.append(["本社所在地の都道府県別の社数"])
    s.append(["都道府県", "社数"])
    hc = Counter(next((p for p in PREF_ORDER if c.get("hq", "").find(p) >= 0 or
                       (p == "大阪府" and c.get("hq", "").startswith("大阪市"))), "不明") for c in listed)
    for p in PREF_ORDER + ["不明"]:
        if hc.get(p):
            s.append([p, hc[p]])
    s.append([])
    s.append(["店舗数の分布"])
    s.append(["区分", "社数"])
    cnt = [c.get("count", len(c.get("stores", []))) for c in listed]
    for lab, lo, hi in [("3〜4店舗", 3, 4), ("5〜9店舗", 5, 9), ("10〜19店舗", 10, 19), ("20〜30店舗", 20, 30)]:
        s.append([lab, sum(lo <= n <= hi for n in cnt)])
    s.append(["合計", len(listed)])
    s.append([])
    s.append(["確度別の社数"])
    s.append(["確度", "社数"])
    for k, v in sorted(Counter(c.get("confidence", "") for c in listed).items()):
        s.append([k, v])
    s.append([])
    s.append(["要判断（メモ欄が【要判断】で始まる会社）", sum(str(c.get("memo", "")).startswith("【要判断】") for c in listed)])
    s.append(["電話番号に店舗番号等を入れた会社（番号の後ろに注記あり）", sum("（" in str(c.get("tel") or "") for c in listed)])
    s.append([])
    s.append(["出典：国税庁法人番号公表サイト（国税庁）（https://www.houjin-bangou.nta.go.jp/）を加工して作成（本社所在地の一部）"])
    s.column_dimensions["A"].width = 40
    s.column_dimensions["B"].width = 10
    for r in s.iter_rows():
        for cell in r:
            if isinstance(cell.value, str) and (cell.value.endswith("社数") or cell.value in ("店舗数の分布",)
                                                or cell.value.startswith("都道府県別") or cell.value.startswith("本社所在地")):
                cell.font = Font(bold=True)

    e = wb.create_sheet("除外リスト")
    ecols = ["除外理由"] + COLS[1:]
    e.append(["No"] + ecols)
    reason = {"over30": "31店舗以上", "under5": "2店舗以下", "excluded_type": "対象外の業態"}
    for i, c in enumerate(excluded, 1):
        r = row_for(c)
        e.append([i, c.get("reason") or reason.get(c["status"], c["status"])] + [r[k] for k in COLS[1:]])
    style(e)
    e.column_dimensions["B"].width = 18
    e.column_dimensions["C"].width = 30
    if len(sys.argv) > 3:
        u = wb.create_sheet("未確認候補")
        u.append(["No", "会社名・ブランド", "手がかり", "都道府県", "未確認の理由"])
        for i, c in enumerate(json.load(open(sys.argv[3], encoding="utf-8")), 1):
            u.append([i, c["name"], c.get("hint", ""), c.get("pref", ""), c.get("reason", "")])
        style(u)
        for col, w in {"B": 50, "C": 60, "D": 12, "E": 50}.items():
            u.column_dimensions[col].width = w
    wb.save(out)
    print(f"saved {out}: list={len(listed)} excluded={len(excluded)}")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
