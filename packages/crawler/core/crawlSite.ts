import { Browser } from "puppeteer";

import getRobotsTxt from "../robotstxt/getRobotsTxt";
import canonicalizeUri from "../utils/canonicalizeUri";

export default async function crawlSite(browser: Browser, url: string, context: { crawled: string[] }) {
  const urlObj = new URL(url);
  let indexOk = true;
  const robotsTxt = await getRobotsTxt(urlObj.origin)
  
  if (!robotsTxt.isAllowed(url)) {
    return null;
  }
  
  const page = await browser.newPage();
  await page.goto(url);

  const crawlDelay = robotsTxt.crawlDelay ?? 4;
  await new Promise((resolve) =>
    setTimeout(resolve, crawlDelay * 1000)
  );
  // mmemo: 被リンク数やリンク先も保存
  // noindexを確認
  const noindex = await page.evaluate(() => {
    const meta = document.querySelector('meta[name="robots"]');
    return meta?.getAttribute('content')?.includes('noindex');
  });
  if (noindex) {
    indexOk = false;
    console.log(`${url} is noindex.`);
  }

  // canonicalタグを確認
  const canonical = await page.evaluate(() => {
    const canonicalTag = document.querySelector('link[rel="canonical"]');
    return canonicalTag?.getAttribute('href');
  });
  if (canonical) {
    const canonicalUrl = canonicalizeUri(canonical, urlObj.origin);

    // すでにcanonicalページがクロール済みの場合はスキップ
    if (context.crawled.includes(canonicalUrl)) {
      await page.close();
      return null;
    }
    // memo: dbへはurlではなくcanonicalUrlを登録しておく
  }

  // ページタイトルを取得
  const title = await page.title()

  // meta descriptionを取得
  const description = await page.evaluate(() => {
    const meta = document.querySelector('meta[name="description"]');
    return meta?.getAttribute('content')?.trim();
  });

  // 内容を取得
  const content = await page.evaluate(() => {
    return document.querySelector('body')?.innerText?.replace(/\s+/g, ' ').trim();
  });

  // リンクを収集
  let newUrls = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('a'))
      .filter((a) => {
        return !a.getAttribute('rel')?.includes('nofollow');
      })
      .filter((a) => {
        return a.href.startsWith('http');
      })
      .map((a) => a.href);
  });
  newUrls.map((newUrl) => canonicalizeUri(newUrl, urlObj.origin));

  await page.close();
  return { indexOk, title, description, content, newUrls };
}