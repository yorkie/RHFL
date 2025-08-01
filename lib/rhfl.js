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
    
    // Parse attributes with proper handling of quoted strings
    const attributeString = input.slice(1).trim();
    this.attribs = {};
    
    // Split by : but preserve quoted strings
    const parts = [];
    let current = '';
    let inQuotes = false;
    let quoteChar = '';
    
    for (let i = 0; i < attributeString.length; i++) {
      const char = attributeString[i];
      
      if ((char === '"' || char === "'") && !inQuotes) {
        inQuotes = true;
        quoteChar = char;
        current += char;
      } else if (char === quoteChar && inQuotes) {
        inQuotes = false;
        quoteChar = '';
        current += char;
      } else if (char === ':' && !inQuotes) {
        if (current.trim()) parts.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    if (current.trim()) parts.push(current.trim());
    
    // Process each attribute part
    for (const part of parts) {
      if (!part) continue;
      
      // Split by whitespace but preserve quoted values
      const tokens = [];
      let currentToken = '';
      let inQuotes = false;
      let quoteChar = '';
      
      for (let i = 0; i < part.length; i++) {
        const char = part[i];
        
        if ((char === '"' || char === "'") && !inQuotes) {
          inQuotes = true;
          quoteChar = char;
          currentToken += char;
        } else if (char === quoteChar && inQuotes) {
          inQuotes = false;
          quoteChar = '';
          currentToken += char;
        } else if (/\s/.test(char) && !inQuotes) {
          if (currentToken) {
            tokens.push(currentToken);
            currentToken = '';
          }
        } else {
          currentToken += char;
        }
      }
      if (currentToken) tokens.push(currentToken);
      
      if (tokens.length >= 2) {
        // Key-value pair
        const key = tokens[0];
        const value = tokens.slice(1).join(' ').replace(/^["']|["']$/g, ''); // Remove outer quotes
        this.attribs[key] = value;
      } else if (tokens.length === 1) {
        // Key only (like :flex)
        this.attribs[tokens[0]] = true;
      }
    }
  }
}

class StreamingSymbolicExprParser extends EventTarget {
  #root = new SymbolicExprNode(null);
  #currentNode = this.#root;

  append(chunk) {
    try {
      const len = chunk.length;
      for (let i = 0; i < len; i++) {
        const char = chunk[i];
        if (char === '(') {
          // Start a new node
          this.#currentNode = this.#currentNode.addChild();
          this.dispatchEvent(new CustomEvent('componentPush', { detail: this.#currentNode }));
        } else if (char === ')') {
          // End the current node - parse attributes and notify
          if (!this.#currentNode.dispatchedAttribs && this.#currentNode !== this.#root) {
            this.#currentNode.parseAttribs();
            this.dispatchEvent(new CustomEvent('componentAttribsReady', { detail: this.#currentNode }));
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
}

export async function sendCompletions() {
  const apiKey = document.querySelector('input#apiKey').value.trim();
  
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
请根据用户的输入生成 GUI 的基本组件结构，使用S表达式来表示结构以及布局样式，组件类型使用数字表示，除了内容和结构无需其他属性。

每个组件的S表达式输出格式如下：

([componentType] [content] [:attrib1 [value1]] [:attrib2 [value2]] ...)

属性优先输出 :flex 或 :grid。

比如：

(b :flex :dir 0)
(i :t "Hello" :bg "#FF0000")

## 支持的组件类型

- 窗口: w
- 块元素: b
- 行内元素: i
- 文本: t
- 段落: p
- 按钮: 1
- 输入框: 2

每次输出的根结点必须是窗口，且有且只有一个。

## 容器

容器代表一个 GUI 容器，它包括窗口和块元素，只有容器元素才能设置宽高，需要包含以下子属性：

| name             | name in S-expression | available values | description |
| ---------------- | -------------------- | ---------------- | ----------- |
| width            | :w                   | 100, 200, 300, auto(default) | 窗口宽度，数值默认单位为px |
| height           | :h                   | 100, 200, 300, auto(default) | 窗口高度，数值默认单位为px |
| background-color | :bg                  | #RRGGBB, transparent(default) | 窗口背景颜色 |
| children width   | :cw                  | 100, 200, 300, auto(default) | 子元素宽度，数值默认单位为px |
| children height  | :ch                  | 100, 200, 300, auto(default) | 子元素高度，数值默认单位为px |

如果上述属性是默认值，比如 \`:w auto\`，则可以省略不写。

**注意**：对于尺寸属性（:w, :h, :cw, :ch），纯数字值（如 100, 200）会自动添加 px 单位，因此 100 等同于 100px。其他单位需要明确指定（如 50%, auto, 2rem）。

以上属性都只能在容器元素上使用，非容器元素不支持设置这些属性（千万记住）。

1. ":w", ":h" 和 ":bg-color" 用于设置容器元素本身的宽、高和背景颜色。
2. ":cw" 和 ":ch" 用于设置当前容器元素的*子元素*的宽度和高度。

## 重要：减少冗余的输出原则

为了减少整体输出数据量并提高流式输出速度，请遵循以下原则：

1. **优先使用父容器的 :cw 和 :ch 属性**：如果多个子元素具有相同的宽度或高度，应在父容器中使用 :cw 和 :ch 来统一设置，而不是在每个子元素中重复 :w 和 :h。

2. **保持子节点精简**：子节点应尽量只包含必要的属性，如 :t（文本内容）。

### 推荐的输出格式示例：

**✅ 推荐格式 - 计算器布局**：
(w :grid :cols "repeat(4, 1fr)" :cw 60 :ch 60
  (1 :t "7")
  (1 :t "8")
  (1 :t "9")
  (1 :t "÷")
  (1 :t "4")
  (1 :t "5")
  (1 :t "6")
  (1 :t "×")
  (1 :t "1")
  (1 :t "2")
  (1 :t "3")
  (1 :t "-")
  (1 :t "0")
  (1 :t ".")
  (1 :t "=")
  (1 :t "+")
)

**✅ 推荐格式 - 导航菜单**：
(b :flex :dir 0 :cw 120 :ch 40 :bg "#f0f0f0"
  (1 :t "首页")
  (1 :t "产品")
  (1 :t "服务")
  (1 :t "关于")
)

**✅ 推荐格式 - 卡片网格**：
(w :grid :cols "repeat(3, 1fr)" :cw 200 :ch 150
  (b :flex :dir 1 :bg "#fff"
    (p :t "标题1")
    (p :t "内容描述")
  )
  (b :flex :dir 1 :bg "#fff"
    (p :t "标题2") 
    (p :t "内容描述")
  )
  (b :flex :dir 1 :bg "#fff"
    (p :t "标题3")
    (p :t "内容描述")
  )
)

### ❌ 避免的冗余格式：

**❌ 冗余格式 - 重复属性**：
(b :flex :dir 0
  (i :t "1" :w 100 :h 100)
  (i :t "2" :w 100 :h 100)
  (i :t "3" :w 100 :h 100)
  (i :t "-" :w 100 :h 100)
)

**❌ 冗余格式 - 重复背景色**：
(w :grid :cols "repeat(4, 1fr)"
  (1 :t "7" :w 60 :h 60 :bg "#e0e0e0")
  (1 :t "8" :w 60 :h 60 :bg "#e0e0e0")
  (1 :t "9" :w 60 :h 60 :bg "#e0e0e0")
  (1 :t "÷" :w 60 :h 60 :bg "#e0e0e0")
)

**❌ 冗余格式 - 过度嵌套**：
(w
  (b :flex
    (b :flex
      (b :flex
        (i :t "过度嵌套")
      )
    )
  )
)

## 支持的布局类型

- Flex
- Grid

每个容器组件（窗口和块元素）都必须声明它的布局类型以及对应的子属性，只有默认值的子属性可以省略不写。

比如：(b :flex) 或 (b :grid) 都是合法的。

### Flex 布局子属性

| name            | name in S-expression | available values | description |
| --------------- | -------------- | -------------------- | ----------------- |
| flex-direction  | :dir           | row(0), column(1) | 主轴方向 |
| justify-content | :justify       | flex-start(0), flex-end(1), center(2), space-between(3), space-around(4) | 主轴对齐方式 |
| align-items     | :align-items   | flex-start(0), flex-end(2), center(3), stretch(4) | 交叉轴对齐方式 |
| align-content   | :align-content | flex-start(0), flex-end(2), center(3), stretch(4), space-between(5), space-around(6) | 多行对齐方式 |

注意：在S表达式中使用括号中的数字表示对应的值，比如 \`:dir 0\` 表示 \`:dir row\`。

### Grid 布局子属性

参考 CSS Grid 布局系统，支持的属性如下：

| name                  | name in S-expression | available values | description |
| --------------------- | -------------------- | -------------------- | ----------------- |
| grid-template-columns | :cols | repeat(auto-fill, minmax(100px, 1fr)), repeat(auto-fit, minmax(100px, 1fr)) | 列模板 |
| grid-template-rows    | :rows | repeat(auto-fill, minmax(100px, 1fr)), repeat(auto-fit, minmax(100px, 1fr)) | 行模板 |

如果是 Grid 布局，那么必须声明 \`:cols\` 或 \`:rows\` 属性。

注意：在S表达式中使用括号中的数字表示对应的值。

## 输出要求

1. 输出的 GUI 结构树最深不超过4层。
2. 只输出S表达式，不要添加其他内容。
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
  appContainer.innerHTML = ''; // Clear any existing content
  let currentElement = appContainer;
  
  // Map to track DOM elements by node ID for proper tree structure
  const nodeToElementMap = new Map();

  const parser = new StreamingSymbolicExprParser();
  
  parser.addEventListener('componentPush', (event) => {
    const node = event.detail;
    const newElement = document.createElement('div');
    newElement.id = `n${node.id}`;
    
    // Store the mapping for later attribute application
    nodeToElementMap.set(node.id, newElement);
    
    // Append to current element and update current
    currentElement.appendChild(newElement);
    currentElement = newElement;
  });
  
  parser.addEventListener('componentAttribsReady', (event) => {
    const node = event.detail;
    const element = nodeToElementMap.get(node.id);
    
    console.info('Applying attributes to node', node.id, ':', node.attribs);

    if (element) {
      element.style.display = 'block';

      // Container styles
      if (node.componentType === 'window' || node.componentType === 'block') {
        if (node.attribs['w']) {
          const width = node.attribs['w'];
          element.style.width = /^\d+$/.test(width) ? width + 'px' : width;
        }
        if (node.attribs['h']) {
          const height = node.attribs['h'];
          element.style.height = /^\d+$/.test(height) ? height + 'px' : height;
        }
        if (node.attribs['bg']) element.style.backgroundColor = node.attribs['bg'];

        // Layout system
        if (node.attribs['flex'] !== undefined) {
          element.style.display = 'flex';
        } else if (node.attribs['grid'] !== undefined) {
          element.style.display = 'grid';
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

      // Grid properties
      if (node.attribs['cols']) {
        element.style.gridTemplateColumns = node.attribs['cols'];
      }
      if (node.attribs['rows']) {
        element.style.gridTemplateRows = node.attribs['rows'];
      }

      // Content and styling
      if (node.attribs['t']) {
        element.textContent = node.attribs['t'];
      }
      if (node.attribs['bg']) {
        element.style.backgroundColor = node.attribs['bg'];
      }

      // Children styling
      let css = '';
      if (node.attribs['cw']) {
        const childWidth = node.attribs['cw'];
        const width = /^\d+$/.test(childWidth) ? childWidth + 'px' : childWidth;
        css += `#n${node.id} > * { width: ${width} !important; } `;
      }
      if (node.attribs['ch']) {
        const childHeight = node.attribs['ch'];
        const height = /^\d+$/.test(childHeight) ? childHeight + 'px' : childHeight;
        css += `#n${node.id} > * { height: ${height} !important; } `;
      }

      if (css) {
        const style = document.createElement('style');
        style.textContent = css;
        document.head.appendChild(style);
      }
    }
  });
  
  parser.addEventListener('componentPop', () => {
    currentElement = currentElement.parentElement;
  });

  let shouldBreak = false;
  let restChunk = '';
  
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
    console.error('API request failed:', error);
    throw error;
  }
}

