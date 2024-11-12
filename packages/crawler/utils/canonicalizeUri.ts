// This not include rel=canonical tag
export default function canonicalizeUri(uri: string, base: string): string {
  let canonicalizedUri = new URL(uri.toLowerCase(), base.toLowerCase());

  // 末尾のスラッシュを削除
  canonicalizedUri.pathname = canonicalizedUri.pathname.replace(/\/+$/, '');

  // クエリパラメータをソート
  const query = canonicalizedUri.searchParams
  const queryKeys = Array.from(query.keys())
  const sortedQuery = queryKeys.sort().map(key => [key, query.get(key) || ''])
  canonicalizedUri.search = new URLSearchParams(sortedQuery).toString()

  // #フラグメントを削除
  canonicalizedUri.hash = ''

  return canonicalizedUri.toString()
}