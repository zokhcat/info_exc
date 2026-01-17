import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { Page } from "puppeteer";

interface LogoCandidate {
  index: number;
  src: string;
  type: "url" | "svg";
  alt: string | null;
  className: string | null;
  id: string | null;
  parentText: string | null;
  location: string;
  tagName: string;
  width: number | null;
  height: number | null;
  linksToHome?: boolean;
  parentTag?: string;
  parentClass?: string;
}

export interface LLMExtractionResult {
  logo_url: string | null;
  logo_svg: string | null;
  fonts: string[];
  confidence: number;
  reasoning: string;
}

async function extractLogoCandidates(page: Page): Promise<LogoCandidate[]> {
  const baseUrl = page.url();
  
  const rawCandidates = await page.evaluate(`(() => {
    const candidates = [];
    
    const getLocation = (el) => {
      let parent = el;
      while (parent) {
        const tag = parent.tagName?.toLowerCase();
        if (['header', 'nav', 'footer'].includes(tag)) return tag;
        const className = (parent.getAttribute('class') || '').toLowerCase();
        const id = (parent.getAttribute('id') || '').toLowerCase();
        if (className.includes('header') || id.includes('header')) return 'header';
        if (className.includes('nav') || id.includes('nav')) return 'nav';
        if (className.includes('footer') || id.includes('footer')) return 'footer';
        parent = parent.parentElement;
      }
      return 'body';
    };
    
    const getParentText = (el) => {
      const parent = el.closest('a, div, span, header, nav');
      if (parent) {
        const text = parent.textContent?.trim().substring(0, 100) || '';
        return text.replace(/\\s+/g, ' ');
      }
      return null;
    };
    
    document.querySelectorAll('img').forEach((img) => {
      const src = img.src || img.getAttribute('data-src');
      if (!src) return;
      
      const rect = img.getBoundingClientRect();
      candidates.push({
        src,
        type: 'url',
        alt: img.alt || null,
        className: img.className || null,
        id: img.id || null,
        parentText: getParentText(img),
        location: getLocation(img),
        tagName: 'img',
        width: rect.width || img.width || null,
        height: rect.height || img.height || null,
      });
    });
    
    document.querySelectorAll('svg').forEach((svg) => {
      const rect = svg.getBoundingClientRect();
      if (rect.width < 10 || rect.height < 10) return;
      if (rect.width > 500 || rect.height > 500) return;
      
      const className = svg.className?.baseVal || svg.getAttribute('class') || '';
      const id = svg.id || '';
      
      const parentAnchor = svg.closest('a');
      const linksToHome = parentAnchor ? 
        (parentAnchor.getAttribute('href') === '/' || 
         parentAnchor.getAttribute('href') === window.location.origin ||
         parentAnchor.getAttribute('href') === window.location.origin + '/') : false;
      
      const parentTag = svg.parentElement?.tagName?.toLowerCase() || '';
      const parentClass = (svg.parentElement?.getAttribute('class') || '').toLowerCase();
      
      try {
        const svgClone = svg.cloneNode(true);
        if (!svgClone.getAttribute('xmlns')) {
          svgClone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
        }
        const svgMarkup = new XMLSerializer().serializeToString(svgClone);
        
        candidates.push({
          src: svgMarkup,
          type: 'svg',
          alt: svg.getAttribute('aria-label') || null,
          className: className,
          id: id,
          parentText: getParentText(svg),
          location: getLocation(svg),
          tagName: 'svg',
          width: rect.width,
          height: rect.height,
          linksToHome: linksToHome,
          parentTag: parentTag,
          parentClass: parentClass,
        });
      } catch (e) {
      }
    });
    
    return candidates;
  })()`) as Omit<LogoCandidate, 'index'>[];

  return rawCandidates.map((c, index) => {
    let src = c.src;
    
    if (c.type === 'url' && !src.startsWith('data:')) {
      src = new URL(src, baseUrl).href;
    }
    
    return {
      ...c,
      index,
      src,
    };
  });
}

async function extractFontCandidates(page: Page): Promise<string[]> {
  return (await page.evaluate(`(() => {
    const fontSet = new Set();
    const genericFonts = ['serif', 'sans-serif', 'monospace', 'cursive', 'fantasy', 'system-ui', 'ui-sans-serif', 'ui-serif'];
    
    document.querySelectorAll('body, h1, h2, h3, h4, p, a, span, div, button').forEach((el) => {
      const style = getComputedStyle(el);
      const fontFamily = style.fontFamily;
      fontFamily.split(',').forEach((f) => {
        const name = f.trim().replace(/['"]/g, '');
        if (name && !genericFonts.includes(name.toLowerCase())) {
          fontSet.add(name);
        }
      });
    });
    
    try {
      for (const sheet of document.styleSheets) {
        try {
          for (const rule of sheet.cssRules) {
            if (rule.constructor.name === 'CSSFontFaceRule') {
              const family = rule.style.getPropertyValue('font-family');
              if (family) {
                fontSet.add(family.replace(/['"]/g, ''));
              }
            }
          }
        } catch (e) {}
      }
    } catch (e) {}
    
    return [...fontSet];
  })()`)) as string[];
}

export async function extractWithLLM(
  page: Page,
  openaiApiKey: string
): Promise<LLMExtractionResult> {
  const pageTitle = await page.title();
  const pageUrl = page.url();
  const hostname = new URL(pageUrl).hostname.replace('www.', '');
  
  const logoCandidates = await extractLogoCandidates(page);
  const fontCandidates = await extractFontCandidates(page);
  
  let relevantLogos = logoCandidates
    .filter(c => ['header', 'nav'].includes(c.location))
    .slice(0, 15);
  
  if (relevantLogos.length === 0) {
    relevantLogos = logoCandidates.slice(0, 15);
  }
  
  console.log(`Found ${logoCandidates.length} total candidates, ${relevantLogos.length} relevant`);

  const logosForLLM = relevantLogos.map(c => ({
    index: c.index,
    type: c.type,
    src: c.type === 'svg' ? '[SVG_MARKUP]' : c.src,
    alt: c.alt,
    className: c.className,
    id: c.id,
    parentText: c.parentText,
    location: c.location,
    tagName: c.tagName,
    width: c.width,
    height: c.height,
    linksToHome: c.linksToHome || false,
    parentTag: c.parentTag || null,
    parentClass: c.parentClass || null,
  }));

  const llm = new ChatOpenAI({
    modelName: "gpt-4o",
    temperature: 0,
    openAIApiKey: openaiApiKey,
  });

  const systemPrompt = `You are an expert at analyzing website structures to identify brand assets.
Your task is to identify the MAIN BRAND LOGO of a website - not partner logos, client logos, or decorative images.

The brand logo is typically:
- Has "linksToHome": true (STRONG indicator - logo usually links to homepage)
- Located in the header or navigation area
- Inside a span, anchor, or div with "logo" or "brand" in class name
- Contains the company/brand name in alt text or nearby text
- Is one of the first/prominent images in the header
- Matches the website's domain name or page title

IMPORTANT: "linksToHome": true is a very strong indicator that an element is the main logo!

Return your analysis as JSON with this exact structure:
{
  "logo_index": 0,
  "fonts": ["array", "of", "primary", "brand", "fonts"],
  "confidence": 0.95,
  "reasoning": "brief explanation of your choice"
}

Where logo_index is the index number of the chosen logo candidate, or -1 if no suitable logo found.`;

  const userPrompt = `Analyze this website and identify the main brand logo:

Website: ${pageUrl}
Page Title: ${pageTitle}
Domain: ${hostname}

Logo candidates found (${relevantLogos.length} total):
${JSON.stringify(logosForLLM, null, 2)}

Font candidates found:
${JSON.stringify(fontCandidates, null, 2)}

Instructions:
1. Find the MAIN BRAND LOGO - look for images/svgs that match the domain name "${hostname}" or page title
2. The logo is usually the first prominent image in the header/nav
3. Ignore partner logos, client logos, social icons, and decorative images
4. Return the INDEX number of the chosen logo candidate
5. Select 1-3 primary brand fonts from the candidates

Return JSON only, no markdown code blocks.`;

  const response = await llm.invoke([
    new SystemMessage(systemPrompt),
    new HumanMessage(userPrompt),
  ]);

  try {
    const content = response.content as string;
    
    const jsonStr = content
      .replace(/```json\s*/gi, '')
      .replace(/```\s*/g, '')
      .trim();
    
    const parsed = JSON.parse(jsonStr) as {
      logo_index: number;
      fonts: string[];
      confidence: number;
      reasoning: string;
    };

    const selectedLogo = relevantLogos.find(c => c.index === parsed.logo_index);
    
    let logo_url: string | null = null;
    let logo_svg: string | null = null;
    
    if (selectedLogo) {
      if (selectedLogo.type === 'url') {
        logo_url = selectedLogo.src;
      } else {
        logo_svg = selectedLogo.src;
      }
    }
    
    return {
      logo_url,
      logo_svg,
      fonts: parsed.fonts,
      confidence: parsed.confidence,
      reasoning: parsed.reasoning,
    };
  } catch (e) {
    console.error("Failed to parse LLM response:", e);
    
    const firstLogo = relevantLogos[0];
    return {
      logo_url: firstLogo?.type === 'url' ? firstLogo.src : null,
      logo_svg: firstLogo?.type === 'svg' ? firstLogo.src : null,
      fonts: fontCandidates.slice(0, 3),
      confidence: 0.3,
      reasoning: "Failed to parse LLM response, using fallback",
    };
  }
}
