const idToComponentType = {
  'w': 'window',
  'b': 'block',
  'i': 'inline',
  't': 'text',
  'p': 'paragraph',
  '1': 'button',
  '2': 'input',
};

let globalNodeId = 0;

class SymbolicExprNode {
  id = globalNodeId++;
  children = [];
  parent = null;
  rawAttributes = '';

  componentType = null;
  attribs = {};
  priority = 1; // Default priority
  dispatchedAttribs = false;

  constructor(parent) {
    this.parent = parent;
  }

  addChild() {
    const newChild = new SymbolicExprNode(this);
    this.children.push(newChild);
    return newChild;
  }

  parseAttribs() {
    const input = this.rawAttributes.trim();
    this.componentType = idToComponentType[input[0]];
    this.attribs = input.slice(1).trim()
      .split(/\s*:/)
      .filter((s) => s.length > 0)
      .reduce((attribs, s, _) => {
        const [key, value] = s.split(/\s+/);
        if (value) {
          attribs[key] = value.replace(/"/g, '').replace(/'/g, '');
        }
        return attribs;
      }, {});
    
    // Extract priority if specified
    if (this.attribs.priority !== undefined) {
      this.priority = parseInt(this.attribs.priority) || 1;
      delete this.attribs.priority; // Remove from attributes as it's not for rendering
    }
  }
}

class StreamingSymbolicExprParser extends EventTarget {
  #root = new SymbolicExprNode(null);
  #currentNode = this.#root;
  #renderQueue = []; // Priority-based render queue
  #renderingInProgress = false;

  append(chunk) {
    try {
      const len = chunk.length;
      for (let i = 0; i < len; i++) {
        const char = chunk[i];
        if (char === '(') {
          // Start a new node
          if (this.#currentNode && this.#currentNode !== this.#root) {
            this.#currentNode.parseAttribs();
            this.#enqueueForRendering(this.#currentNode);
            this.#currentNode.dispatchedAttribs = true;
          }
          this.#currentNode = this.#currentNode.addChild();
          this.dispatchEvent(new CustomEvent('componentPush'));
        } else if (char === ')') {
          // End the current node
          if (!this.#currentNode.dispatchedAttribs && this.#currentNode !== this.#root) {
            this.#currentNode.parseAttribs();
            this.#enqueueForRendering(this.#currentNode);
            this.#currentNode.dispatchedAttribs = true;
          }
          this.#currentNode = this.#currentNode.parent;
          this.dispatchEvent(new CustomEvent('componentPop'));
        } else {
          this.#currentNode.rawAttributes += char;
        }
      }
    } catch (err) {
      console.warn('Failed to parse chunk: ', chunk, err);
    }
  }

  #enqueueForRendering(node) {
    // Add to priority queue
    this.#renderQueue.push(node);
    // Sort by priority (0 = highest priority, 2 = lowest)
    this.#renderQueue.sort((a, b) => a.priority - b.priority);
    
    // Process queue if not already processing
    if (!this.#renderingInProgress) {
      this.#processRenderQueue();
    }
  }

  async #processRenderQueue() {
    this.#renderingInProgress = true;
    
    while (this.#renderQueue.length > 0) {
      const node = this.#renderQueue.shift();
      
      // Dispatch immediately for high priority (0), or with small delay for others
      const delay = node.priority * 10; // 0ms for priority 0, 10ms for priority 1, 20ms for priority 2
      
      if (delay > 0) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
      
      this.dispatchEvent(new CustomEvent('componentAttribsReady', { detail: node }));
    }
    
    this.#renderingInProgress = false;
  }
}

// Demo mode with simulated streaming for testing
export async function sendCompletionsDemo() {
  const out = document.querySelector('textarea#response');
  out.textContent = '';

  const appContainer = document.querySelector('#app');
  appContainer.innerHTML = '';
  let currentElement = appContainer;

  const elementMap = new Map();
  const parser = new StreamingSymbolicExprParser();
  
  // Performance tracking
  const startTime = performance.now();
  let componentsRendered = 0;
  let renderTimes = [];
  
  // Add performance tracking to parser
  parser.addEventListener('componentAttribsReady', (event) => {
    componentsRendered++;
    const renderTime = performance.now() - startTime;
    renderTimes.push(renderTime);
    console.log(`Performance: Component ${componentsRendered} rendered at ${renderTime.toFixed(2)}ms (priority ${event.detail.priority})`);
  });
  
  currentElement = setupParserEventHandlers(parser, currentElement, elementMap, out);

  // Simulate streaming response with priority-based output
  const demoResponse = `(w :priority 1 :grid :cols "repeat(4, 1fr)" :cw "60px" :ch "60px"
  (1 :priority 0 :t "C" :bg "#ff9500")
  (1 :priority 0 :t "±" :bg "#ff9500")
  (1 :priority 0 :t "%" :bg "#ff9500")
  (1 :priority 0 :t "÷" :bg "#ff9500")
  (1 :priority 0 :t "7" :bg "#333333")
  (1 :priority 0 :t "8" :bg "#333333")
  (1 :priority 0 :t "9" :bg "#333333")
  (1 :priority 0 :t "×" :bg "#ff9500")
  (1 :priority 0 :t "4" :bg "#333333")
  (1 :priority 0 :t "5" :bg "#333333")
  (1 :priority 0 :t "6" :bg "#333333")
  (1 :priority 0 :t "−" :bg "#ff9500")
  (1 :priority 0 :t "1" :bg "#333333")
  (1 :priority 0 :t "2" :bg "#333333")
  (1 :priority 0 :t "3" :bg "#333333")
  (1 :priority 0 :t "+" :bg "#ff9500")
  (1 :priority 0 :t "0" :bg "#333333")
  (1 :priority 0 :t "." :bg "#333333")
  (1 :priority 0 :t "=" :bg "#ff9500")
)`;

  // Simulate streaming character by character with small delays
  for (let i = 0; i < demoResponse.length; i++) {
    const char = demoResponse[i];
    out.textContent += char;
    parser.append(char);
    
    // Small delay to simulate streaming
    if (i % 10 === 0) {
      await new Promise(resolve => setTimeout(resolve, 20));
    }
  }
  
  // Display performance summary
  setTimeout(() => {
    const totalTime = performance.now() - startTime;
    console.log(`Performance Summary:
    - Total components: ${componentsRendered}
    - Total time: ${totalTime.toFixed(2)}ms
    - Average time per component: ${(totalTime / componentsRendered).toFixed(2)}ms
    - Priority-based rendering enabled
    - Streaming optimization active`);
  }, 1000);
}

// Optimized style application function
function applyNodeStyles(element, node) {
  element.style.display = 'block';

  // Container styles
  if (node.componentType === 'window' || node.componentType === 'block') {
    if (node.attribs['w']) element.style.width = node.attribs['w'];
    if (node.attribs['h']) element.style.height = node.attribs['h'];
    if (node.attribs['bg']) element.style.backgroundColor = node.attribs['bg'];

    // Layout system
    if (node.attribs['flex'] !== undefined) {
      element.style.display = 'flex';
    } else if (node.attribs['grid'] !== undefined) {
      element.style.display = 'grid';
      element.style.gap = '8px';
      element.style.padding = '16px';
      element.style.borderRadius = '12px';
      element.style.backgroundColor = '#f8f9fa';
      if (node.attribs['cols']) element.style.gridTemplateColumns = node.attribs['cols'];
      if (node.attribs['rows']) element.style.gridTemplateRows = node.attribs['rows'];
    }
  }

  // Flex properties
  if (node.attribs['dir']) {
    element.style.flexDirection = node.attribs['dir'] === '0' ? 'row' : 'column';
  }
  if (node.attribs['justify']) {
    const justifyValues = ['flex-start', 'flex-end', 'center', 'space-between', 'space-around'];
    element.style.justifyContent = justifyValues[parseInt(node.attribs['justify'])] || 'flex-start';
  }
  if (node.attribs['align-items']) {
    const alignValues = ['flex-start', '', 'flex-end', 'center', 'stretch'];
    element.style.alignItems = alignValues[parseInt(node.attribs['align-items'])] || 'flex-start';
  }

  // Content and styling
  if (node.attribs['t']) {
    element.textContent = node.attribs['t'];
  }
  if (node.attribs['bg']) {
    element.style.backgroundColor = node.attribs['bg'];
  }

  // Child styling optimization - use CSS injection for better performance
  let css = '';
  if (node.attribs['cw']) {
    css += `#n${node.id} > * { width: ${node.attribs['cw']} !important; } `;
  }
  if (node.attribs['ch']) {
    css += `#n${node.id} > * { height: ${node.attribs['ch']} !important; } `;
  }

  if (css) {
    // Batch CSS updates to reduce reflows
    let styleElement = document.getElementById('dynamic-styles');
    if (!styleElement) {
      styleElement = document.createElement('style');
      styleElement.id = 'dynamic-styles';
      document.head.appendChild(styleElement);
    }
    styleElement.textContent += css;
  }

  // Special handling for interactive elements
  if (node.componentType === 'button') {
    element.style.cursor = 'pointer';
    element.style.border = 'none';
    element.style.borderRadius = '8px';
    element.style.padding = '16px';
    element.style.fontSize = '18px';
    element.style.fontWeight = 'bold';
    element.style.backgroundColor = node.attribs['bg'] || '#f0f0f0';
    element.style.color = node.attribs['bg'] === '#333333' ? 'white' : (node.attribs['bg'] === '#ff9500' ? 'white' : 'black');
    element.style.transition = 'all 0.2s ease';
    element.style.userSelect = 'none';
    
    // Add hover effect
    element.addEventListener('mouseenter', () => {
      element.style.transform = 'scale(0.95)';
      element.style.opacity = '0.8';
    });
    
    element.addEventListener('mouseleave', () => {
      element.style.transform = 'scale(1)';
      element.style.opacity = '1';
    });
    
    // Add click handler for demonstration
    element.addEventListener('click', () => {
      console.log(`Button clicked: ${node.attribs['t']}`);
      element.style.transform = 'scale(0.9)';
      setTimeout(() => {
        element.style.transform = 'scale(1)';
      }, 100);
    });
  }
}

// Reusable function to setup parser event handlers
function setupParserEventHandlers(parser, currentElement, elementMap, out) {
  parser.addEventListener('componentAttribsReady', async (event) => {
    const node = event.detail;
    console.info(`Rendering node ${node.id} with priority ${node.priority}:`, node.attribs);

    if (currentElement) {
      currentElement.id = `n${node.id}`;
      elementMap.set(node.id, currentElement);
      
      // Apply styles using requestAnimationFrame for smooth rendering
      requestAnimationFrame(() => {
        applyNodeStyles(currentElement, node);
      });
    }
  });

  parser.addEventListener('componentPush', () => {
    const newElement = document.createElement('div');
    currentElement.appendChild(newElement);
    currentElement = newElement;
  });

  parser.addEventListener('componentPop', () => {
    currentElement = currentElement.parentElement;
  });

  return currentElement;
}

export async function sendCompletions() {
  const apiKey = document.querySelector('input#apiKey').value.trim();
  
  // Use demo mode if no API key is provided
  if (!apiKey) {
    console.log('No API key provided, using demo mode');
    return sendCompletionsDemo();
  }

  try {
    const response = await fetch('https://api.siliconflow.cn/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'Qwen/Qwen3-8B',
      messages: [
        {
          role: 'system',
          content: `
你是一个专业的UI生成器，需要根据用户输入生成优化的GUI组件结构。使用S表达式格式，按重要程度优先输出，确保流畅的流式渲染体验。

## 重要原则

1. **优先级输出**: 按重要程度排序输出组件，核心功能组件优先
2. **流式优化**: 每个S表达式完整输出，避免中间停顿
3. **并行友好**: 独立组件可并行渲染，避免深度嵌套依赖
4. **渐进增强**: 先输出基础功能，再补充装饰性元素

## S表达式格式

([componentType] [:priority [0-2]] [content] [:attrib1 [value1]] [:attrib2 [value2]] ...)

优先级说明：
- :priority 0 = 核心功能组件（按钮、输入框等交互元素）
- :priority 1 = 重要布局容器（主要结构容器）  
- :priority 2 = 装饰性元素（文本、样式等）

示例：
(1 :priority 0 :t "确认" :bg "#007AFF")  // 核心按钮优先
(b :priority 1 :flex :dir 0)            // 重要容器其次
(t :priority 2 :t "提示文本")            // 装饰文本最后

## 支持的组件类型

- 窗口: w (根容器，必须优先级1)
- 块元素: b (布局容器)
- 行内元素: i (内联容器)
- 文本: t (文本内容)
- 段落: p (段落文本)
- 按钮: 1 (交互按钮，通常优先级0)
- 输入框: 2 (交互输入，通常优先级0)

## 容器属性

容器元素（w, b）可设置：

| 属性 | S表达式 | 可选值 | 说明 |
|------|---------|--------|------|
| 宽度 | :w | 100px, 200px, 300px, auto | 容器宽度 |
| 高度 | :h | 100px, 200px, 300px, auto | 容器高度 |
| 背景色 | :bg | #RRGGBB, transparent | 背景颜色 |
| 子元素宽度 | :cw | 100px, 200px, 300px, auto | 统一子元素宽度 |
| 子元素高度 | :ch | 100px, 200px, 300px, auto | 统一子元素高度 |

## 布局系统

### Flex布局 (推荐用于一维布局)
- :flex - 启用flex布局
- :dir - 方向 (0=row, 1=column)
- :justify - 主轴对齐 (0=start, 1=end, 2=center, 3=between, 4=around)
- :align-items - 交叉轴对齐 (0=start, 2=end, 3=center, 4=stretch)

### Grid布局 (用于二维网格)
- :grid - 启用grid布局
- :cols - 列模板 (如 "repeat(3, 1fr)")
- :rows - 行模板 (如 "repeat(4, 1fr)")

## 输出策略

1. **分组输出**: 先输出所有优先级0组件，再输出优先级1，最后优先级2
2. **完整性**: 每个S表达式必须完整，不得分割输出
3. **简洁性**: 省略默认值属性，减少输出长度
4. **层次控制**: 嵌套深度不超过4层，减少依赖关系

## 输出格式要求

1. 只输出S表达式，无其他内容
2. 每个根容器必须是窗口(w)
3. 按优先级顺序输出：priority 0 → priority 1 → priority 2
4. 独立组件尽量避免深度嵌套，便于并行处理
          `
        },
        {
          role: 'user',
          content: '生成一个简单计算器键盘，不需要带输入框'
        }
      ],
      stream: true,
      enable_thinking: false,
      max_tokens: 4096,
      temperature: 0.1,
      top_p: 0.1,
      top_k: 100,
    })
  });

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  const out = document.querySelector('textarea#response');
  out.textContent = '';

  const appContainer = document.querySelector('#app');
  appContainer.innerHTML = ''; // Clear previous content
  let currentElement = appContainer;

  // Enhanced rendering system with performance optimization
  const elementMap = new Map(); // Cache elements by node ID for faster lookup
  const parser = new StreamingSymbolicExprParser();
  
  currentElement = setupParserEventHandlers(parser, currentElement, elementMap, out);

  let shouldBreak = false;
  let restChunk = '';
  
  // Enhanced chunk processing with better error handling
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    try {
      // Parse the SSE message
      const text = decoder.decode(value);
      const current = restChunk + text;
      const lines = current.split('\n');
      
      // Process complete lines
      for (let i = 0; i < lines.length - 1; i++) {
        const line = lines[i].trim();
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') {
            shouldBreak = true;
            break;
          } else if (data.length > 0) {
            try {
              const message = JSON.parse(data);
              const chunk = message.choices[0]?.delta?.content;
              if (chunk) {
                out.textContent += chunk;
                parser.append(chunk);
              }
            } catch (err) {
              console.warn('Skipped invalid JSON:', data);
            }
          }
        }
      }
      
      // Keep the last incomplete line
      restChunk = lines[lines.length - 1];
      
      if (shouldBreak) break;
    } catch (err) {
      console.error('Error processing stream:', err);
    }
  }
  } catch (error) {
    console.error('API request failed, falling back to demo mode:', error);
    return sendCompletionsDemo();
  }
}

