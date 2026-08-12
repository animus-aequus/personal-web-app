/**
 * Soft-close incomplete markdown so react-markdown can render mid-stream
 * without flashing raw delimiters. Does not invent incomplete links.
 *
 * Tip stability: do not soft-close an opener that still has no visible payload
 * (e.g. trailing `**` alone) — that creates empty emphasis nodes which remount
 * the tip on every token and look like flicker.
 */

function isFenceLine(line: string): RegExpMatchArray | null {
  return line.match(/^(`{3,}|~{3,})(.*)$/);
}

/**
 * Append closing delimiters for open emphasis / code constructs.
 * Skips content inside fenced and inline code. Does not soft-close links.
 */
export function softCloseMarkdown(input: string): string {
  if (!input) {
    return input;
  }

  let inFence = false;
  let fenceChar = "";
  let fenceLen = 0;
  let inInlineCode = false;
  let openDoubleStar = false;
  let openDoubleUnderscore = false;
  let openSingleStar = false;
  let openSingleUnderscore = false;
  /** True while the current open construct still has no non-whitespace payload. */
  let emptyInlineCode = false;
  let emptyDoubleStar = false;
  let emptyDoubleUnderscore = false;
  let emptySingleStar = false;
  let emptySingleUnderscore = false;

  const lines = input.split("\n");

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex]!;
    const fence = isFenceLine(line);

    if (fence) {
      const marker = fence[1]!;
      const char = marker[0]!;
      if (!inFence) {
        inFence = true;
        fenceChar = char;
        fenceLen = marker.length;
        inInlineCode = false;
        emptyInlineCode = false;
        continue;
      }
      if (char === fenceChar && marker.length >= fenceLen && fence[2] === "") {
        inFence = false;
        fenceChar = "";
        fenceLen = 0;
        continue;
      }
    }

    if (inFence) {
      continue;
    }

    let i = 0;
    while (i < line.length) {
      const ch = line[i]!;

      if (ch === "`") {
        if (!inInlineCode) {
          inInlineCode = true;
          emptyInlineCode = true;
        } else {
          inInlineCode = false;
          emptyInlineCode = false;
        }
        i += 1;
        continue;
      }

      if (inInlineCode) {
        if (/\S/.test(ch)) {
          emptyInlineCode = false;
        }
        i += 1;
        continue;
      }

      if (ch === "*" && line[i + 1] === "*") {
        if (!openDoubleStar) {
          openDoubleStar = true;
          emptyDoubleStar = true;
        } else {
          openDoubleStar = false;
          emptyDoubleStar = false;
        }
        i += 2;
        continue;
      }

      if (ch === "_" && line[i + 1] === "_") {
        if (!openDoubleUnderscore) {
          openDoubleUnderscore = true;
          emptyDoubleUnderscore = true;
        } else {
          openDoubleUnderscore = false;
          emptyDoubleUnderscore = false;
        }
        i += 2;
        continue;
      }

      if (ch === "*") {
        // Unordered list marker: "* " at line start — not italic.
        if (i === 0 && line[i + 1] === " ") {
          i += 2;
          continue;
        }
        if (!openSingleStar) {
          openSingleStar = true;
          emptySingleStar = true;
        } else {
          openSingleStar = false;
          emptySingleStar = false;
        }
        i += 1;
        continue;
      }

      if (ch === "_") {
        if (!openSingleUnderscore) {
          openSingleUnderscore = true;
          emptySingleUnderscore = true;
        } else {
          openSingleUnderscore = false;
          emptySingleUnderscore = false;
        }
        i += 1;
        continue;
      }

      if (/\S/.test(ch)) {
        if (openDoubleStar) {
          emptyDoubleStar = false;
        }
        if (openDoubleUnderscore) {
          emptyDoubleUnderscore = false;
        }
        if (openSingleStar) {
          emptySingleStar = false;
        }
        if (openSingleUnderscore) {
          emptySingleUnderscore = false;
        }
      }

      i += 1;
    }
  }

  // Hold soft-close for empty openers so the tip AST does not pop empty nodes.
  if (emptyInlineCode) {
    inInlineCode = false;
  }
  if (emptyDoubleStar) {
    openDoubleStar = false;
  }
  if (emptyDoubleUnderscore) {
    openDoubleUnderscore = false;
  }
  if (emptySingleStar) {
    openSingleStar = false;
  }
  if (emptySingleUnderscore) {
    openSingleUnderscore = false;
  }

  let suffix = "";
  if (inInlineCode) {
    suffix += "`";
  }
  if (openDoubleStar) {
    suffix += "**";
  }
  if (openDoubleUnderscore) {
    suffix += "__";
  }
  if (openSingleStar) {
    suffix += "*";
  }
  if (openSingleUnderscore) {
    suffix += "_";
  }
  if (inFence) {
    suffix += `\n${fenceChar.repeat(Math.max(fenceLen, 3))}`;
  }

  return suffix ? input + suffix : input;
}
