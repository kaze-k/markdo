import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import extractToc from 'remark-extract-toc'
import GithubSlugger from 'github-slugger'

export type TocNode = {
    id: string
    depth: number
    text: string
}

const slugger = new GithubSlugger()

export function extractFlatToc(content: string): TocNode[] {
    return unified()
        .use(remarkParse)
        .use(remarkGfm)
        .use(extractToc, { flatten: true })
        .processSync(content).result
        .map((node) => ({
            id: slugger.slug(node.value),
            depth: node.depth,
            text: node.value,
        }))
}
