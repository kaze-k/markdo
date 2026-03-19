import assert from 'node:assert/strict'
import { access } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const modulePath = resolve(process.cwd(), 'dist', 'index.js')

try {
    await access(modulePath)
} catch {
    assert.fail('dist/index.js was not generated')
}

const module = await import(pathToFileURL(modulePath).href)

assert.equal(typeof module.parseFrontmatterTree, 'function')

const tree = await module.parseFrontmatterTree(resolve(process.cwd(), 'examples', 'index.md'))

assert.equal(tree.type, 'root')
assert.equal(tree.children[0]?.type, 'yaml')
assert.match(tree.children[0]?.value ?? '', /title:/)
