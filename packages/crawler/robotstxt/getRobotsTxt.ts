import fs from 'fs/promises';
import path from 'path';
import RobotsTxt from './RobotsTxt';

export default async function getRobotsTxt(origin: string) {
  const cacheDir = path.join('cache', 'robotstxt')
  // キャッシュディレクトリがなければ作成
  await fs.mkdir(cacheDir, { recursive: true });

  const safeFileOrigin = origin.replace(/[^a-zA-Z0-9.]/g, '_')
  // キャッシュにあるか確認
  let content = ''
  try {
    content = await fs.readFile(path.join(cacheDir, safeFileOrigin + '.txt'), 'utf8')
    console.log(`${origin}'s robots.txt is cached. Using cache`)
  } catch (e) {
    console.log(`${origin}'s robots.txt is not cached. Fetching...`)
    const response = await fetch(origin + '/robots.txt')
    content = await response.text()
    fs.writeFile(path.join(cacheDir, safeFileOrigin + '.txt'), content, {
      encoding: 'utf8'
    }) 
  }
  return new RobotsTxt(content, origin)
}
