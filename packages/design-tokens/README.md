# AICP Design Tokens

共享设计令牌以 `DESIGN.md` 为规范来源，并分为三层：

- `primitive`：规范中命名的颜色、字体、圆角和间距原值，不直接决定具体组件用途。颜色原语包括品牌蓝、数据色与状态色。
- `semantic`：操作、文本、表面、边界、焦点与业务状态等可复用语义；应用样式优先消费这一层，不直接使用色值。
- `component`：按钮、输入框、卡片和导航等稳定组件尺寸。

TypeScript 消费方从 `@aicp/design-tokens/tokens` 导入令牌。Ant Design 根主题从
`@aicp/design-tokens/antd` 导入。普通样式引入 `@aicp/design-tokens/tokens.css` 后使用
`--aicp-*` 自定义属性。

应用可以在根部做必要的局部覆写，但不得复制共享令牌、重新定义状态含义或为每个 Ant Design 组件建立包装层。旧颜色 token 暂时保留为兼容别名，新代码使用按角色命名的 token。
