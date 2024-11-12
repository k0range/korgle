export default async function treeConsole(tree: {name: string, children?: typeof tree}[], spaces: number = 0) {
  tree.forEach((node) => {
    console.log(' '.repeat(spaces*2) + ( (spaces>0) ? '└ ' : '─ ' ) + node.name);
    if (node.children) {
      treeConsole(node.children, spaces+1);
    }
  })
}