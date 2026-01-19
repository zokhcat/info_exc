import { extractData } from "../lib/extractor.js";
import dotenv from "dotenv";
dotenv.config();

const TEST_URLS = [
  "https://example.com",
  "https://github.com",
  "https://migma.ai",
  "https://paidtabs.com",
  "https://artlist.io",
  "https://openai.com",
  "https://stackoverflow.com",
  "https://news.ycombinator.com",
  "https://reddit.com",
  "https://twitter.com",
];

async function runTests() {
  const results: Record<string, any> = {};

  for (const url of TEST_URLS) {
    console.log(`\n${"=".repeat(60)}`);
    console.log(`Testing: ${url}`);
    console.log("=".repeat(60));

    try {
      const data = await extractData(url, process.env.OPENAI_API_KEY as string, {
        model: "gpt-4o",
        temperature: 0,
      });

      results[url] = {
        success: true,
        hasLogo: !!(data.logo_url || data.logo_svg),
        logoType: data.logo_url ? "url" : data.logo_svg ? "svg" : "none",
        confidence: data.confidence,
        reasoning: data.reasoning,
        fonts: data.fonts,
      };

      console.log(`Logo found: ${results[url].hasLogo ? "Yes" : "No"}`);
      console.log(`  Type: ${results[url].logoType}`);
      console.log(`  Confidence: ${data.confidence}`);
      console.log(`  Reasoning: ${data.reasoning}`);
      if (data.logo_url) {
        console.log(`  URL: ${data.logo_url}`);
      }
    } catch (error) {
      results[url] = {
        success: false,
        error: String(error),
      };
      console.error(`✗ Failed: ${error}`);
    }
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log("SUMMARY");
  console.log("=".repeat(60));

  const successful = Object.values(results).filter((r) => r.success).length;
  const withLogos = Object.values(results).filter((r) => r.hasLogo).length;

  console.log(`Total: ${TEST_URLS.length}`);
  console.log(`Successful: ${successful}`);
  console.log(`Found logos: ${withLogos}`);

  console.log("\nDetailed results:");
  console.log(JSON.stringify(results, null, 2));
}

runTests().catch(console.error);