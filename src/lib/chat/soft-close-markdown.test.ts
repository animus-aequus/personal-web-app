import { describe, expect, it } from "vitest";

import { softCloseMarkdown } from "@/lib/chat/soft-close-markdown";

describe("softCloseMarkdown", () => {
  it("leaves complete markdown unchanged", () => {
    const input = "Hello **world** and `code`.";
    expect(softCloseMarkdown(input)).toBe(input);
  });

  it("closes open emphasis and inline code that already have payload", () => {
    expect(softCloseMarkdown("Hello **world")).toBe("Hello **world**");
    expect(softCloseMarkdown("Hello _world")).toBe("Hello _world_");
    expect(softCloseMarkdown("see `code")).toBe("see `code`");
  });

  it("does not close an empty opener at the tip", () => {
    expect(softCloseMarkdown("Hello **")).toBe("Hello **");
    expect(softCloseMarkdown("Hello _")).toBe("Hello _");
    expect(softCloseMarkdown("Hello `")).toBe("Hello `");
  });

  it("closes an open fence and leaves a complete fence unchanged", () => {
    const open = "```ts\nconst x = 1;";
    expect(softCloseMarkdown(open)).toBe("```ts\nconst x = 1;\n```");

    const closed = "```ts\nconst x = 1;\n```";
    expect(softCloseMarkdown(closed)).toBe(closed);
  });

  it("does not treat an unordered list marker as italic", () => {
    const input = "* one\n* two";
    expect(softCloseMarkdown(input)).toBe(input);
  });

  it("does not invent a closing link delimiter", () => {
    const input = "See [docs](https://example.com";
    expect(softCloseMarkdown(input)).toBe(input);
  });
});
