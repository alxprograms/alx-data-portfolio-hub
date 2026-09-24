export type MarkdownSection = {
  id: string;
  title: string;
};

function markdownHeadingToText(value: string) {
  return value
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[`*_~]/g, "")
    .replace(/\\([\\`*{}\[\]()#+.!_>-])/g, "$1")
    .replace(/<[^>]+>/g, "")
    .trim();
}

function sectionId(value: string) {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
}

export function extractMarkdownSections(markdown: string): MarkdownSection[] {
  const sections: MarkdownSection[] = [];
  const usedIds = new Map<string, number>();
  let fenceCharacter = "";
  let fenceLength = 0;

  markdown.split(/\r?\n/).forEach((line) => {
    const fence = line.match(/^\s{0,3}(`{3,}|~{3,})/);

    if (fence) {
      const marker = fence[1];

      if (!fenceCharacter) {
        fenceCharacter = marker[0];
        fenceLength = marker.length;
      } else if (marker[0] === fenceCharacter && marker.length >= fenceLength) {
        fenceCharacter = "";
        fenceLength = 0;
      }

      return;
    }

    if (fenceCharacter) {
      return;
    }

    const heading = line.match(/^\s{0,3}##(?!#)\s+(.+?)\s*#*\s*$/);

    if (!heading) {
      return;
    }

    const title = markdownHeadingToText(heading[1]);

    if (!title) {
      return;
    }

    const baseId = sectionId(title) || `section-${sections.length + 1}`;
    const count = (usedIds.get(baseId) ?? 0) + 1;
    usedIds.set(baseId, count);

    sections.push({
      id: count === 1 ? baseId : `${baseId}-${count}`,
      title,
    });
  });

  return sections;
}
