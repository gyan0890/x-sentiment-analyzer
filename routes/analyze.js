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

      const formattedTweets = rawTweets.map((t, i) => {
        const engagementSummary = t.likes || t.replies || t.bookmarks || t.quotes
          ? `Engagement:\n- Likes: ${t.likes || 0}\n- Replies: ${t.replies || 0}\n- Quotes: ${t.quotes || 0}\n- Bookmarks: ${t.bookmarks || 0}\n`
          : '';
      
        const commentsText = t.comments && t.comments.length
          ? `Top Comments:\n${t.comments.slice(0, 3).map((c, idx) => `${idx + 1}. ${c}`).join('\n')}\n`
          : '';
      
        return `${i + 1}. Tweet:\n"${t.content}"\n${engagementSummary}${commentsText}`;
      }).join("\n\n");
      
      const prompt = `You are a sentiment and topic classifier for tweets.
      
      Analyze each tweet below using the content, engagement metrics, and top comments. Filter out scammy or repetitive comments (e.g., coin promotions, giveaways).
      
      For each tweet, determine:
      - Sentiment (Positive, Neutral, or Negative)
      - Topic (e.g., infra, meme, product update, community, alpha leak, announcement, general)
      - Public reaction (e.g., enthusiastic, skeptical, mixed)
      
      Guidance:
      - High likes and bookmarks indicate positive reception.
      - Many replies with low likes may signal controversy.
      - Filter comments that appear spammy or repetitive.
      
      Respond in this format:
      
      1. Tweet 1
         - Sentiment: <Positive | Neutral | Negative>
         - Topic: <topic>
         - Public Reaction: <summary>
      
      2. Tweet 2
         - Sentiment: ...
         - Topic: ...
         - Public Reaction: ...
      
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
        tweets: rawTweets.map((t) => ({
          content: t.content,
          timestamp: t.timestamp,
          likes: t.likes || 0,
          replies: t.replies || 0,
          quotes: t.quotes || 0,
          bookmarks: t.bookmarks || 0,
          comments: Array.isArray(t.comments) ? t.comments : [],
        })),
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