import { PrismaClient } from "@prisma/client";
import { Browser } from "puppeteer";

import crawlSite from "./crawlSite";

const prisma = new PrismaClient();

export default async function crawlJob(context: {
  browser: Browser,
  pageUrl: string,
  queue: string[],
  crawled: string[]
  founded: string[],
  activeCrawls: string[],
  job: () => void
}) {
  const { browser, pageUrl, queue, crawled, founded, activeCrawls } = context;

  const result = await crawlSite(browser, pageUrl, { crawled });
  if (!result) {
    console.log(`Crawling ${pageUrl} is noindex or canonicalized. Skipping`);
    activeCrawls.splice(activeCrawls.indexOf(pageUrl), 1)
    context.job()
    return
  }
  const { indexOk, title, description, content, newUrls } = result
  let filteredLinks = newUrls.filter((url) => !founded.includes(url))
  filteredLinks = [...new Set(filteredLinks)] // 重複を除去

  queue.push(...filteredLinks);
  crawled.push(pageUrl);
  founded.push(...filteredLinks);
  console.log(`Found ${filteredLinks.length} links on ${pageUrl}`);
  
  // クロールしたページをDBに保存
  const pageRecord = await prisma.page.update({
    where: { url: pageUrl },
    data: {
      crawled: true,
      title: indexOk ? title : null,
      description: indexOk ? description: null,
      content: indexOk ? content : null,
      noIndex: !indexOk
    }
  })

  // 見つかったリンクをDBに保存
  for (const link of filteredLinks) {
    await prisma.page.upsert({
      where: { url: link },
      update: {},
      create: {
        crawled: false,
        url: link,
        backlinks: {
          create: {
            external: (new URL(link)).origin !== (new URL(pageRecord.url)).origin,
            from: {
              connect: pageRecord
            }
          }
        },
        site: {
          connectOrCreate: {
            where: { origin: (new URL(link)).origin },
            create: { origin: (new URL(link)).origin }
          }
        }
      }
    });
  }

  // リンクの中に以前クロールしたことがあるものがあればbacklinkを追加
  filteredLinks.forEach(async (link) => {
    const foundPage = await prisma.page.findUnique({
      where: {
        url: link
      }
    })
    if (foundPage) {
      const existingLink = await prisma.link.findFirst({
        where: {
          fromId: pageRecord.id,
          toId: foundPage.id
        }
      })

      if (!existingLink) {
        await prisma.page.update({
          where: { url: link },
          data: {
            backlinks: {
              create: {
                external: foundPage.siteId !== pageRecord.siteId,
                from: {
                  connect: pageRecord
                }
              }
            }
          }
        })
      }
    }
  })
}