import canonicalizeUri from "../utils/canonicalizeUri"

export default function parseRobotsTxt(content: string, baseUrl: string) {
  const lines = content.toLowerCase().split('\n')
  const disallowList: string[] = []
  const allowList: string[] = []
  let crawlDelay: number | null = null
  let sitemap: string | null = null
  let myRulesCount = 0

  let ifItsMyUA = false

  lines.forEach((line) => {
    if (line.trim() === '') return
    if (line.startsWith('#')) return

    if (line.startsWith('user-agent:')) {
      if (line.split(':')[1].trim() === '*' || line.split(':')[1].trim() === 'KorangeExptCrawler') {
        ifItsMyUA = true
      } else {
        if ( myRulesCount !== 0 ) { // 複数のUA対応用、複数の場合User-agentの次がUser-agentになるのでルール数が0になる
          ifItsMyUA = false
        }
      }
      myRulesCount = 0
    }
    
    if (ifItsMyUA) {
      myRulesCount++
      switch (line.split(':')[0].trim()) {
        case 'disallow':
          disallowList.push(canonicalizeUri(line.split(':')[1].trim(), baseUrl))
          break
        case 'allow':
          allowList.push(canonicalizeUri(line.split(':')[1].trim(), baseUrl))
          break
        case 'crawl-delay':
          crawlDelay = parseInt(line.split(':')[1].trim())
          break
        case 'sitemap':
          sitemap = line.split(/:(.+)/, 2)[1].trim()
          break
        default:
          myRulesCount--
          break
      }
    }
  })

  return { disallowList, allowList, crawlDelay, sitemap }
}