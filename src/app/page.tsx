import styles from "./page.module.css";

const STEPS = [
  {
    title: "収集",
    body: "日本株・米国株・グローバル経済の主要RSSフィードから、直近24時間分のニュースを収集。同じ出来事を報じる重複記事はタイトルの類似度で自動的に1件へ集約する。",
  },
  {
    title: "選定・要約",
    body: "AI（Vercel AI Gateway経由）が記事群から個人投資家にとって重要度の高い上位5件を選定。詳しい要約と、今後の経済・株式市場への影響予測を生成する。",
  },
  {
    title: "配信",
    body: "毎朝6:00（日本時間）に、地域別（日本株/米国株/グローバル）に整形したメッセージをLINEへ自動配信。配信自体が失敗した場合はエラー内容を通知する仕組みも備える。",
  },
];

const STACK = [
  "Next.js (App Router)",
  "TypeScript",
  "Vercel Cron Jobs",
  "Vercel AI Gateway",
  "LINE Messaging API",
];

const SAMPLE_MESSAGE = `【投資ニュース 朝刊】7月25日(土)

■ 日本株
1. 日銀、追加利上げを見送り現状維持を決定 ★★★★
市場予想通り政策金利は据え置き。総裁会見では物価動向を注視する姿勢を強調した。

▼想定される影響
金融株には短期的に売り材料となりうる一方、内需関連セクターには追い風の可能性。

（市場全体の方向性を左右する材料のため / 日本経済新聞）
https://example.com/sample-article-1

---

■ 米国株
2. 大手ハイテク企業、四半期決算で市場予想を上回る ★★★★★
クラウド事業の成長率が加速し、通期ガイダンスも上方修正。

▼想定される影響
関連サプライチェーン銘柄にも波及する可能性があり、ハイテクセクター全体の地合い改善が期待される。

（決算内容が業界全体のセンチメントに影響するため / Bloomberg）
https://example.com/sample-article-2`;

export default function Home() {
  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <p className={styles.eyebrow}>Personal Project</p>
        <h1>投資ニュース・ダイジェスト</h1>
        <p className={styles.lead}>
          日本株・米国株・グローバル市場のニュースをAIが毎朝自動で選定・要約し、LINEへ配信するパーソナルサービス。
          RSS収集からAIによる重要ニュース選定、LINE配信までを一貫して自動化しています。
        </p>
        <div className={styles.ctas}>
          <a
            className={styles.primary}
            href="https://github.com/"
            target="_blank"
            rel="noopener noreferrer"
          >
            GitHubでコードを見る
          </a>
        </div>
      </header>

      <section className={styles.section}>
        <h2>仕組み</h2>
        <ol className={styles.steps}>
          {STEPS.map((step, i) => (
            <li key={step.title} className={styles.step}>
              <span className={styles.stepNumber}>{i + 1}</span>
              <div>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className={styles.section}>
        <h2>配信サンプル</h2>
        <p className={styles.sectionNote}>
          実際の配信フォーマットのイメージです（掲載内容はサンプルであり、実在の記事・銘柄情報ではありません）。
        </p>
        <pre className={styles.sample}>{SAMPLE_MESSAGE}</pre>
      </section>

      <section className={styles.section}>
        <h2>技術スタック</h2>
        <ul className={styles.stack}>
          {STACK.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <footer className={styles.footer}>
        <p>個人開発プロジェクト / Vercel上で稼働中</p>
      </footer>
    </div>
  );
}
