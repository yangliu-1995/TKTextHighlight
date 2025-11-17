export interface HighlightRange {
  start: number;
  length: number;
}

export interface HighlightResult {
  element: HTMLElement;
  textNode: Text;
  startOffset: number;
  endOffset: number;
}

