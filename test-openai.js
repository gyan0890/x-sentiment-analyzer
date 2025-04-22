const OpenAI = require("openai");
require("dotenv").config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function test() {
  try {
    const res = await openai.models.list();
    console.log("✅ OpenAI API key works!");
    console.log(res.data);
  } catch (err) {
    console.error("❌ OpenAI error:", err.response?.status, err.response?.data || err.message);
  }
}

test();
