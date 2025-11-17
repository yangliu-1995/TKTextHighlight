import TextHighlighter from './TextHighlighter';

export default TextHighlighter;
export * from './types';

// 自动初始化全局实例
if (typeof window !== 'undefined') {
  (window as any).tkHighlighter = new TextHighlighter();
}
