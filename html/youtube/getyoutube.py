import asyncio
import base64
import mimetypes
import re
import sys
from urllib.parse import urljoin, urlparse

from bs4 import BeautifulSoup
from playwright.async_api import async_playwright

async def main(url):
    assets = {}

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context()
        page = await context.new_page()

        async def capture(response):
            try:
                ct = response.headers.get("content-type", "")
                if any(x in ct for x in (
                    "text/css",
                    "javascript",
                    "image/",
                    "font/",
                    "application/font",
                )):
                    assets[response.url] = (ct, await response.body())
            except:
                pass

        page.on("response", capture)
        await page.goto(url, wait_until="networkidle")

        html = await page.content()
        await browser.close()

    soup = BeautifulSoup(html, "html.parser")

    def embed_url(tag, attr):
        src = tag.get(attr)
        if not src:
            return
        full = urljoin(url, src)
        if full not in assets:
            return
        ct, data = assets[full]
        b64 = base64.b64encode(data).decode()
        tag[attr] = f"data:{ct};base64,{b64}"

    # Inline images
    for img in soup.find_all("img"):
        embed_url(img, "src")

    # Inline scripts
    for script in soup.find_all("script", src=True):
        src = urljoin(url, script["src"])
        if src in assets:
            ct, data = assets[src]
            script.string = data.decode(errors="ignore")
            del script["src"]

    # Inline stylesheets
    for link in soup.find_all("link", rel="stylesheet"):
        href = urljoin(url, link.get("href", ""))
        if href in assets:
            ct, data = assets[href]
            css = data.decode(errors="ignore")

            # Inline URLs inside CSS
            def repl(match):
                raw = match.group(1).strip("\"'")
                full = urljoin(href, raw)
                if full in assets:
                    ct2, d2 = assets[full]
                    return f"url(data:{ct2};base64,{base64.b64encode(d2).decode()})"
                return match.group(0)

            css = re.sub(r"url\((.*?)\)", repl, css)

            style = soup.new_tag("style")
            style.string = css
            link.replace_with(style)

    with open("offline.html", "w", encoding="utf-8") as f:
        f.write(str(soup))

    print("DONE → offline.html (single-file, fully self-contained)")

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python dump_single_file.py <url>")
        sys.exit(1)

    asyncio.run(main(sys.argv[1]))
