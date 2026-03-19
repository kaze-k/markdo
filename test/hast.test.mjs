import assert from 'node:assert/strict'
import { access } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const modulePath = resolve(process.cwd(), 'dist', 'hast.js')

try {
    await access(modulePath)
} catch {
    assert.fail('dist/hast.js was not generated')
}

const { sanitizeHastNode } = await import(pathToFileURL(modulePath).href)

const hast = {
    type: 'root',
    position: { start: { line: 1, column: 1 } },
    data: { quirksMode: false, source: 'rehype' },
    children: [
        {
            type: 'element',
            tagName: 'p',
            position: { start: { line: 1, column: 1 } },
            children: [{ type: 'text', value: 'hello' }]
        }
    ]
}

sanitizeHastNode(hast)

assert.deepEqual(hast, {
    type: 'root',
    data: { source: 'rehype' },
    children: [
        {
            type: 'element',
            tagName: 'p',
            children: [{ type: 'text', value: 'hello' }]
        }
    ]
})
