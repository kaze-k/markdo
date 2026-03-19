import assert from 'node:assert/strict'
import { access } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const modulePath = resolve(process.cwd(), 'dist', 'toc.js')

try {
    await access(modulePath)
} catch {
    assert.fail('dist/toc.js was not generated')
}

const { extractFlatToc } = await import(pathToFileURL(modulePath).href)

assert.equal(typeof extractFlatToc, 'function')
assert.deepEqual(
    extractFlatToc('# Top\n\n## Middle\n\n### Bottom\n'),
    [
        { id: 'top', depth: 1, text: 'Top' },
        { id: 'middle', depth: 2, text: 'Middle' },
        { id: 'bottom', depth: 3, text: 'Bottom' }
    ]
)
