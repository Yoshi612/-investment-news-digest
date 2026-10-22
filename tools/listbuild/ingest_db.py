#!/usr/bin/env python3
"""Load a company-database CSV export into per-prefecture verification queues.

usage: ingest_db.py export.csv [more.csv ...]

- Detects encoding (UTF-8 / CP932) and maps common column names.
- Drops large chains, dealers and companies already in national_companies.json.
- Writes output/progress/db_queue/<NN>_<pref>.json (status=pending), merging
  with any existing queue so re-running never loses verification results.
"""
import csv, io, json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
PROG = os.path.join(ROOT, "output", "progress")
QDIR = os.path.join(PROG, "db_queue")

PREFS = ["北海道", "青森県", "岩手県", "宮城県", "秋田県", "山形県", "福島県", "茨城県", "栃木県", "群馬県",
         "埼玉県", "千葉県", "東京都", "神奈川県", "新潟県", "富山県", "石川県", "福井県", "山梨県", "長野県",
         "岐阜県", "静岡県", "愛知県", "三重県", "滋賀県", "京都府", "大阪府", "兵庫県", "奈良県", "和歌山県",
         "鳥取県", "島根県", "岡山県", "広島県", "山口県", "徳島県", "香川県", "愛媛県", "高知県", "福岡県",
         "佐賀県", "長崎県", "熊本県", "大分県", "宮崎県", "鹿児島県", "沖縄県"]

COLS = {  # canonical key -> header substrings, first match wins
    "name": ["商号", "会社名", "企業名", "法人名", "社名"],
    "corp_no": ["法人番号"],
    "pref": ["都道府県"],
    "addr": ["本社住所", "所在地", "住所"],
    "tel": ["電話", "TEL", "Tel"],
    "fax": ["FAX", "Fax", "ファックス"],
    "url": ["URL", "Url", "ホームページ", "HP", "ウェブサイト", "Webサイト"],
    "rep": ["代表者", "代表"],
    "employees": ["従業員"],
    "sales": ["売上"],
    "offices": ["事業所数", "店舗数", "拠点数"],
    "industry": ["業種"],
}

# 31店舗以上の大手、FC本部、メーカー系ディーラーの社名パターン
BIG = ["IDOM", "イドム", "ガリバー", "ネクステージ", "WECARS", "ウィーカーズ", "ビッグモーター", "ケーユー",
       "カーチス", "グッドスピード", "BUDDICA", "バディカ", "アップルオートネットワーク", "オートバックス",
       "イエローハット", "ジー・トレーディング", "ハナテン"]
# FC本部など、社名の完全一致で除外するもの（加盟店の「横浜ユーポス」等は残す）
BIG_EXACT = ["株式会社ユーポス", "フレックス株式会社", "株式会社カーセブンデジフィールド",
             "株式会社ラビット・カーネットワーク", "株式会社ユー・エス・エス", "株式会社タックス"]
DEALER = ["トヨタ", "トヨペット", "カローラ", "ネッツ", "レクサス", "日産", "ニッサン", "プリンス", "ホンダカーズ",
          "マツダ", "スバル", "三菱自動車", "ダイハツ", "スズキ自販", "スズキアリーナ", "いすゞ", "日野自動車",
          "ふそう", "ＵＤトラックス", "UDトラックス", "ヤナセ", "BMW", "メルセデス", "フォルクスワーゲン", "アウディ",
          "ボルボ", "ポルシェ", "モビリティ"]


def norm_name(s):
    s = re.sub(r"[\s　]", "", s or "")
    s = s.replace("（株）", "株式会社").replace("(株)", "株式会社").replace("㈱", "株式会社")
    s = s.replace("（有）", "有限会社").replace("(有)", "有限会社").replace("㈲", "有限会社")
    return s


def key_name(s):
    return re.sub(r"(株式会社|有限会社|合同会社|合資会社|合名会社)", "", norm_name(s))


def read_csv(path):
    raw = open(path, "rb").read()
    for enc in ("utf-8-sig", "cp932"):
        try:
            text = raw.decode(enc); break
        except UnicodeDecodeError:
            continue
    rows = list(csv.reader(io.StringIO(text)))
    head, body = rows[0], rows[1:]
    idx = {}
    for k, subs in COLS.items():
        for i, h in enumerate(head):
            if i not in idx.values() and any(s in h for s in subs):
                idx[k] = i; break
    missing = [k for k in ("name", "addr") if k not in idx]
    if missing:
        sys.exit(f"{path}: 必須列が見つかりません {missing}。見出し: {head}")
    print(f"{os.path.basename(path)}: {len(body)}行, 列対応 { {k: head[i] for k, i in idx.items()} }")
    for r in body:
        yield {k: (r[i].strip() if i < len(r) else "") for k, i in idx.items()}


def pref_of(rec):
    for src in (rec.get("pref", ""), rec.get("addr", "")):
        for p in PREFS:
            if src.startswith(p) or (p == "東京都" and src.startswith("東京")):
                return p
    return "不明"


def main(paths):
    os.makedirs(QDIR, exist_ok=True)
    known = set()
    nf = os.path.join(PROG, "national_companies.json")
    if os.path.exists(nf):
        known = {key_name(d["name"]) for d in json.load(open(nf, encoding="utf-8"))}
    queues, stats = {}, {"input": 0, "big": 0, "dealer": 0, "known": 0, "dup": 0, "queued": 0}
    seen = set()
    for path in paths:
        for rec in read_csv(path):
            stats["input"] += 1
            name = norm_name(rec["name"])
            if not name:
                continue
            k = key_name(name)
            if any(b in name for b in BIG) or name in BIG_EXACT:
                stats["big"] += 1; continue
            if any(d in name for d in DEALER):
                stats["dealer"] += 1; continue
            if k in known:
                stats["known"] += 1; continue
            dkey = rec.get("corp_no") or (k + "|" + re.sub(r"\D", "", rec.get("tel", "")))
            if dkey in seen:
                stats["dup"] += 1; continue
            seen.add(dkey)
            rec["name"] = name
            rec["status"] = "pending"
            p = pref_of(rec)
            queues.setdefault(p, []).append(rec)
            stats["queued"] += 1
    for p, recs in queues.items():
        n = PREFS.index(p) + 1 if p in PREFS else 99
        f = os.path.join(QDIR, f"{n:02d}_{p}.json")
        old = {(r.get("corp_no") or r["name"]): r for r in json.load(open(f, encoding="utf-8"))} if os.path.exists(f) else {}
        for r in recs:  # keep existing verification results
            old.setdefault(r.get("corp_no") or r["name"], r)
        json.dump(list(old.values()), open(f, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print("集計:", stats)
    print("都道府県別:", {p: len(v) for p, v in sorted(queues.items(), key=lambda x: PREFS.index(x[0]) if x[0] in PREFS else 99)})


if __name__ == "__main__":
    main(sys.argv[1:])
