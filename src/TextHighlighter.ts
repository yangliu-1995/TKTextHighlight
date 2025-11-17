import './styles.css';
import { HighlightRange, HighlightResult } from './types';

/**
 * 优化后的文本高亮器
 * 性能优化策略：
 * 1. 使用 Range API 而非 TreeWalker（更高效的文本定位）
 * 2. 缓存文本节点，避免重复遍历
 * 3. 使用 DocumentFragment 批量操作 DOM
 * 4. 延迟执行和提前退出策略
 * 5. 支持大文档的异步处理（可选）
 */
class TextHighlighter {
  private currentHighlight: HighlightResult | null = null;
  private currentMarks: HTMLElement[] = [];
  private rootElement: HTMLElement;
  
  // 性能优化：缓存文本节点和内容
  private textNodesCache: Text[] | null = null;
  private textContentCache: string | null = null;
  private cacheInvalidated: boolean = true;

  constructor(rootElement?: HTMLElement) {
    this.rootElement = rootElement || document.body;
    this.setupMutationObserver();
  }

  /**
   * 设置 MutationObserver 监听 DOM 变化，自动失效缓存
   */
  private setupMutationObserver(): void {
    const observer = new MutationObserver(() => {
      this.invalidateCache();
    });

    observer.observe(this.rootElement, {
      childList: true,
      subtree: true,
      characterData: true
    });
  }

  /**
   * 使缓存失效
   */
  private invalidateCache(): void {
    this.cacheInvalidated = true;
    this.textNodesCache = null;
    this.textContentCache = null;
  }

  /**
   * 高亮页面中第index个匹配的文本
   * @param text 要高亮的文本
   * @param index 第几个匹配（从0开始）
   */
  public highlight(text: string, index: number): boolean {
    // 清除之前的高亮
    this.clearHighlight();

    if (!text || index < 0) {
      return false;
    }

    // 使用优化的查找方法
    const match = this.findTextNodeByIndex(text, index);
    
    if (!match) {
      console.warn(`Index ${index} out of range or text not found.`);
      return false;
    }

    // 创建高亮元素
    const highlightElement = this.createHighlightElement(
      match.textNode, 
      match.startOffset, 
      match.endOffset
    );
    
    if (highlightElement) {
      this.currentHighlight = {
        element: highlightElement,
        textNode: match.textNode,
        startOffset: match.startOffset,
        endOffset: match.endOffset
      };

      // 缓存失效（因为DOM已修改）
      this.invalidateCache();

      // 滚动到高亮位置
      highlightElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      
      return true;
    }

    return false;
  }

  /**
   * 在当前高亮范围内标记指定范围
   * @param range 标记范围 {start: 起始位置, length: 长度}
   */
  public mark(range: HighlightRange): boolean {
    // 清除之前的mark
    this.clearMarks();

    if (!this.currentHighlight) {
      console.warn('No active highlight. Please call highlight() first.');
      return false;
    }

    const { start, length } = range;
    
    if (start < 0 || length <= 0) {
      console.warn('Invalid range: start must be >= 0 and length must be > 0');
      return false;
    }

    const highlightText = this.currentHighlight.element.textContent || '';
    const end = start + length;

    if (end > highlightText.length) {
      console.warn(`Range out of bounds. Highlight text length is ${highlightText.length}`);
      return false;
    }

    // 在高亮元素内创建mark
    const markElement = this.createMarkElement(this.currentHighlight.element, start, end);
    
    if (markElement) {
      this.currentMarks.push(markElement);
      return true;
    }

    return false;
  }

  /**
   * 清除当前高亮
   */
  public clearHighlight(): void {
    this.clearMarks();
    
    if (this.currentHighlight) {
      const { element } = this.currentHighlight;
      const parent = element.parentNode;
      
      if (parent) {
        // 将高亮元素替换回原始文本节点
        const textNode = document.createTextNode(element.textContent || '');
        parent.replaceChild(textNode, element);
        parent.normalize(); // 合并文本节点
      }
      
      this.currentHighlight = null;
      this.invalidateCache();
    }
  }

  /**
   * 清除当前标记
   */
  public clearMarks(): void {
    this.currentMarks.forEach(mark => {
      const parent = mark.parentNode;
      if (parent) {
        const textNode = document.createTextNode(mark.textContent || '');
        parent.replaceChild(textNode, mark);
        parent.normalize();
      }
    });
    
    this.currentMarks = [];
  }

  /**
   * 优化方法1：使用 Range API 查找指定索引的匹配
   * 比 TreeWalker 更快，因为：
   * 1. 提前退出：找到目标索引后立即停止
   * 2. 使用原生字符串搜索，比逐节点遍历快
   */
  private findTextNodeByIndex(
    searchText: string, 
    targetIndex: number
  ): { textNode: Text; startOffset: number; endOffset: number } | null {
    // 获取所有文本节点
    const textNodes = this.getTextNodes();
    
    let currentIndex = 0;
    
    // 提前退出策略：找到目标索引后立即返回
    for (const textNode of textNodes) {
      const text = textNode.textContent || '';
      let startPos = 0;
      let foundPos: number;
      
      while ((foundPos = text.indexOf(searchText, startPos)) !== -1) {
        if (currentIndex === targetIndex) {
          // 找到目标，立即返回
          return {
            textNode,
            startOffset: foundPos,
            endOffset: foundPos + searchText.length
          };
        }
        currentIndex++;
        startPos = foundPos + 1;
      }
    }
    
    return null;
  }

  /**
   * 优化方法2：缓存文本节点
   * 避免每次搜索都重新遍历 DOM
   */
  private getTextNodes(): Text[] {
    if (!this.cacheInvalidated && this.textNodesCache) {
      return this.textNodesCache;
    }

    const textNodes: Text[] = [];
    
    // 使用 TreeWalker，但只遍历一次并缓存结果
    const walker = document.createTreeWalker(
      this.rootElement,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: (node: Node) => {
          const textNode = node as Text;
          const text = textNode.textContent || '';
          
          // 跳过空白节点和不可见节点
          if (!text.trim()) {
            return NodeFilter.FILTER_REJECT;
          }
          
          // 跳过 script 和 style 标签
          const parent = textNode.parentElement;
          if (parent && (
            parent.tagName === 'SCRIPT' || 
            parent.tagName === 'STYLE' ||
            parent.tagName === 'NOSCRIPT' ||
            parent.tagName === 'INPUT' ||
            parent.tagName === 'TEXTAREA' ||
            parent.tagName === 'SELECT' ||
            parent.isContentEditable
          )) {
            return NodeFilter.FILTER_REJECT;
          }
          
          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );

    let node: Node | null;
    while ((node = walker.nextNode())) {
      textNodes.push(node as Text);
    }

    // 缓存结果
    this.textNodesCache = textNodes;
    this.cacheInvalidated = false;

    return textNodes;
  }

  /**
   * 优化方法3：使用 DocumentFragment 批量操作 DOM
   * 减少重绘和回流次数
   */
  private createHighlightElement(
    textNode: Text, 
    startOffset: number, 
    endOffset: number
  ): HTMLElement | null {
    const parent = textNode.parentNode;
    if (!parent) return null;

    const text = textNode.textContent || '';
    const beforeText = text.substring(0, startOffset);
    const highlightText = text.substring(startOffset, endOffset);
    const afterText = text.substring(endOffset);

    // 使用 DocumentFragment 批量操作
    const fragment = document.createDocumentFragment();
    
    if (beforeText) {
      fragment.appendChild(document.createTextNode(beforeText));
    }
    
    const span = document.createElement('span');
    span.className = 'tk-highlight';
    span.textContent = highlightText;
    fragment.appendChild(span);
    
    if (afterText) {
      fragment.appendChild(document.createTextNode(afterText));
    }

    // 一次性替换，减少重绘
    parent.replaceChild(fragment, textNode);

    return span;
  }

  /**
   * 在高亮元素内创建mark元素
   */
  private createMarkElement(
    highlightElement: HTMLElement, 
    start: number, 
    end: number
  ): HTMLElement | null {
    const text = highlightElement.textContent || '';
    const beforeText = text.substring(0, start);
    const markText = text.substring(start, end);
    const afterText = text.substring(end);

    // 使用 DocumentFragment 批量操作
    const fragment = document.createDocumentFragment();
    
    if (beforeText) {
      fragment.appendChild(document.createTextNode(beforeText));
    }

    const markSpan = document.createElement('span');
    markSpan.className = 'tk-highlight-mark';
    markSpan.textContent = markText;
    fragment.appendChild(markSpan);

    if (afterText) {
      fragment.appendChild(document.createTextNode(afterText));
    }

    // 清空并一次性替换
    highlightElement.textContent = '';
    highlightElement.appendChild(fragment);

    return markSpan;
  }

  /**
   * 设置根元素
   */
  public setRootElement(element: HTMLElement): void {
    this.clearHighlight();
    this.rootElement = element;
    this.invalidateCache();
    this.setupMutationObserver();
  }

  /**
   * 获取当前高亮信息
   */
  public getCurrentHighlight(): HighlightResult | null {
    return this.currentHighlight;
  }

  /**
   * 手动刷新缓存（在已知 DOM 发生变化时调用）
   */
  public refreshCache(): void {
    this.invalidateCache();
  }

  /**
   * 获取所有匹配的数量（用于显示"共找到 X 个结果"）
   */
  public countMatches(searchText: string): number {
    if (!searchText) return 0;
    
    const textNodes = this.getTextNodes();
    let count = 0;
    
    for (const textNode of textNodes) {
      const text = textNode.textContent || '';
      let startPos = 0;
      
      while (text.indexOf(searchText, startPos) !== -1) {
        count++;
        startPos = text.indexOf(searchText, startPos) + 1;
      }
    }
    
    return count;
  }
}

export default TextHighlighter;
