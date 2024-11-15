import { Browser } from "puppeteer";
import { PrismaClient } from "@prisma/client";

import getRobotsTxt from "../robotstxt/getRobotsTxt";
import canonicalizeUri from "../utils/canonicalizeUri";

const prisma = new PrismaClient();

export default async function crawlSite(browser: Browser, url: string, context: { crawled: string[] }) {
  const urlObj = new URL(url);
  let indexOk = true;
  let noFollow = false;
  const robotsTxt = await getRobotsTxt(urlObj.origin)
  
  if (!robotsTxt.isAllowed(url)) {
    return null;
  }
  
  const page = await browser.newPage();
  await page.setRequestInterception(true);
  page.on('request', (request) => {
    const resourceType = request.resourceType();
    
    if (resourceType === 'image' || resourceType === 'stylesheet' || resourceType === 'font' || resourceType === 'media' || resourceType === 'websocket') {
      request.abort();
    } else {
      request.continue();
    }
  });

  const response = await page.goto(url);

  if (!response) {
    console.log(`${url} is not reachable. Skipping`);
    await page.close();
    return null;
  }
  if (response.status() !== 200) {
    console.log(`${url} is not status code 200. Skipping`);
    await page.close();
    return null;
  }
  if (response.headers()['content-type'] && !response.headers()['content-type']?.includes('text/html')) {
    console.log(`${url} is not HTML. Skipping`);
    await page.close();
    return null;
  }
  const xRobotsTag = response.headers()['x-robots-tag'];
  let xRobotsRule = '';
  if (xRobotsTag) {
    if (xRobotsTag.includes(':')) {
      const [userAgent, rule] = xRobotsTag.split(':');
      if (userAgent.trim().toLowerCase() === 'korangeexptcrawler') {
        xRobotsRule = rule.trim().toLowerCase();
      }
    } else {
      xRobotsRule = xRobotsTag.trim().toLowerCase();;
    }
    if (xRobotsTag.includes('noindex')) {
      indexOk = false;
      console.log(`${url} is noindex.`);
    }
    if (xRobotsTag.includes('nofollow')) {
      noFollow = true;
      console.log(`${url} is nofollow.`);
    }
  }

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
      console.log(`${url} is canonical to ${canonicalUrl} and its crawled. Skipping`);
      await page.close();
      return null;
    } else {
      const canonicalPageRecord = await prisma.page.findUnique({
        where: { url: canonicalUrl }
      })
      if (canonicalPageRecord && canonicalPageRecord.crawled) {
        console.log(`${url} is canonical to ${canonicalUrl} and its crawled. Skipping`);
        await page.close();
        return null;
      }
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
  let newUrls: string[] = []
  if (!noFollow) {
    newUrls = await page.evaluate(() => {
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
  }

  await page.close();
  return { indexOk, title, description, content, newUrls };
}