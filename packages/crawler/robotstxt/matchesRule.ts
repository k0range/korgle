export default function matchesRule(url: string, rule: string) {
  const regex = new RegExp(`^${rule.replace(/\*/g, '.*')}$`);
  return regex.test(url);
}