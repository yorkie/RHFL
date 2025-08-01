/**
 * S-Expression Tokenizer and Parser
 * Supports quoted strings with proper quote handling
 */

// Token types
const TOKEN_TYPES = {
  LPAREN: 'LPAREN',     // (
  RPAREN: 'RPAREN',     // )
  SYMBOL: 'SYMBOL',     // identifiers, keywords
  STRING: 'STRING',     // quoted strings
  ATTRIBUTE: 'ATTRIBUTE', // :attribute
  EOF: 'EOF'
};

/**
 * Tokenizer for S-expressions
 */
class SExprTokenizer {
  constructor(input) {
    this.input = input;
    this.pos = 0;
    this.tokens = [];
  }

  peek(offset = 0) {
    const pos = this.pos + offset;
    return pos < this.input.length ? this.input[pos] : null;
  }

  advance() {
    if (this.pos < this.input.length) {
      return this.input[this.pos++];
    }
    return null;
  }

  skipWhitespace() {
    while (this.pos < this.input.length && /\s/.test(this.input[this.pos])) {
      this.pos++;
    }
  }

  readString(quoteChar) {
    let value = '';
    this.advance(); // Skip opening quote
    
    while (this.pos < this.input.length) {
      const char = this.peek();
      if (char === quoteChar) {
        this.advance(); // Skip closing quote
        break;
      } else if (char === '\\') {
        this.advance(); // Skip escape char
        const escaped = this.advance();
        if (escaped) {
          // Handle common escape sequences
          switch (escaped) {
            case 'n': value += '\n'; break;
            case 't': value += '\t'; break;
            case 'r': value += '\r'; break;
            case '\\': value += '\\'; break;
            case '"': value += '"'; break;
            case "'": value += "'"; break;
            default: value += escaped; break;
          }
        }
      } else {
        value += this.advance();
      }
    }
    
    return { type: TOKEN_TYPES.STRING, value };
  }

  readSymbol() {
    let value = '';
    
    while (this.pos < this.input.length) {
      const char = this.peek();
      if (/[\s():]/.test(char)) {
        break;
      }
      value += this.advance();
    }
    
    return { type: TOKEN_TYPES.SYMBOL, value };
  }

  readAttribute() {
    let value = '';
    this.advance(); // Skip the ':'
    
    while (this.pos < this.input.length) {
      const char = this.peek();
      if (/[\s()]/.test(char)) {
        break;
      }
      value += this.advance();
    }
    
    return { type: TOKEN_TYPES.ATTRIBUTE, value };
  }

  tokenize() {
    this.tokens = [];
    
    while (this.pos < this.input.length) {
      this.skipWhitespace();
      
      if (this.pos >= this.input.length) break;
      
      const char = this.peek();
      
      if (char === '(') {
        this.advance();
        this.tokens.push({ type: TOKEN_TYPES.LPAREN, value: '(' });
      } else if (char === ')') {
        this.advance();
        this.tokens.push({ type: TOKEN_TYPES.RPAREN, value: ')' });
      } else if (char === '"' || char === "'") {
        this.tokens.push(this.readString(char));
      } else if (char === ':') {
        this.tokens.push(this.readAttribute());
      } else {
        this.tokens.push(this.readSymbol());
      }
    }
    
    this.tokens.push({ type: TOKEN_TYPES.EOF, value: null });
    return this.tokens;
  }
}

/**
 * S-Expression Parser Node
 */
class SExprNode {
  constructor(type = null, value = null) {
    this.type = type;        // node type (symbol, string, list)
    this.value = value;      // node value
    this.attributes = {};    // parsed attributes
    this.children = [];      // child nodes
    this.parent = null;      // parent node
  }

  addChild(child) {
    child.parent = this;
    this.children.push(child);
    return child;
  }

  // Parse attributes from the node's children
  parseAttributes() {
    const attributes = {};
    let i = 1; // Start from 1 to skip the first element (component type)

    while (i < this.children.length) {
      const child = this.children[i];
      
      if (child.type === 'attribute') {
        const attrName = child.value;
        
        // Check if there's a value following the attribute
        if (i + 1 < this.children.length) {
          const nextChild = this.children[i + 1];
          
          // If the next child is not an attribute and not a list, use it as the value
          if (nextChild.type !== 'attribute' && nextChild.type !== 'list') {
            attributes[attrName] = nextChild.value;
            i += 2; // Skip both attribute and its value
          } else {
            // Attribute without value (like :flex)
            attributes[attrName] = true;
            i += 1;
          }
        } else {
          // Attribute at the end without value
          attributes[attrName] = true;
          i += 1;
        }
      } else {
        // If it's not an attribute, move to the next
        i += 1;
      }
    }

    this.attributes = attributes;
    return attributes;
  }

  // Get non-attribute children (other lists)
  getChildNodes() {
    return this.children.filter(child => child.type === 'list');
  }

  // Get the component type (first symbol in the list)
  getComponentType() {
    if (this.type === 'list' && this.children.length > 0) {
      const first = this.children[0];
      if (first.type === 'symbol') {
        return first.value;
      }
    }
    return null;
  }
}

/**
 * S-Expression Parser
 */
class SExprParser {
  constructor(tokens) {
    this.tokens = tokens;
    this.pos = 0;
  }

  peek(offset = 0) {
    const pos = this.pos + offset;
    return pos < this.tokens.length ? this.tokens[pos] : { type: TOKEN_TYPES.EOF, value: null };
  }

  advance() {
    if (this.pos < this.tokens.length) {
      return this.tokens[this.pos++];
    }
    return { type: TOKEN_TYPES.EOF, value: null };
  }

  parseList() {
    const listNode = new SExprNode('list');
    
    // Expect opening parenthesis
    const openParen = this.advance();
    if (openParen.type !== TOKEN_TYPES.LPAREN) {
      throw new Error(`Expected '(', got ${openParen.type}`);
    }

    // Parse contents until closing parenthesis
    while (this.peek().type !== TOKEN_TYPES.RPAREN && this.peek().type !== TOKEN_TYPES.EOF) {
      const child = this.parseExpression();
      if (child) {
        listNode.addChild(child);
      }
    }

    // Expect closing parenthesis
    const closeParen = this.advance();
    if (closeParen.type !== TOKEN_TYPES.RPAREN) {
      throw new Error(`Expected ')', got ${closeParen.type}`);
    }

    // Parse attributes for this list
    listNode.parseAttributes();

    return listNode;
  }

  parseExpression() {
    const token = this.peek();

    switch (token.type) {
      case TOKEN_TYPES.LPAREN:
        return this.parseList();
        
      case TOKEN_TYPES.SYMBOL:
        this.advance();
        return new SExprNode('symbol', token.value);
        
      case TOKEN_TYPES.STRING:
        this.advance();
        return new SExprNode('string', token.value);
        
      case TOKEN_TYPES.ATTRIBUTE:
        this.advance();
        return new SExprNode('attribute', token.value);
        
      case TOKEN_TYPES.EOF:
        return null;
        
      default:
        throw new Error(`Unexpected token: ${token.type}`);
    }
  }

  parse() {
    const expressions = [];
    
    while (this.peek().type !== TOKEN_TYPES.EOF) {
      const expr = this.parseExpression();
      if (expr) {
        expressions.push(expr);
      }
    }
    
    return expressions.length === 1 ? expressions[0] : expressions;
  }
}

/**
 * Streaming S-Expression Parser
 * Handles incomplete S-expressions during streaming
 */
export class StreamingSExprParser extends EventTarget {
  constructor() {
    super();
    this.buffer = '';
    this.nodeStack = [];
    this.currentNode = null;
    this.nodeId = 0;
  }

  append(chunk) {
    this.buffer += chunk;
    
    try {
      // Try to parse complete expressions from the buffer
      this.parseBuffer();
    } catch (error) {
      // Ignore parsing errors during streaming - wait for more data
      console.debug('Streaming parse error (expected):', error.message);
    }
  }

  parseBuffer() {
    let lastValidPos = 0;
    let parenCount = 0;
    let inQuotes = false;
    let quoteChar = '';
    
    // Find complete expressions in the buffer
    for (let i = 0; i < this.buffer.length; i++) {
      const char = this.buffer[i];
      
      if ((char === '"' || char === "'") && !inQuotes) {
        inQuotes = true;
        quoteChar = char;
      } else if (char === quoteChar && inQuotes) {
        inQuotes = false;
        quoteChar = '';
      } else if (!inQuotes) {
        if (char === '(') {
          parenCount++;
        } else if (char === ')') {
          parenCount--;
          
          // If we have a complete expression
          if (parenCount === 0) {
            const expr = this.buffer.substring(lastValidPos, i + 1).trim();
            if (expr) {
              this.parseCompleteExpression(expr);
            }
            lastValidPos = i + 1;
          }
        }
      }
    }
    
    // Remove processed part from buffer
    if (lastValidPos > 0) {
      this.buffer = this.buffer.substring(lastValidPos);
    }
  }

  parseCompleteExpression(expr) {
    try {
      const tokenizer = new SExprTokenizer(expr);
      const tokens = tokenizer.tokenize();
      const parser = new SExprParser(tokens);
      const ast = parser.parse();
      
      // Create a streaming node representation
      const streamingNode = this.createStreamingNode(ast);
      this.dispatchEvent(new CustomEvent('nodeComplete', { detail: streamingNode }));
    } catch (error) {
      console.warn('Failed to parse expression:', expr, error);
    }
  }

  createStreamingNode(ast) {
    return {
      id: this.nodeId++,
      componentType: ast.getComponentType(),
      attributes: ast.attributes,
      children: ast.getChildNodes().map(child => this.createStreamingNode(child)),
      rawNode: ast
    };
  }

  // Get current parsing state for debugging
  getState() {
    return {
      buffer: this.buffer,
      bufferLength: this.buffer.length,
      nodeStackDepth: this.nodeStack.length
    };
  }
}

/**
 * Utility function to parse a complete S-expression string
 */
export function parseSExpression(input) {
  const tokenizer = new SExprTokenizer(input);
  const tokens = tokenizer.tokenize();
  const parser = new SExprParser(tokens);
  return parser.parse();
}

// Export classes for advanced usage
export { SExprTokenizer, SExprParser, SExprNode, TOKEN_TYPES };