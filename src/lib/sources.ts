export type Region = "jp" | "us" | "global";

export interface FeedSource {
  name: string;
  url: string;
  region: Region;
}

/**
 * RSSフィード一覧。壊れている・配信停止になったフィードがあっても
 * fetchAllArticles 側で個別に無視するので、ここに追加/削除するだけで調整できる。
 */
export const FEED_SOURCES: FeedSource[] = [
  // 日本株・国内経済
  {
    name: "Yahoo!ニュース 経済",
    url: "https://news.yahoo.co.jp/rss/categories/business.xml",
    region: "jp",
  },
  {
    name: "NHKニュース 経済",
    url: "https://www3.nhk.or.jp/rss/news/cat5.xml",
    region: "jp",
  },
  {
    name: "東洋経済オンライン",
    url: "https://toyokeizai.net/list/feed/rss",
    region: "jp",
  },
  {
    name: "ダイヤモンド・オンライン",
    url: "https://diamond.jp/list/feed/rss/dol",
    region: "jp",
  },
  {
    name: "ロイター(日本 ビジネス)",
    url: "https://jp.reuters.com/arc/outboundfeeds/rss/category/business/?outputType=xml",
    region: "jp",
  },

  // 米国株・グローバル経済
  {
    name: "Yahoo Finance",
    url: "https://finance.yahoo.com/news/rssindex",
    region: "us",
  },
  {
    name: "MarketWatch Top Stories",
    url: "https://feeds.marketwatch.com/marketwatch/topstories/",
    region: "us",
  },
  {
    name: "MarketWatch Market Pulse",
    url: "https://feeds.marketwatch.com/marketwatch/marketpulse/",
    region: "us",
  },
  {
    name: "WSJ Markets",
    url: "https://feeds.a.dj.com/rss/RSSMarketsMain.xml",
    region: "us",
  },
  {
    name: "Investing.com News",
    url: "https://www.investing.com/rss/news.rss",
    region: "global",
  },
];
