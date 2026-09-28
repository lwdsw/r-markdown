const DEFAULT_MAX_CHARS = 12_000

/** 按空行切分长文，尽量保持 Markdown 段落和组件块完整。 */
export function chunkMarkdown(markdown: string, maxChars = DEFAULT_MAX_CHARS): string[] {
  if (markdown.length <= maxChars) return [markdown]
  const blocks = markdown.split(/\n{2,}/)
  const chunks: string[] = []
  let current = ''

  for (const block of blocks) {
    if (block.length > maxChars) {
      if (current) chunks.push(current)
      for (let offset = 0; offset < block.length; offset += maxChars) {
        chunks.push(block.slice(offset, offset + maxChars))
      }
      current = ''
      continue
    }
    const candidate = current ? `${current}\n\n${block}` : block
    if (candidate.length > maxChars) {
      chunks.push(current)
      current = block
    } else current = candidate
  }
  if (current) chunks.push(current)
  return chunks
}
