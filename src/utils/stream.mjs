// @ts-check

/**
 * Parse a styled string into visible characters with their ANSI prefixes.
 * ANSI codes that precede a visible character are attached to that character.
 * Any trailing ANSI codes (after the last visible char) are returned separately.
 *
 * @param {string} styled - ANSI-styled string
 * @returns {{ tokens: { char: string; ansi: string }[]; trailingAnsi: string }}
 */
function getVisibleCharTokens(styled) {
  const tokens = []
  let i = 0
  let currentAnsi = ''

  while (i < styled.length) {
    if (styled[i] === '\x1b') {
      const end = styled.indexOf('m', i)
      if (end === -1) break
      currentAnsi += styled.slice(i, end + 1)
      i = end + 1
    } else {
      tokens.push({ char: styled[i], ansi: currentAnsi })
      currentAnsi = ''
      i++
    }
  }

  return { tokens, trailingAnsi: currentAnsi }
}

/**
 * Stream an ANSI-styled string to stdout word by word, mimicking
 * SSE token streaming. Uses `Intl.Segmenter` to find word boundaries.
 *
 * @param {string} styledString - Full output string with ANSI escape codes
 * @param {number} [delayMs=15] - Delay between each word segment in ms
 */
export async function streamToStdout(styledString, delayMs = 15) {
  if (!styledString) return

  const { tokens, trailingAnsi } = getVisibleCharTokens(styledString)

  if (tokens.length === 0) {
    process.stdout.write(styledString + trailingAnsi)
    return
  }

  // Build visible text for Intl.Segmenter
  const visibleText = tokens.map(t => t.char).join('')

  const segmenter = new Intl.Segmenter('zh-CN', { granularity: 'word' })
  const segments = [...segmenter.segment(visibleText)]

  let pos = 0
  for (const seg of segments) {
    const chunk = tokens.slice(pos, pos + seg.segment.length)
    const output = chunk.map(t => t.ansi + t.char).join('')
    process.stdout.write(output)
    pos += seg.segment.length

    if (pos < tokens.length) {
      await new Promise(r => setTimeout(r, delayMs))
    }
  }

  // Restore terminal state from any trailing ANSI codes (e.g. \x1b[0m)
  if (trailingAnsi) {
    process.stdout.write(trailingAnsi)
  }

  // Final newline to match console.log behavior
  process.stdout.write('\n')
}
