// todo: originごとにページ数の上限
import puppeteer from 'puppeteer';
import { PrismaClient } from "@prisma/client"

import crawlSite from './core/crawlSite';
import getRobotsTxt from './robotstxt/getRobotsTxt';
import parseSitemap from './robotstxt/parseSitemap';
import addToQueue from './core/addToQueue';
import crawlJob from './core/crawlJob';
import canonicalizeUri from './utils/canonicalizeUri';

const prisma = new PrismaClient()

const browser = await puppeteer.launch({
  headless: process.env.NODE_ENV === 'production',
  args: [`--user-agent=Mozilla/5.0 (compatible; KorangeExptCrawler/${process.env.npm_package_version}; +https://exptcrawler.korange.work)`]
})

const pages: {name: string, children?: typeof pages}[] = [{name: 'https://korange.work/', children: []}];

let crawlInterval: NodeJS.Timeout | null = null;

// load queue from db
let queue: string[] = [];
const uncrawledPages = await prisma.page.findMany({ where: { crawled: false } });

if (uncrawledPages.length === 0) {
  queue = ['https://korange.work/'];
  await prisma.page.create({
    data: {
      crawled: false,
      url: 'https://korange.work/',
      site: {
        connectOrCreate: {
          where: { origin: 'https://korange.work/' },
          create: { origin: 'https://korange.work/' }
        }
      }
    }
  });
} else {
  queue = uncrawledPages.map((page) => page.url);
}

const crawled: string[] = [];
const founded: string[] = queue;
let activeCrawls: string[] = [];

async function job() {
  // activeCrawlsが上限に達していたら待つ
  if (activeCrawls.length > 7) {
    return
  }

  const shiftedQueue = queue.shift();
  if (!shiftedQueue) {
    return;
  }
  const pageUrl = canonicalizeUri(shiftedQueue, new URL(shiftedQueue).origin);

  // pageのoriginが同じページをクロール中の場合は後回し
  if (activeCrawls.some((active) => new URL(active).origin === new URL(pageUrl).origin)) {
    console.log(`Postponed ${pageUrl} because same origin pageUrl is crawling`);
    addToQueue(pageUrl, { queue })
    job() // 別のpageをクロールする
    return
  }

  // 同じoriginのページが50以上クロールされていたら消す
  const site = await prisma.site.findUnique({
    where: {
      origin: new URL(pageUrl).origin
    },
    include: {
      pages: {
        where: { crawled: true }
      }
    }
  })
  if (site && site.pages?.length > 50) {
    console.log(`The limit per origin (${site.origin}) has been exceeded. Skipping ${pageUrl}`)
    await prisma.page.update({
      where: { url: pageUrl },
      data: {
        crawled: true,
        noIndex: true
      }
    })
    await prisma.site.update({
      where: { origin: site.origin },
      data: {
        noCrawl: true,
        noCrawlReason: 'PAGE_LIMIT_EXCEEDED'
      }
    })
    job()
    return
  }

  if (!crawled.includes(pageUrl)) {
    // すでにクロールしているかdbで確認
    const page = await prisma.page.findUnique({
      where: { url: pageUrl }
    });
    if (page && page.crawled) {
      console.log(`Skipping ${pageUrl} because it is already crawled.`);
      job()
      return
    }

    activeCrawls.push(pageUrl);
    console.log(`Crawling ${pageUrl} (${activeCrawls.length} active crawls, ${queue.length} in queue)`);
    try {
      const urlObj = new URL(pageUrl);
      const robotsTxt = await getRobotsTxt(urlObj.origin)

      const site = await prisma.site.findUnique({
        where: {
          origin: urlObj.origin
        }
      })
      if (site && site.noCrawl) {
        console.log(`This site (${site.origin}) is set to noCrawl (reason: ${site.noCrawlReason}).`)
        await prisma.page.update({
          where: { url: pageUrl },
          data: {
            crawled: true,
            noIndex: true
          }
        })
        activeCrawls.splice(activeCrawls.indexOf(pageUrl), 1)
        job()
        return
      }

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
    setTimeout(() => { // 同じオリジンをクロールするまで時間が開くようにする
      activeCrawls.splice(activeCrawls.indexOf(pageUrl), 1)
    }, 3000);
  }

  if (queue.length === 0 && activeCrawls.length === 0) {
    if (crawlInterval) {
      clearInterval(crawlInterval);
    }
    browser.close();
    console.log('Crawl finished');
  }
}

crawlInterval = setInterval(job, 2800)