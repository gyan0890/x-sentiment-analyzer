const axios = require("axios");
const cheerio = require("cheerio");
const fs = require("fs");

async function scrapeTweets(handle, maxTweets = 5) {
  const apiKey = process.env.SCRAPINGBEE_API_KEY;
  const targetUrl = `https://x.com/${handle}?f=live`;
  const scrapingbeeUrl = `https://app.scrapingbee.com/api/v1`;

  const params = {
    api_key: apiKey,
    url: targetUrl,
    render_js: "true",
    wait_for: "article",
    premium_proxy: "true",
    block_resources: "false",
    timeout: 30000,
    wait: "3000",

  };

  const extractTweetsFromHtml = (html) => {
    const $ = cheerio.load(html);
    const tweets = [];

    $("article").each((i, el) => {
      if (tweets.length >= maxTweets) return false;

      const textBlocks = $(el).find("div[lang]");
      const text = textBlocks.first().text().trim();
      const timeEl = $(el).find("time");
      const timestamp = timeEl.attr("datetime") || null;

      // Engagement metrics via aria-label fallback
      const stats = {
        likes: 0,
        replies: 0,
        quotes: 0,
        bookmarks: 0,
      };

      $(el)
        .find('[aria-label]')
        .each((_, statEl) => {
          const label = $(statEl).attr('aria-label') || '';
          const value = parseInt(label.match(/\d+/)?.[0] || '0');

          if (label.includes('Like')) stats.likes = value;
          else if (label.includes('Reply')) stats.replies = value;
          else if (label.includes('Quote')) stats.quotes = value;
          else if (label.includes('Bookmark')) stats.bookmarks = value;
        });

      // Extract top non-spammy comments (from additional <div[lang]> in same article)
      const commentCandidates = textBlocks.slice(1).map((_, e) => $(e).text().trim()).get();
      const comments = commentCandidates
        .filter((txt) => txt.length > 10 && !/coin|giveaway|airdrop|free|shill|pump/i.test(txt))
        .slice(0, 3);

      if (text) {
        console.log(`✅ Tweet ${i + 1}:`, text.slice(0, 80), "...");
        tweets.push({
          content: text,
          timestamp,
          likes: stats.likes,
          replies: stats.replies,
          quotes: stats.quotes,
          bookmarks: stats.bookmarks,
          comments,
        });
      }
    });

    return tweets;
  };

  try {
    console.log(`🌐 Fetching tweets for @${handle} using ScrapingBee...`);
    const res = await axios.get(scrapingbeeUrl, { params });
    const html = res.data;
    const tweets = extractTweetsFromHtml(html);
    console.log(`🧮 Final tweet count for @${handle}: ${tweets.length}`);
    return tweets;
  } catch (err) {
    console.warn("⚠️ Initial ScrapingBee request failed. Retrying with stealth proxy...");
    try {
      const retryRes = await axios.get(scrapingbeeUrl, {
        params: { ...params, stealth_proxy: "true" },
      });
      const tweets = extractTweetsFromHtml(retryRes.data);
      fs.writeFileSync(`dump_${handle}_success.html`, retryRes.data);
      console.log(`🧮 Final tweet count for @${handle} (stealth): ${tweets.length}`);
      return tweets;
    } catch (retryErr) {
      console.error("❌ ScrapingBee (stealth retry) error:", retryErr.response?.data || retryErr.message);
      const dumpContent = retryErr.response?.data || retryErr.message || "No HTML to dump.";
      try {
        fs.writeFileSync(`dump_${handle}_stealth.html`, dumpContent);
        console.log(`📝 Dumped raw HTML (stealth mode) to dump_${handle}_stealth.html`);
      } catch (writeErr) {
        console.error("⚠️ Failed to write HTML dump:", writeErr.message);
      }
      return [];
    }
  }
}

module.exports = scrapeTweets;
