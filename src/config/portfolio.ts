/**
 * 项目集插件枚举中文映射（与插件端默认选项对齐，Console 可配置时以配置为准的兜底方案）
 */

/** 平台映射 */
export const PORTFOLIO_PLATFORM_LABELS: Record<string, string> = {
  github: 'GitHub',
  gitee: 'Gitee',
  website: '独立站点',
  private: '私有项目',
  other: '其他',
}

/** 类型映射 */
export const PORTFOLIO_TYPE_LABELS: Record<string, string> = {
  open_source: '开源项目',
  product: '产品',
  plugin: '插件',
  website: '网站',
  tool: '工具',
  library: '类库',
  other: '其他',
}

/** 状态映射 */
export const PORTFOLIO_STATUS_LABELS: Record<string, string> = {
  draft: '草稿',
  published: '已发布',
  archived: '已归档',
}

/** 取映射标签，无匹配回退原值 */
export function portfolioLabelOf(map: Record<string, string>, value?: string): string {
  if (!value) { return '' }
  return map[value] || value
}
