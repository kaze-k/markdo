import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
// import rehypeSlug from 'rehype-slug'
import GithubSlugger from 'github-slugger'
import rehypeRaw from 'rehype-raw'
import { readdir, readFile } from 'node:fs/promises'
import { parseMarkdown } from '@nuxtjs/mdc/runtime'
import matter from 'gray-matter'
import remarkGfm from 'remark-gfm'
import { extractFlatToc } from './toc.js'
import { sanitizeHastNode, type HastNode } from './hast.js'
import {toString} from "hast-util-to-string"
import { headingRank } from 'hast-util-heading-rank'
import { visit } from "unist-util-visit"

type MdcNode = {
    type?: string
    tag?: string
    children?: MdcNode[]
}

function collectHastTags(node: HastNode, tags: string[] = []) {
    if (node.type === 'element' && node.tagName) {
        tags.push(node.tagName)
    }

    if (node.children) {
        node.children.forEach((child) => collectHastTags(child, tags))
    }

    return tags
}

function collectMdcTags(node: MdcNode, tags: string[] = []) {
    if (node.type === 'element' && node.tag) {
        tags.push(node.tag)
    }

    if (node.children) {
        node.children.forEach((child) => collectMdcTags(child, tags))
    }

    return tags
}

function collectText(node: HastNode): string {
    if (node.type === 'text') {
        return node.value ?? ''
    }

    if (!node.children) {
        return ''
    }

    return node.children.map(collectText).join('')
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

function compareTagSequences(hastTags: string[], mdcTags: string[]) {
    const maxLength = Math.max(hastTags.length, mdcTags.length)
    const rows: Array<{ index: number; hast?: string; mdc?: string; same: boolean }> = []
    const mismatches: Array<{ index: number; hast?: string; mdc?: string }> = []

    for (let index = 0; index < maxLength; index++) {
        const hast = hastTags[index]
        const mdc = mdcTags[index]
        const same = hast === mdc

        rows.push({
            index,
            hast,
            mdc,
            same
        })

        if (!same) {
            mismatches.push({
                index,
                hast,
                mdc
            })
        }
    }

    return {
        isConsistent: mismatches.length === 0,
        hastCount: hastTags.length,
        mdcCount: mdcTags.length,
        rows,
        mismatches
    }
}

function addHeadIdSlug(tree) {
    const slugger = new GithubSlugger()

    visit(tree, 'element', (node) => {
        if (headingRank(node) && !node.properties.id) {
            node.properties.id = slugger.slug(toString(node))
        }
    })

    return tree
}

async function compareMarkdownAst(file: string, md: string) {
    const { content, data } = matter(md)
    const mdProcessor = unified()
        .use(remarkParse)
        .use(remarkGfm)

    const hastProcessor = mdProcessor()
        .use(remarkRehype, { allowDangerousHtml: true })
        .use(rehypeRaw)
        // .use(rehypeSlug)

    const mdast = mdProcessor().parse(content)
    const hast = addHeadIdSlug(removeEmptyHastNodes(hastProcessor.runSync(mdast))) as HastNode
    // const hast = removeEmptyHastNodes(hastProcessor.runSync(mdast)) as HastNode
    const tocResult = { title: '', links: extractFlatToc(content) }
    const mdcResult = await parseMarkdown(md)
    // console.log(mdcResult)

    sanitizeHastNode(hast)
    // console.dir(hast, { depth: null })
    // console.dir(mdcResult.body, { depth: null })

    const hastTags = collectHastTags(hast)
    const mdcTags = collectMdcTags(mdcResult.body as MdcNode)
    const comparison = compareTagSequences(hastTags, mdcTags)

    // console.log(`\n=== ${file} ===`)
    // console.log('frontmatter:', data)
    // console.log('mdc frontmatter:', mdcResult.data)
    // console.dir(hast, { depth: null })
    // console.dir(tocResult, { depth: null })
    // console.dir(mdcResult.toc, { depth: null })
    // console.log('hast tag count:', comparison.hastCount)
    // console.log('mdc tag count:', comparison.mdcCount)
    // console.log('tag sequence consistent:', comparison.isConsistent)
    // console.table(comparison.rows)

    return {
        data,
        hast,
        toc: tocResult,
    }
}

async function main() {
    const files = await readdir('./examples')

    for (const file of files) {
        if (!file.endsWith('.md')) {
            continue
        }

        const content = await readFile(`./examples/${file}`, 'utf-8')
        const result = await compareMarkdownAst(file, content)
        console.dir(result, { depth: null })
    }
}

await main()
