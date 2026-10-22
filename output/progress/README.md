# 中規模中古車販売会社リスト 作業の途中経過（再開用）

- `national_companies.json` … 確認済みの会社（status: list / under5 / over30 / excluded_type）。Excelはここから生成する。
- `fc_operators.json` … アップル（275店舗）・ユーポスの本部サイトの店舗ページから取った「店舗→運営会社」の対応。
- `osaka_companies.json` … 大阪府試行版のデータ（national に取り込み済み）。
- `unverified_candidates.json` … 検索で名前が挙がったが、公式サイトで店舗数を確認できていない候補。
- `discovery/*.json` … 地域ごと・業態ごとの検索の記録（どの検索語で何が出たか）。

## 取得元とルール
- 取得したのは各社の公式サイトと、FC本部（アップル・ユーポス）の公開店舗ページだけ。
- カーセンサー・JUジャナイトは利用規約の第11条（情報の複製・転用の禁止）があるため使っていない。グーネットはこの環境から接続できない。
- 1リクエストごとに3秒以上あけ、並列アクセスはせず、robots.txt を守る。取得したHTMLはキャッシュして再取得しない。
- 機械的なアクセスを拒否（403・503）したサイトは回避せず「取得不可」として記録した：keinomori.com、carseven.co.jp、tax.co.jp、otoron.jp、flexdream.jp ほか。

## 次にやること
1. `unverified_candidates.json` の候補について、公式サイトで店舗数を確認する。
2. FC加盟店（`status=list` で出典が applenet / u-pohs のもの）について、自社サイトで他ブランドの店舗と本社情報を補う。
3. 地域別の検索を、市区町村名や業態（輸入車・トラック・キャンピングカー・自社ローンなど）の組み合わせで追加する。
