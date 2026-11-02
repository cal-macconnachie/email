import DOMPurify from 'dompurify'

// URLs (http/https or bare www.) and email addresses in plain text
const LINK_PATTERN = /\b(?:https?:\/\/|www\.)[^\s<>"']+|\b[\w.+-]+@[\w-]+(?:\.[\w-]+)+\b/gi
// Punctuation that usually ends a sentence rather than the URL
const TRAILING_PUNCTUATION = /[.,;:!?'")\]}]+$/

// Never turn text inside these into links
const SKIP_LINKIFY = new Set(['A', 'BUTTON', 'SCRIPT', 'STYLE', 'TEXTAREA', 'TITLE'])

function hrefFor(match: string): string {
  if (!match.includes('://') && match.includes('@') && !match.startsWith('www.')) {
    return `mailto:${match}`
  }
  return match.startsWith('www.') ? `https://${match}` : match
}

/**
 * Split text into plain strings and link matches, trimming sentence punctuation off
 * the end of each link (keeping a closing bracket when the link opened one)
 */
function splitLinks(text: string): Array<string | { text: string; href: string }> {
  const parts: Array<string | { text: string; href: string }> = []
  let last = 0
  for (const match of text.matchAll(LINK_PATTERN)) {
    let linkText = match[0]
    const trailing = linkText.match(TRAILING_PUNCTUATION)?.[0] ?? ''
    if (trailing) {
      linkText = linkText.slice(0, -trailing.length)
      // Keep a ")" that closes a "(" inside the URL, e.g. wikipedia links
      if (trailing.startsWith(')') && (linkText.split('(').length > linkText.split(')').length)) {
        linkText += ')'
      }
    }
    if (!linkText) continue
    const start = match.index ?? 0
    if (start > last) parts.push(text.slice(last, start))
    parts.push({ text: linkText, href: hrefFor(linkText) })
    last = start + linkText.length
  }
  if (last < text.length) parts.push(text.slice(last))
  return parts
}

/** Open web links outside the app; leave mailto and in-page anchors alone */
function setLinkTarget(anchor: HTMLAnchorElement) {
  const href = anchor.getAttribute('href') ?? ''
  if (/^https?:/i.test(href)) {
    anchor.setAttribute('target', '_blank')
    anchor.setAttribute('rel', 'noopener noreferrer')
  }
}

function linkifyTextNodes(root: Node) {
  const walker = root.ownerDocument!.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  const textNodes: Text[] = []
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    let parent = node.parentElement
    let skip = false
    while (parent) {
      if (SKIP_LINKIFY.has(parent.tagName)) {
        skip = true
        break
      }
      parent = parent.parentElement
    }
    if (!skip && LINK_PATTERN.test(node.textContent ?? '')) textNodes.push(node as Text)
    LINK_PATTERN.lastIndex = 0
  }

  for (const node of textNodes) {
    const doc = node.ownerDocument
    const fragment = doc.createDocumentFragment()
    for (const part of splitLinks(node.textContent ?? '')) {
      if (typeof part === 'string') {
        fragment.append(part)
      } else {
        const anchor = doc.createElement('a')
        anchor.href = part.href
        anchor.textContent = part.text
        fragment.append(anchor)
      }
    }
    node.replaceWith(fragment)
  }
}

/**
 * Sanitize an HTML email body (emails are untrusted: no scripts, event handlers or
 * javascript: links), turn bare URLs and addresses into links, and open web links
 * in a new tab. Style elements are kept so the email keeps its layout.
 */
export function renderHtmlEmail(html: string): string {
  const body = DOMPurify.sanitize(html, {
    FORCE_BODY: true,
    RETURN_DOM: true,
    ADD_TAGS: ['style'],
    FORBID_TAGS: ['form', 'input', 'button', 'textarea', 'select'],
  }) as HTMLElement
  linkifyTextNodes(body)
  body.querySelectorAll('a').forEach(setLinkTarget)
  return body.innerHTML
}

/** Escape a plain-text email body, link its URLs and addresses, and keep its line breaks */
export function renderTextEmail(text: string): string {
  const container = document.createElement('div')
  for (const part of splitLinks(text)) {
    if (typeof part === 'string') {
      container.append(part)
    } else {
      const anchor = document.createElement('a')
      anchor.href = part.href
      anchor.textContent = part.text
      setLinkTarget(anchor)
      container.append(anchor)
    }
  }
  return container.innerHTML.replace(/\r?\n/g, '<br>')
}
