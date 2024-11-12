import canonicalizeUrl from '../utils/canonicalizeUri';
import parseRobotsTxt from './parseRobotsTxt';
import matchesRule from './matchesRule';

export default class RobotsTxt {
  content: string;
  baseUrl: string;
  allowList: string[];
  disallowList: string[];
  crawlDelay: number | null;
  sitemap: string | null;

  constructor(content: string, baseUrl: string) {
    this.content = content;
    this.baseUrl = baseUrl;
    const { allowList, disallowList, crawlDelay, sitemap } = parseRobotsTxt(content, baseUrl);
    this.allowList = allowList;
    this.disallowList = disallowList;
    this.crawlDelay = crawlDelay;
    this.sitemap = sitemap;
  }
  isAllowed(uri: string): boolean {
    const url = canonicalizeUrl(uri, this.baseUrl);

    if ( this.disallowList.some((rule) => matchesRule(uri, rule)) ) {
      if ( this.allowList.some((rule) => matchesRule(uri, rule)) ) {
        return true;
      } else {
        return false;
      }
    } else {
      return true;
    }
  }
}