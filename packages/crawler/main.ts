// todo: originごとにページ数の上限
import puppeteer, { Browser } from 'puppeteer';
import crawlSite from './core/crawlSite';
import getRobotsTxt from './robotstxt/getRobotsTxt';
import parseSitemap from './robotstxt/parseSitemap';

const browser = await puppeteer.launch({
  headless: false,
  args: ['--user-agent=Mozilla/5.0 (compatible; KorangeExptCrawler/0.1.0; +https://exptcrawler.korange.work)']
})
const pages: {name: string, children?: typeof pages}[] = [{name: 'https://korange.work/', children: []}];

let crawlInterval: NodeJS.Timeout | null = null;
const queue: string[] = ['https://korange.work/'];
const crawled: string[] = [];
const founded: string[] = queue;
let activeCrawls: string[] = [];

async function job() {
  // activeCrawlsが上限に達していたら待つ
  if (activeCrawls.length > 12) {
    return
  }

  const page = queue.shift();

  // pageのoriginが同じページをクロール中の場合は後回し
  if (page && activeCrawls.some((active) => new URL(active).origin === new URL(page).origin)) {
    console.log(`Postponed ${page} because same origin page is crawling`);
    queue.push(page)
    job() // 別のpageをクロールする
    return
  }

  if (page && !crawled.includes(page)) {
    activeCrawls.push(page);
    console.log(`Crawling ${page} (${activeCrawls.length} active crawls, ${queue.length} in queue)`);
    try {
      const urlObj = new URL(page);
      const robotsTxt = await getRobotsTxt(urlObj.origin)

      if ( robotsTxt.crawlDelay && robotsTxt.crawlDelay > 61 ) {
        console.log(`Crawl delay is too long (${robotsTxt.crawlDelay}). Skipping ${page}`)
        activeCrawls.splice(activeCrawls.indexOf(page), 1)
        job()
        return
      }

      if ( robotsTxt.sitemap ) {
        console.log(`Found sitemap: ${robotsTxt.sitemap}`)
        try {
          const sitemapXml = await (await fetch(robotsTxt.sitemap)).text()
          const sitemapArray = await parseSitemap(sitemapXml)
          queue.push(...sitemapArray)
        } catch (e) {
          console.error(`Failed to fetch sitemap ${robotsTxt.sitemap}`)
          console.error(e)
        }
      }
  
      if (robotsTxt.isAllowed(page)) {
        const result = await crawlSite(browser, page, { crawled });
        if (!result) {
          console.log(`Crawling ${page} is noindex or canonicalized. Skipping`);
          activeCrawls.splice(activeCrawls.indexOf(page), 1)
          job()
          return
        }
        const { indexOk, title, description, content, newUrls } = result
        let filteredLinks = newUrls.filter((url) => !founded.includes(url))
        filteredLinks = [...new Set(filteredLinks)] // 重複を除去

        queue.push(...filteredLinks);
        crawled.push(page);
        founded.push(...filteredLinks);
        console.log(`Found ${filteredLinks.length} links on ${page}`);
        
        // indexOkがtrueの場合のみdbに保存
      } else {
        console.log(`Crawling ${page} is not allowed by robots.txt`);
        job()
      }
    } catch (e) {
      console.error(`Failed to crawl ${page}`);
      console.error(e);
    }
    activeCrawls.splice(activeCrawls.indexOf(page), 1)
  }

  if (queue.length === 0 && activeCrawls.length === 0) {
    if (crawlInterval) {
      clearInterval(crawlInterval);
    }
    browser.close();
    console.log('Crawl finished');
  }
}

crawlInterval = setInterval(job, 3000)