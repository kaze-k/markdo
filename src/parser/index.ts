import GithubSlugger from 'github-slugger'
import { headingRank } from 'hast-util-heading-rank'
import { visit } from "unist-util-visit"
import type { Root } from 'hast'
import {toString} from "hast-util-to-string"
import matter from 'gray-matter'
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import rehypeRaw from 'rehype-raw'
import remarkGfm from 'remark-gfm'
import remarkRehype from 'remark-rehype'
import extractToc from 'remark-extract-toc'

interface HastNode {
    type?: string
    tagName?: string
    value?: string
    position?: unknown
    data?: { quirksMode?: unknown } & object
    properties?: Record<string, unknown>
    children?: HastNode[]
}

interface TocNode {
    id: string
    depth: number
    text: string
}

function addHeadIdSlug(tree: Root): Root {
  const slugger = new GithubSlugger()

    visit(tree, 'element', (node) => {
        if (headingRank(node) && !node.properties.id) {
            node.properties.id = slugger.slug(toString(node))
        }
    })

    return tree
}

function removeEmptyHastNodes(node: HastNode): HastNode | null {
    if (node.type === 'text' && /^\s*$/.test(node.value ?? '')) {
        return null
    }

    if (node.children) {
        node.children = node.children
            .map(removeEmptyHastNodes)
            .filter((child): child is HastNode => child !== null)
    }

    if (
        node.type === 'element' &&
        node.tagName === 'p' &&
        node.children?.every((child) => child.type === 'text' && /^\s*$/.test(child.value ?? ''))
    ) {
        return null
    }

    return node
}

const mdProcessor = unified()
    .use(remarkParse)
    .use(remarkGfm)

function sanitizeHastNode(node: HastNode) {
    delete node.position

    if (node.data) {
        delete node.data.quirksMode

        if (Object.keys(node.data).length === 0) {
            delete node.data
        }
    }

    if (node.children) {
        node.children.forEach(sanitizeHastNode)
    }
}

function compileHast(content: string): HastNode {
    const hastProcessor = mdProcessor()
        .use(remarkRehype, { allowDangerousHtml: true })
        .use(rehypeRaw)

    const mdast = mdProcessor().parse(content)
    const root = hastProcessor.runSync(mdast)
    const fiteredRoot = removeEmptyHastNodes(root) as Root
    const hast = addHeadIdSlug(fiteredRoot) as HastNode
    sanitizeHastNode(hast)

    return hast
}

function extractFlatToc(content: string): TocNode[] {
  const slugger = new GithubSlugger()

  return mdProcessor()
      .use(extractToc, { flatten: true })
      .processSync(content).result
      .map((node) => ({
          id: slugger.slug(node.value),
          depth: node.depth,
          text: node.value,
      }))
}

interface Toc {
    title: string
    links: TocNode[]
}

function compleToc(title: string, content: string): Toc {
  return { title, links: extractFlatToc(content) }
}

interface MdAstResult {
    data: Record<string, unknown>
    body: HastNode
    toc: Toc
}

export function parseMarkdown(md: string): MdAstResult {
  const { content, data } = matter(md)

  return {
    data,
    body: compileHast(content),
    toc: compleToc(data.title, content)
  }
}
