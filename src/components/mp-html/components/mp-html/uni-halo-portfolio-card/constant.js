/**
 * @fileoverview 项目集枚举中文映射（与 uni-halo App 端 src/config/portfolio.ts 对齐）
 */

/** 项目类型映射 */
const TYPE_LABELS = {
  open_source: '开源项目',
  product: '产品',
  plugin: '插件',
  website: '网站',
  tool: '工具',
  library: '类库',
  other: '其他'
}

/** 项目平台映射 */
const PLATFORM_LABELS = {
  github: 'GitHub',
  gitee: 'Gitee',
  website: '独立站点',
  private: '私有项目',
  other: '其他'
}

export default {
  TYPE_LABELS,
  PLATFORM_LABELS
}
