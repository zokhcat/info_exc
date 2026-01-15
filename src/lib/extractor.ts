import puppeteer, { Page } from "puppeteer";

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
  fonts: string[];
  meta: Meta;
}

async function extractLogo(page: Page): Promise<string | null> {
  const selectors = [
    'img[class*="logo"]',
    'img[id*="logo"]',
    'img[alt*="logo" i]',
    'img[src*="logo"]',
    "header img:first-of-type",
  ];

  const baseUrl = page.url();

  for (const selector of selectors) {
    const logo = await page.$(selector);
    if (logo) {
      const src = await logo.evaluate((el) => el.getAttribute("src"));
      if (src) {
        return new URL(src, baseUrl).href;
      }
    }
  }

  const favicon = await page.$('link[rel*="icon"]');
  if (favicon) {
    const href = await favicon.evaluate((el) => el.getAttribute("href"));
    if (href) {
      return new URL(href, baseUrl).href;
    }
  }

  return null;
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

async function extractFonts(page: Page): Promise<string[]> {
  const fontsRaw = (await page.evaluate(`(() => {
    const fontSet = new Set();
    const genericFonts = ['serif', 'sans-serif', 'monospace', 'cursive', 'fantasy'];
    
    document.querySelectorAll('body, h1, h2, h3, p, a, span').forEach((el) => {
      const fontFamily = getComputedStyle(el).fontFamily;
      fontFamily.split(',').forEach((f) => {
        const name = f.trim().replace(/['"]/g, '');
        if (name && !genericFonts.includes(name.toLowerCase())) {
          fontSet.add(name);
        }
      });
    });

    return [...fontSet];
  })()`)) as string[];

  const seen = new Set<string>();
  const fonts: string[] = [];
  for (const font of fontsRaw) {
    const fontLower = font.toLowerCase();
    if (!seen.has(fontLower)) {
      seen.add(fontLower);
      fonts.push(font);
    }
  }

  return fonts;
}

export async function extractData(url: string): Promise<ExtractedData> {
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();

    await page.setUserAgent(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    );

    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });

    const [title, logo_url, meta, fonts] = await Promise.all([
      page.title(),
      extractLogo(page),
      extractMeta(page),
      extractFonts(page),
    ]);

    return {
      url,
      title,
      logo_url,
      fonts,
      meta,
    };
  } finally {
    await browser.close();
  }
}
