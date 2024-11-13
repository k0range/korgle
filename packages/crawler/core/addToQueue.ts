import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

export default function addToQueue(url: string, context: { queue: string[] }) {
  context.queue.push(url)
  prisma.page.upsert({
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
  })
  return
}