const axios = require("axios");
const cheerio = require("cheerio");

async function scrapeTweets(handle, maxTweets = 10) {
  const apiKey = process.env.SCRAPINGBEE_API_KEY;
  const url = `https://x.com/${handle}`;

  const scrapingbeeUrl = `https://app.scrapingbee.com/api/v1`;

  const params = {
    api_key: apiKey,
    url,
    render_js: "true",
    wait_for: "article",
  };

  try {
    console.log(`🌐 Fetching tweets for @${handle} using ScrapingBee...`);
    const res = await axios.get(scrapingbeeUrl, { params });
    const html = res.data;

    console.log("🧾 HTML length:", html.length);
    console.log("🧪 Contains <article>?:", html.includes("<article"));
    console.log("🧪 Contains div[lang]?:", html.includes("div lang=\""));

    const $ = cheerio.load(html);
    const tweets = [];

    const tweetNodes = $("article div[lang]");
    console.log(`🔍 Found ${tweetNodes.length} <div[lang]> tweet nodes`);

    tweetNodes.each((i, el) => {
      if (tweets.length >= maxTweets) return false;
      const text = $(el).text().trim();
      if (text.length > 20) {
        console.log(`✅ Tweet ${i + 1}:`, text.slice(0, 80), "...");
        tweets.push(text);
      } else {
        console.log(`⚠️ Skipped short tweet at index ${i}`);
      }
    });

    console.log(`🧮 Final tweet count for @${handle}: ${tweets.length}`);
    return tweets;
  } catch (err) {
    console.error("❌ ScrapingBee error:", err.response?.data || err.message);
    return [];
  }
}

module.exports = scrapeTweets;