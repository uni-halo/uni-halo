/**
 * 应用设置默认值与类型(源自旧项目 utils/app.js 的 _DefaultAppSettings)
 */

/** 单页布局偏好(列表布局 + 卡片样式,与后端 preferences 分区对齐) */
export interface IPageLayoutPref {
  /** 列表布局:single=单列 / double=双列 */
  listLayout: string
  /** 卡片样式(组件 layout 值):image_top=上图下文 / image_right=左文右图 / image_bottom=上文下图(社交卡片) / image_left=左图右文 */
  cardType: string
}

export interface IAppSettings {
  /** 评论头像是否圆形 */
  isAvatarRadius: boolean
  banner: {
    useDot: boolean
    dotPosition: string
  }
  /** 布局配置(按页面分组,每组可独立自定义) */
  layout: {
    /** 首页 */
    home: IPageLayoutPref
    /** 文章列表页 */
    articles: IPageLayoutPref
    /** 文章归档页 */
    archives: IPageLayoutPref
  }
  /** 广告配置 */
  ad: {
    /** 屏蔽广告时长,时间到后自动恢复展示(单位小时) */
    timeout: number
    /** 是否屏蔽广告 */
    disabled: boolean
  }
  gallery: {
    /** 是否使用瀑布流 */
    useWaterfull: boolean
  }
  links: {
    useSimple: boolean
    useGroup: boolean
  }
  about: {
    /** 显示后台登录入口 */
    showAdmin: boolean
    /** 显示所有的统计信息(关于页面) */
    showAllCount: boolean
  }
  /** 文章配置 */
  article: Record<string, unknown>
  /** 联系博主页面 */
  contact: {
    /** 链接是否使用复制的方式,否则直接在内部打开 */
    isLinkCopy: boolean
  }
}

export const DefaultAppSettings: IAppSettings = {
  isAvatarRadius: false,
  banner: {
    useDot: true,
    dotPosition: 'right',
  },
  layout: {
    home: { listLayout: 'single', cardType: 'image_top' },
    articles: { listLayout: 'double', cardType: 'image_top' },
    archives: { listLayout: 'single', cardType: 'image_top' },
  },
  ad: {
    timeout: 3,
    disabled: false,
  },
  gallery: {
    useWaterfull: true,
  },
  links: {
    useSimple: false,
    useGroup: false,
  },
  about: {
    showAdmin: false,
    showAllCount: false,
  },
  article: {},
  contact: {
    isLinkCopy: true,
  },
}
