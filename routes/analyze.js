const express = require("express");
const OpenAI = require("openai");
const scrapeTweets = require("../scraper/scrapeTweets");

const router = express.Router();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

router.post("/", async (req, res) => {
  const { handles } = req.body;

  if (!Array.isArray(handles) || handles.length === 0) {
    return res.status(400).json({ error: "Missing or invalid 'handles' array." });
  }

  const results = [];

  for (const handle of handles) {
    try {
      console.log(`🧹 Scraping tweets for @${handle}...`);
      const rawTweets = await scrapeTweets(handle, 5);

      if (!rawTweets || rawTweets.length === 0) {
        results.push({ handle, error: "No tweets found or scraping failed." });
        continue;
      }

      const formattedTweets = rawTweets.map((t, i) => `${i + 1}. ${t}`).join("\n\n");

      const prompt = `You are a tweet sentiment and topic classifier.

      Analyze each tweet below and return:
      1. Sentiment — Positive, Neutral, or Negative
      2. Topic — e.g., infra, meme, product update, community, alpha leak, event, or general

      If a tweet is very short or ambiguous, do your best to infer meaning.  
      If unsure, default to:
      - Sentiment: Neutral
      - Topic: General

      Respond in this format:

      1. Tweet 1  
        - Sentiment: <Positive | Neutral | Negative>  
        - Topic: <topic>  

      2. Tweet 2  
        - Sentiment: ...  
        - Topic: ...

      Tweets from @${handle}:
      ${formattedTweets}
      `;

      const gptRes = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
      });

      const summary = gptRes.choices[0].message.content;

      results.push({
        handle,
        tweets: rawTweets,
        summary,
      });

      console.log(`✅ Successfully scraped and analyzed @${handle}`);
    } catch (err) {
      console.error(`❌ Failed for @${handle}:`, err.response?.data || err.message);
      results.push({ handle, error: "Failed to fetch or analyze." });
    }
  }

  res.json({ results });
});

module.exports = router;