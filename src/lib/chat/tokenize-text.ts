/**
 * Append-only tokenization for smooth streaming reveal.
 * Tokens are "word + trailing whitespace" (or a pure whitespace run when flushed).
 * Incomplete markdown delimiters are soft-closed at render time — not here.
 */

export type TokenPullResult = {
  tokens: string[];
  /** Uncommitted suffix (typically an incomplete word). */
  remainder: string;
};

/**
 * Pull completed tokens from a growing buffer.
 * A word is complete when it is followed by whitespace (consumed into the token)
 * or when `flush` is true (stream ended / force drain).
 */
export function pullCompletedTokens(
  buffer: string,
  flush: boolean,
): TokenPullResult {
  if (!buffer) {
    return { tokens: [], remainder: "" };
  }

  const tokens: string[] = [];
  let rest = buffer;

  // Leading whitespace is immediately revealable (paragraph breaks, etc.).
  const leadingWs = rest.match(/^\s+/);
  if (leadingWs) {
    tokens.push(leadingWs[0]);
    rest = rest.slice(leadingWs[0].length);
  }

  // Complete words: non-whitespace run + following whitespace.
  const completeWord = /^(\S+\s+)/;
  while (true) {
    const match = completeWord.exec(rest);
    if (!match) {
      break;
    }
    tokens.push(match[1]);
    rest = rest.slice(match[1].length);
  }

  if (flush && rest.length > 0) {
    tokens.push(rest);
    rest = "";
  }

  return { tokens, remainder: rest };
}

/** Join tokens back into plain text (for crossfade / a11y). */
export function joinTokens(tokens: readonly string[]): string {
  return tokens.join("");
}
