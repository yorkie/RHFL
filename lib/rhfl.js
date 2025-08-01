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
          if (this.#currentNode) {
            this.#currentNode.parseAttribs();
            this.dispatchEvent(new CustomEvent('componentAttribsReady', { detail: this.#currentNode }));
            this.#currentNode.dispatchedAttribs = true;
          }
          this.#currentNode = this.#currentNode.addChild();
          this.dispatchEvent(new CustomEvent('componentPush'));
        } else if (char === ')') {
          // End the current node
          if (!this.#currentNode.dispatchedAttribs) {
            this.#currentNode.parseAttribs();
            this.dispatchEvent(new CustomEvent('componentAttribsReady', { detail: this.#currentNode }));
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
| width            | :w                   | 100px, 200px, 300px, auto(default) | 窗口宽度 |
| height           | :h                   | 100px, 200px, 300px, auto(default) | 窗口高度 |
| background-color | :bg                  | #RRGGBB, transparent(default) | 窗口背景颜色 |
| children width   | :cw                  | 100px, 200px, 300px, auto(default) | 子元素宽度 |
| children height  | :ch                  | 100px, 200px, 300px, auto(default) | 子元素高度 |

如果上述属性是默认值，比如 \`:w auto\`，则可以省略不写。

以上属性都只能在容器元素上使用，非容器元素不支持设置这些属性（千万记住）。

1. ":w", ":h" 和 ":bg-color" 用于设置容器元素本身的宽、高和背景颜色。
2. ":cw" 和 ":ch" 用于设置当前容器元素的*子元素*的宽度和高度。

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
  let currentElement = appContainer;

  const parser = new StreamingSymbolicExprParser();
  parser.addEventListener('componentAttribsReady', (event) => {
    const node = event.detail;
    console.info(node.attribs);

    if (currentElement) {
      currentElement.id = `n${node.id}`;
      currentElement.style.display = 'block';

      if (node.componentType === 'window' || node.componentType === 'block') {
        currentElement.style.width = node.attribs['w'] || 'auto';
        currentElement.style.height = node.attribs['h'] || 'auto';
        currentElement.style.backgroundColor = node.attribs['bg-color'] || 'transparent';

        if (node.attribs['flex']) {
          currentElement.style.display = 'flex';
        } else if (node.attribs['grid']) {
          currentElement.style.display = 'grid';
        }
      }

      if (node.attribs['dir']) {
        currentElement.style.flexDirection = node.attribs['dir'] === '0' ? 'row' : 'column';
      }
      if (node.attribs['justify']) {
        currentElement.style.justifyContent = {
          '0': 'flex-start',
          '1': 'flex-end',
          '2': 'center',
          '3': 'space-between',
          '4': 'space-around'
        }[node.attribs['justify']];
      }
      if (node.attribs['align-items']) {
        currentElement.style.alignItems = {
          '0': 'flex-start',
          '2': 'flex-end',
          '3': 'center',
          '4': 'stretch'
        }[node.attribs['align-items']];
      }

      if (node.attribs['t']) {
        currentElement.textContent = node.attribs['t'];
      }

      let css = '';
      if (node.attribs['cw']) {
        css += `#n${node.id} > * { width: ${node.attribs['cw']} !important; } `;
      }
      if (node.attribs['ch']) {
        css += `#n${node.id} > * { height: ${node.attribs['ch']} !important; } `;
      }

      if (css) {
        const style = document.createElement('style');
        style.textContent = css;
        currentElement.appendChild(style);
      }
    }
  });
  parser.addEventListener('componentPush', () => {
    const newElement = document.createElement('div');
    currentElement.appendChild(newElement);
    currentElement = newElement;
  });
  parser.addEventListener('componentPop', (event) => {
    currentElement = currentElement.parentElement;
  });

  let shouldBreak;
  let restChunk = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    // Parse the SSE message
    const text = decoder.decode(value)
    const current = restChunk + text
    const parts = current.split('\n\n')
      .map(part => part.trim())
      .filter(part => part.length > 0 && part.startsWith('data: '))
      .map(part => part.slice(6));

    if (parts.length > 0) {
      for (const data of parts) {
        if (data === '[DONE]') {
          shouldBreak = true;
          break;
        } else {
          try {
            const message = JSON.parse(data);
            const chunk = message.choices[0].delta.content;
            out.textContent += chunk;
            parser.append(chunk);
          } catch (err) {
            console.error('Skipped, Failed to parse message: ', data);
          }
        }
      }
    }

    if (shouldBreak) {
      break;
    }
  }
}

