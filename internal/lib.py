from dataclasses import dataclass
from urllib.parse import urljoin
from playwright.async_api import async_playwright, Page


@dataclass
class Meta:
    description: str | None
    keywords: str | None
    og_title: str | None
    og_image: str | None
    og_description: str | None

@dataclass
class ExtractedData:
    url: str
    title: str
    logo_url: str | None
    fonts: list[str]
    meta: Meta


async def _extract_logo(page: Page) -> str | None:
    selectors = [
        'img[class*="logo"]',
        'img[id*="logo"]', 
        'img[alt*="logo" i]',
        'img[src*="logo"]',
        'header img:first-of-type',
    ]
    for selector in selectors:
        logo = await page.query_selector(selector)
        if logo:
            src = await logo.get_attribute('src')
            if src:
                return urljoin(page.url, src)
    
    favicon = await page.query_selector('link[rel*="icon"]')
    if favicon:
        return await favicon.get_attribute('href')
    return None


async def _extract_meta(page: Page) -> Meta:
    return await page.evaluate('''() => {
        const getMeta = (name) => {
            const el = document.querySelector(`meta[name="${name}"], meta[property="${name}"]`);
            return el ? el.getAttribute('content') : null;
        };
        return {
            description: getMeta('description'),
            keywords: getMeta('keywords'),
            og_title: getMeta('og:title'),
            og_image: getMeta('og:image'),
            og_description: getMeta('og:description'),
        };
    }''')


async def _extract_fonts(page: Page) -> list[str]:
    return await page.evaluate('''() => {
        const fontSet = new Set();
        document.querySelectorAll('body, h1, h2, p, a').forEach(el => {
            const fontFamily = getComputedStyle(el).fontFamily;
            fontFamily.split(',').forEach(f => {
                const name = f.trim().replace(/['"]/g, '');
                if (name && !['serif', 'sans-serif', 'monospace'].includes(name.toLowerCase())) {
                    fontSet.add(name);
                }
            });
        });
        return [...fontSet];
    }''')


async def extract_data(url: str, timeout: int = 30000) -> ExtractedData:
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        await page.goto(url, timeout=timeout)
        
        title = await page.title()
        logo_url = await _extract_logo(page)
        fonts_raw = await _extract_fonts(page)
        meta = await _extract_meta(page)
        seen = set()
        fonts = []
        for font in fonts_raw:
            font_lower = font.lower()
            if font_lower not in seen:
                seen.add(font_lower)
                fonts.append(font)
        
        await browser.close()
        
        return ExtractedData(
            url=url,
            title=title,
            logo_url=logo_url,
            fonts=fonts,
            meta=meta,
        )