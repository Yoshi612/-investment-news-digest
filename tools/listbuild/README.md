# listbuild — 中古車販売会社リスト作成ツール

企業データベースのCSVを受け取ってから、Excelを出すまでの手順。

```sh
# 1) CSVを取り込み、都道府県ごとの確認キューを作る（大手・新車ディーラー・既存28社・重複は除外）
python3 tools/listbuild/ingest_db.py input/export.csv

# 2) 公式サイトを下見して、店舗数の手がかりと連絡先を集める（3秒間隔・逐次・robots.txt遵守・キャッシュあり）
#    途中で止めても、もう一度実行すれば pending のものから再開する
LISTBUILD_WORK=/path/to/cache-dir python3 tools/listbuild/verify_queue.py

# 3) needs_review の会社を人（Claude）が証拠を見て判定し、national_companies.json に追加
python3 tools/listbuild/add.py < record.json

# 4) Excelを作る
python3 tools/listbuild/build_xlsx.py output/progress/national_companies.json \
  output/中規模中古車販売会社リスト.xlsx output/progress/unverified_candidates.json
```

キューの status：`pending`（未確認）→ `needs_review`（店舗数の推定が4以上）／`likely_under5`／`no_url`（URLなし。検索で補う）／`fetch_failed`（403・503など。回避はしない）
