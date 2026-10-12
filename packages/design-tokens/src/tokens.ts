const colorPalette = {
  // 焦点蓝：只用于焦点环、halo 与不承载文字的强调（DESIGN.md focus-blue），
  // 不承担主行动角色；主行动蓝由 actionBlue 承担，两者必须分离。
  electricCobalt: "#3b82f6",
  // 主行动蓝：DESIGN.md primary-blue，承担主按钮、白字链接、品牌标记与当前导航
  actionBlue: "#2563eb",
  dataSky: "#5b8ff9",
  learningGreen: "#22a06b",
  signalYellow: "#f59e0b",
  signalCoral: "#ef4444",
  ink: "#1f2937",
  mutedInk: "#667085",
  canvas: "#f7f7f7",
  surface: "#ffffff",
  line: "#f2f2f2",
  success: "#067647",
  warning: "#b54708",
  risk: "#b42318",
} as const;

export const aicpPrimitiveTokens = {
  color: {
    ...colorPalette,
    // 兼容已发布的共享 token 名称；新代码应优先使用上方按角色命名的颜色。
    blueprintCobalt: colorPalette.electricCobalt,
    operationalBlue: colorPalette.actionBlue,
    dataAzure: colorPalette.dataSky,
    dataPeriwinkle: "#8b5cf6",
    dataSlate: "#64748b",
    operationalInk: colorPalette.ink,
    mutedBlueGray: colorPalette.mutedInk,
    workspaceGray: colorPalette.canvas,
    surfaceWhite: colorPalette.surface,
    subtleLine: colorPalette.line,
    stateSuccess: colorPalette.success,
    stateWarning: colorPalette.warning,
    stateRisk: colorPalette.risk,
  },
  typography: {
    bodyFamily: '"Noto Sans SC Variable", "PingFang SC", "Microsoft YaHei", sans-serif',
    dataFamily: '"Manrope Variable", "Avenir Next", "Segoe UI", sans-serif',
    utilityFamily: '"IBM Plex Mono", monospace',
    displaySize: 22,
    titleSize: 16,
    bodySize: 13,
    labelSize: 12,
    utilitySize: 10,
  },
  radius: {
    chip: 4,
    control: 5,
    surface: 6,
    shell: 8,
  },
  spacing: {
    xs: 4,
    sm: 8,
    control: 10,
    md: 12,
    lg: 16,
    xl: 20,
    panel: 24,
    section: 28,
  },
} as const;

const color = aicpPrimitiveTokens.color;

export const aicpSemanticTokens = {
  color: {
    // 品牌标记与主行动同色（DESIGN.md：行动蓝承担品牌标记与当前导航）
    brand: color.actionBlue,
    actionPrimary: color.actionBlue,
    actionPrimaryHover: "#1d4ed8",
    actionPrimaryActive: "#1d4ed8",
    textPrimary: color.ink,
    textSecondary: "#667085",
    textTertiary: "#667085",
    textOnAccent: color.surface,
    backgroundCanvas: color.canvas,
    backgroundSurface: color.surface,
    backgroundSubtle: "#fafafa",
    backgroundSelected: "#eff6ff",
    backgroundHover: "#f3f7ff",
    borderSubtle: color.line,
    // 交互控件边框：极浅中性灰（R=G=B 完全中性），白面上低存在感但保留控件边界
    borderInteractive: "#e8e8e8",
    // 交互控件 hover 时边框加深为中性灰（neutral-400，不随主题蓝演变，保持边框的中性角色）
    borderHover: "#a3a3a3",
    // 焦点蓝与主行动蓝分离：焦点环/halo 用 electricCobalt（#3b82f6），不承载文字
    focusRing: color.electricCobalt,
    focusHalo: "rgb(59 130 246 / 18%)",
    statusNeutral: "#5f6b7a",
    statusNeutralBackground: "#f2f4f7",
    // 信息与进行中均用主行动蓝文字 + 淡蓝底（DESIGN.md status-info），
    // 不再使用色板外的深蓝（原 #175cd3）
    statusInfo: color.actionBlue,
    statusInfoBackground: "#eff6ff",
    statusProgress: color.actionBlue,
    statusProgressBackground: "#eff6ff",
    statusSuccess: color.success,
    statusSuccessBackground: "#ecfdf3",
    statusWarning: color.warning,
    statusWarningBackground: "#fffaeb",
    statusRisk: color.risk,
    statusRiskBackground: "#fef3f2",
    // 数据图表色独立于操作语义色：数据主色沿用焦点蓝（不承载操作）
    dataPrimary: color.electricCobalt,
    dataSecondary: color.dataSky,
    dataPositive: color.learningGreen,
    dataAttention: color.signalYellow,
    dataRisk: color.signalCoral,
  },
  shadow: {
    surface: "0 1px 2px rgb(16 24 40 / 3%)",
    // 浮层阴影：克制但可见的漂浮感（Modal/Drawer、下拉菜单、账号菜单等覆盖层）
    elevated: "0 8px 20px rgb(16 24 40 / 8%), 0 2px 6px rgb(16 24 40 / 4%)",
    action: "0 2px 5px rgb(37 99 235 / 18%)",
  },
  surface: {
    operational: color.surface,
  },
  motion: {
    fast: "150ms",
    standard: "180ms",
    easing: "cubic-bezier(0.2, 0, 0, 1)",
  },
} as const;

export const aicpComponentTokens = {
  button: {
    height: 34,
    paddingInline: 14,
  },
  input: {
    height: 34,
    paddingInline: 12,
  },
  card: {
    padding: 18,
  },
  navigation: {
    width: 196,
    collapsedWidth: 64,
  },
} as const;

export const aicpDesignTokens = {
  primitive: aicpPrimitiveTokens,
  semantic: aicpSemanticTokens,
  component: aicpComponentTokens,
} as const;
