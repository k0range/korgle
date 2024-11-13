// todo: originごとにページ数の上限
import puppeteer from 'puppeteer';
import { PrismaClient } from "@prisma/client"

import crawlSite from './core/crawlSite';
import getRobotsTxt from './robotstxt/getRobotsTxt';
import parseSitemap from './robotstxt/parseSitemap';
import addToQueue from './core/addToQueue';
import crawlJob from './core/crawlJob';

const prisma = new PrismaClient()

const browser = await puppeteer.launch({
  headless: false,
  args: ['--user-agent=Mozilla/5.0 (compatible; KorangeExptCrawler/0.1.0; +https://exptcrawler.korange.work)']
})
const pages: {name: string, children?: typeof pages}[] = [{name: 'https://korange.work/', children: []}];

let crawlInterval: NodeJS.Timeout | null = null;

// load queue from db
let queue: string[] = [];
const uncrawledPages = await prisma.page.findMany({ where: { crawled: false } });

if (uncrawledPages.length === 0) {
  queue = ['https://korange.work/'];
} else {
  queue = uncrawledPages.map((page) => page.url);
}

const crawled: string[] = [];
const founded: string[] = queue;
let activeCrawls: string[] = [];

for (const url of queue) {
  await prisma.page.upsert({
    where: { url: url },
    update: {},
    create: {
      crawled: false,
      url: url,
      site: {
        connectOrCreate: {
          where: { origin: new URL(url).origin },
          create: { origin: new URL(url).origin }
        }
      }
    }
  });
}

async function job() {
  // activeCrawlsが上限に達していたら待つ
  if (activeCrawls.length > 12) {
    return
  }

  const pageUrl = queue.shift();

  // pageのoriginが同じページをクロール中の場合は後回し
  if (pageUrl && activeCrawls.some((active) => new URL(active).origin === new URL(pageUrl).origin)) {
    console.log(`Postponed ${pageUrl} because same origin pageUrl is crawling`);
    addToQueue(pageUrl, { queue })
    job() // 別のpageをクロールする
    return
  }

  if (pageUrl && !crawled.includes(pageUrl)) {
    activeCrawls.push(pageUrl);
    console.log(`Crawling ${pageUrl} (${activeCrawls.length} active crawls, ${queue.length} in queue)`);
    try {
      const urlObj = new URL(pageUrl);
      const robotsTxt = await getRobotsTxt(urlObj.origin)

      if ( robotsTxt.crawlDelay && robotsTxt.crawlDelay > 61 ) {
        console.log(`Crawl delay is too long (${robotsTxt.crawlDelay}). Skipping ${pageUrl}`)
        activeCrawls.splice(activeCrawls.indexOf(pageUrl), 1)
        job()
        return
      }

      if ( robotsTxt.sitemap ) {
        console.log(`Found sitemap: ${robotsTxt.sitemap}`)
        try {
          const sitemapXml = await (await fetch(robotsTxt.sitemap)).text()
          const sitemapArray = await parseSitemap(sitemapXml)
          sitemapArray.forEach((url) => addToQueue(url, { queue }))
        } catch (e) {
          console.error(`Failed to fetch sitemap ${robotsTxt.sitemap}`)
          console.error(e)
        }
      }
  
      if (robotsTxt.isAllowed(pageUrl)) {
        await crawlJob({ browser, pageUrl, queue, crawled, founded, activeCrawls, job })
      } else {
        console.log(`Crawling ${pageUrl} is not allowed by robots.txt`);
        job()
      }
    } catch (e) {
      console.error(`Failed to crawl ${pageUrl}`);
      console.error(e);
    }
    activeCrawls.splice(activeCrawls.indexOf(pageUrl), 1)
  }

  if (queue.length === 0 && activeCrawls.length === 0) {
    if (crawlInterval) {
      clearInterval(crawlInterval);
    }
    browser.close();
    console.log('Crawl finished');
  }
}

crawlInterval = setInterval(job, 2500)