/** 一条新闻条目（解析后的结构化表示）。 */
export interface NewsItem {
  /** 标题 */
  title: string;
  /** 原文链接（跳回 bloomberg.com，不镜像正文） */
  link: string;
  /** 发布时间（解析为 Date） */
  pubDate: Date;
  /** 官方摘要（来自 RSS description，可能为空字符串） */
  summary: string;
  /** 来源发布方名（如 "Bloomberg" / "CNBC"） */
  source: string;
}
