# RHFL: Render HTML for LLMs

**RHFL** (Render HTML for LLMs) is an innovative project that bridges the gap between Large Language Models and visual user interfaces. Instead of generating plain text responses, RHFL enables LLMs to create structured, interactive GUI components in real-time using a custom S-expression format that gets rendered as HTML/CSS.

## 🚀 What Makes RHFL Special

- **Real-time GUI Generation**: LLMs can generate interactive user interfaces on-the-fly
- **Streaming Rendering**: Components are parsed and rendered as they stream from the LLM
- **Symbolic Expression Format**: Uses a concise S-expression syntax for describing UI components
- **Layout Systems**: Full support for Flexbox and CSS Grid layouts
- **Live Demo**: Includes a working calculator keyboard example

## 🏗️ How It Works

1. **User Input**: You provide a prompt describing the desired UI
2. **LLM Processing**: The system sends your request to an LLM (currently using Qwen3-8B via SiliconFlow)
3. **S-expression Generation**: The LLM responds with structured S-expressions describing UI components
4. **Real-time Parsing**: A streaming parser processes the S-expressions as they arrive
5. **HTML Rendering**: Components are instantly rendered as interactive HTML elements

## 📝 S-Expression Format

RHFL uses a symbolic expression format to describe UI components:

```
([componentType] [attributes...])
```

### Component Types

| Code | Type | Description |
|------|------|-------------|
| `w` | Window | Root container element |
| `b` | Block | Block-level container |
| `i` | Inline | Inline container |
| `t` | Text | Text element |
| `p` | Paragraph | Paragraph element |
| `1` | Button | Interactive button |
| `2` | Input | Input field |

### Layout Attributes

#### Container Properties
- `:w` - Width (100px, 200px, 300px, auto)
- `:h` - Height (100px, 200px, 300px, auto)
- `:bg` - Background color (#RRGGBB, transparent)
- `:cw` - Children width
- `:ch` - Children height

#### Flex Layout
- `:flex` - Enable flexbox layout
- `:dir` - Direction (0=row, 1=column)
- `:justify` - Justify content (0=flex-start, 1=flex-end, 2=center, 3=space-between, 4=space-around)
- `:align-items` - Align items (0=flex-start, 2=flex-end, 3=center, 4=stretch)

#### Grid Layout
- `:grid` - Enable grid layout
- `:cols` - Grid template columns
- `:rows` - Grid template rows

### Example S-Expressions

```lisp
; Simple button
(1 :t "Click Me" :bg "#FF0000")

; Flex container with multiple buttons
(b :flex :dir 0
  (1 :t "Button 1")
  (1 :t "Button 2")
  (1 :t "Button 3"))

; Calculator-style grid
(w :grid :cols "repeat(3, 1fr)"
  (1 :t "7") (1 :t "8") (1 :t "9")
  (1 :t "4") (1 :t "5") (1 :t "6")
  (1 :t "1") (1 :t "2") (1 :t "3"))
```

## 🛠️ Setup and Installation

### Prerequisites
- Modern web browser with ES6 module support
- SiliconFlow API key (for LLM integration)

### Quick Start

1. **Clone the repository**:
   ```bash
   git clone https://github.com/yorkie/RHFL.git
   cd RHFL
   ```

2. **Start a local server**:
   ```bash
   # Using Python
   python3 -m http.server 8000
   
   # Or using Node.js
   npx serve .
   
   # Or any other static file server
   ```

3. **Open in browser**:
   Navigate to `http://localhost:8000`

4. **Get API Key**:
   - Visit [SiliconFlow](https://api.siliconflow.cn/)
   - Create an account and obtain an API key

5. **Try it out**:
   - Enter your API key in the input field
   - Click "Start" to see a calculator keyboard generated in real-time

## 🎮 Usage Examples

### Basic Usage

1. Open `index.html` in your browser
2. Enter your SiliconFlow API key
3. Click "Start" to generate the default calculator example
4. Watch as the LLM generates S-expressions that render into interactive components

### Custom Prompts

To generate different UIs, modify the prompt in `lib/rhfl.js` around line 184:

```javascript
{
  role: 'user',
  content: '生成一个简单计算器键盘，不需要带输入框' // Change this prompt
}
```

Example prompts:
- `"Generate a login form with username and password fields"`
- `"Create a navigation menu with 5 buttons"`
- `"Build a photo gallery grid layout"`

## 🔧 API Configuration

### SiliconFlow API Settings

The default configuration in `lib/rhfl.js`:

```javascript
{
  model: 'Qwen/Qwen3-8B',
  stream: true,
  enable_thinking: false,
  max_tokens: 4096,
  temperature: 0.1,
  top_p: 0.1,
  top_k: 100,
}
```

### Customizing the System Prompt

The system prompt defines how the LLM should generate S-expressions. You can modify it to:
- Change component behavior
- Add new component types
- Modify layout rules
- Adjust styling options

## 🏛️ Architecture

### Core Components

1. **StreamingSymbolicExprParser**: Parses S-expressions in real-time as they stream from the LLM
2. **Component Renderer**: Converts parsed S-expressions into HTML/CSS
3. **Event System**: Handles component lifecycle events (push, pop, attributes ready)
4. **Style Manager**: Applies CSS styles based on S-expression attributes

### Data Flow

```
User Prompt → LLM API → Streaming Response → S-Expression Parser → HTML Renderer → DOM
```

## 🔬 Development

### Project Structure

```
RHFL/
├── index.html          # Main demo page
├── lib/
│   └── rhfl.js        # Core parser and renderer
├── package.json       # Project metadata
└── README.md         # This file
```

### Adding New Component Types

1. Add the component code to `idToComponentType` object
2. Update the system prompt to include the new component
3. Add rendering logic in the `componentAttribsReady` event handler

### Testing

Currently, testing is done manually through the demo interface. Future improvements could include:
- Unit tests for the S-expression parser
- Integration tests for the rendering system
- Visual regression tests for component output

## 🤝 Contributing

Contributions are welcome! Areas for improvement:

- **New Component Types**: Add support for more HTML elements
- **Enhanced Layouts**: Implement additional CSS layout systems
- **Performance**: Optimize parsing and rendering performance
- **Testing**: Add comprehensive test suite
- **Documentation**: Improve code documentation and examples
- **LLM Integration**: Support for additional LLM providers

## 🐛 Troubleshooting

### Common Issues

**"Failed to parse chunk" errors**:
- Usually caused by malformed S-expressions from the LLM
- Check the console for specific parsing errors
- Verify your API key is valid

**Components not rendering**:
- Ensure the S-expression format is correct
- Check that component types are recognized
- Verify CSS styles are being applied

**API errors**:
- Verify your SiliconFlow API key is correct
- Check network connectivity
- Ensure you have sufficient API credits

## 📄 License

MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- [SiliconFlow](https://api.siliconflow.cn/) for providing the LLM API
- The Qwen team for the Qwen3-8B model
- The open-source community for inspiration and feedback

---

**Note**: This project is experimental and demonstrates the potential for LLM-driven UI generation. It's designed for research and demonstration purposes.
