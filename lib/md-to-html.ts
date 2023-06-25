import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import rehypeStringify from "rehype-stringify";
import remarkGFM from "remark-gfm";
import rehypePrism from "rehype-prism-plus";

const remarkHtml = unified()
  .use(remarkParse)
  .use(remarkRehype, {
    allowDangerousHtml: true,
  })
  .use(remarkGFM)
  .use(rehypePrism, {
    ignoreMissing: true,
  })
  .use(rehypeStringify);

export const mdToHTML = (md: string) => {
  const vfile = remarkHtml.processSync(md);
  return String(vfile);
};
