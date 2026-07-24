/**
 * User-agents we never count as real visits: search crawlers, SEO scrapers,
 * link unfurlers (Facebook/WhatsApp/etc.), uptime monitors and headless/script
 * clients. Filtering these keeps the admin traffic numbers about humans, in the
 * same ballpark as client-side analytics (GA), which bots don't trigger because
 * they don't run JavaScript.
 *
 * Pure and edge-safe so the proxy middleware can use it.
 */
const BOT_PATTERN =
  /bot|crawl|spider|slurp|mediapartners|facebookexternalhit|whatsapp|telegram|discord|slackbot|embedly|pinterest|redditbot|linkedinbot|semrush|ahrefs|mj12|dotbot|petal|bytespider|gptbot|ccbot|claudebot|anthropic|perplexity|google-inspectiontool|bingpreview|yandex|baidu|duckduck|headless|phantom|python|curl|wget|go-http|java\/|okhttp|axios|node-fetch|scrapy|monitor|uptime|pingdom|statuscake|dataprovider|censys|zgrab|masscan/i;

/** True when the request should NOT be logged as a human visit. A missing or
 *  empty user-agent is treated as a bot — real browsers always send one. */
export function isBotUserAgent(userAgent: string | null | undefined): boolean {
  if (!userAgent || !userAgent.trim()) return true;
  return BOT_PATTERN.test(userAgent);
}
