export type HastNode = {
    type?: string
    tagName?: string
    value?: string
    position?: unknown
    data?: { quirksMode?: unknown } & object
    properties?: Record<string, unknown>
    children?: HastNode[]
}

export function sanitizeHastNode(node: HastNode) {
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
