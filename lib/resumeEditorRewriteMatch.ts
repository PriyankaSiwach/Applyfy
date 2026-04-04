/** Collapse whitespace and unify quotes (legacy / display helpers). */
export function normalizeResumeText(str: string): string {
  return str
    .replace(/\s+/g, " ")
    .replace(/['']/g, "'")
    .replace(/[""]/g, '"')
    .trim();
}

/**
 * Strip all whitespace, punctuation, and symbols for matching only.
 * Keeps Unicode letters and numbers; lowercases for comparison.
 */
export function stripForMatch(str: string): string {
  let out = "";
  for (const ch of str) {
    if (/[\p{L}\p{N}]/u.test(ch)) {
      out += ch.toLowerCase();
    }
  }
  return out;
}

type TextCharRef = { node: Text; offset: number };

function buildFlatAndSources(root: HTMLElement): {
  flat: string;
  sources: TextCharRef[];
} {
  const sources: TextCharRef[] = [];
  let flat = "";
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let n: Node | null;
  while ((n = walker.nextNode())) {
    const tn = n as Text;
    const text = tn.textContent ?? "";
    for (let i = 0; i < text.length; i++) {
      flat += text[i]!;
      sources.push({ node: tn, offset: i });
    }
  }
  return { flat, sources };
}

function buildStrippedIndices(flat: string): {
  stripped: string;
  flatIdx: number[];
} {
  let stripped = "";
  const flatIdx: number[] = [];
  for (let i = 0; i < flat.length; i++) {
    const ch = flat[i]!;
    if (/[\p{L}\p{N}]/u.test(ch)) {
      stripped += ch.toLowerCase();
      flatIdx.push(i);
    }
  }
  return { stripped, flatIdx };
}

function findStrippedMatchRange(
  originalText: string,
  strippedEditor: string,
  flatIdx: number[],
): { start: number; end: number } | null {
  const needle = stripForMatch(originalText);
  if (needle.length === 0) return null;
  const si = strippedEditor.indexOf(needle);
  if (si === -1) return null;
  const last = si + needle.length - 1;
  if (last >= flatIdx.length) return null;
  return {
    start: flatIdx[si]!,
    end: flatIdx[last]! + 1,
  };
}

function replaceFlatRangeWithRewritten(
  sources: TextCharRef[],
  flatStart: number,
  flatEnd: number,
  rewrittenText: string,
): boolean {
  if (
    flatStart < 0 ||
    flatEnd > sources.length ||
    flatStart >= flatEnd
  ) {
    return false;
  }
  const startSrc = sources[flatStart]!;
  const endSrc = sources[flatEnd - 1]!;
  const range = document.createRange();
  range.setStart(startSrc.node, startSrc.offset);
  range.setEnd(endSrc.node, endSrc.offset + 1);
  range.deleteContents();

  const span = document.createElement("span");
  span.className = "just-applied";
  span.textContent = rewrittenText;
  span.style.background = "rgba(16,185,129,0.15)";
  span.style.borderRadius = "3px";
  span.style.transition = "background 2s ease";

  range.insertNode(span);

  window.setTimeout(() => {
    span.style.background = "transparent";
  }, 100);

  return true;
}

/**
 * Find stripped-alphanumeric match in editor DOM and replace with rewritten text
 * on real text nodes (Range). Returns true if already applied, replaced, or noop ok.
 */
export function findAndReplaceInResumeEditor(
  editor: HTMLElement,
  originalText: string,
  rewrittenText: string,
): boolean {
  const { flat, sources } = buildFlatAndSources(editor);
  const { stripped: strippedEditor, flatIdx } = buildStrippedIndices(flat);

  const rewStripped = stripForMatch(rewrittenText);
  if (rewStripped.length >= 8 && strippedEditor.includes(rewStripped)) {
    return true;
  }

  const range = findStrippedMatchRange(
    originalText,
    strippedEditor,
    flatIdx,
  );
  if (!range) {
    return false;
  }

  return replaceFlatRangeWithRewritten(
    sources,
    range.start,
    range.end,
    rewrittenText,
  );
}

/** Schedule removal of just-applied class after highlight fade (ms). */
export function scheduleRemoveJustAppliedClass(editor: HTMLElement, ms: number): void {
  window.setTimeout(() => {
    editor.querySelectorAll(".just-applied").forEach((el) => {
      el.classList.remove("just-applied");
      const h = el as HTMLElement;
      h.style.background = "";
      h.style.borderRadius = "";
      h.style.transition = "";
    });
  }, ms);
}

type UnwrapFn = () => void;

/**
 * Temporarily highlight matching text in editor. Returns cleanup or null.
 */
export function highlightRewriteInEditor(
  editor: HTMLElement,
  originalText: string,
): UnwrapFn | null {
  const { flat, sources } = buildFlatAndSources(editor);
  const { stripped: strippedEditor, flatIdx } = buildStrippedIndices(flat);
  const rangeFlat = findStrippedMatchRange(
    originalText,
    strippedEditor,
    flatIdx,
  );
  if (!rangeFlat) return null;

  const startSrc = sources[rangeFlat.start]!;
  const endSrc = sources[rangeFlat.end - 1]!;
  const range = document.createRange();
  range.setStart(startSrc.node, startSrc.offset);
  range.setEnd(endSrc.node, endSrc.offset + 1);

  const contents = range.extractContents();
  const span = document.createElement("span");
  span.className = "temp-hover-highlight";
  span.appendChild(contents);
  range.insertNode(span);

  return () => {
    const parent = span.parentNode;
    if (!parent) return;
    while (span.firstChild) {
      parent.insertBefore(span.firstChild, span);
    }
    parent.removeChild(span);
  };
}
