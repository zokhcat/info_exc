import puppeteer, { Page } from "puppeteer";
import { extractWithLLM } from "./llm.js";
import { LLMConfig } from "../config.js";

export interface Meta {
  description: string | null;
  keywords: string | null;
  og_title: string | null;
  og_image: string | null;
  og_description: string | null;
}

export interface ExtractedData {
  url: string;
  title: string;
  logo_url: string | null;
  logo_svg: string | null;
  fonts: string[];
  meta: Meta;
  confidence?: number;
  reasoning?: string;
}

async function extractMeta(page: Page): Promise<Meta> {
  return (await page.evaluate(`(() => {
    const getMeta = (name) => {
      const el = document.querySelector(
        'meta[name="' + name + '"], meta[property="' + name + '"]'
      );
      return el ? el.getAttribute('content') : null;
    };
    return {
      description: getMeta('description'),
      keywords: getMeta('keywords'),
      og_title: getMeta('og:title'),
      og_image: getMeta('og:image'),
      og_description: getMeta('og:description'),
    };
  })()`)) as Meta;
}

export async function extractData(
  url: string,
  openaiApiKey: string,
  llmConfig: LLMConfig,
): Promise<ExtractedData> {
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();

    await page.setUserAgent(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    );

    await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });

    const title = await page.title();
    const meta = await extractMeta(page);

    if (openaiApiKey) {
      const llmResult = await extractWithLLM(page, openaiApiKey, llmConfig);
      
      return {
        url,
        title,
        logo_url: llmResult.logo_url,
        logo_svg: llmResult.logo_svg,
        fonts: llmResult.fonts,
        meta,
        confidence: llmResult.confidence,
        reasoning: llmResult.reasoning,
      };
    }

    return {
      url,
      title,
      logo_url: null,
      logo_svg: null,
      fonts: [],
      meta,
    };
  } finally {
    await browser.close();
  }
}