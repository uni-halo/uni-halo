/**
 * 应用设置默认值与类型(源自旧项目 utils/app.js 的 _DefaultAppSettings)
 */

export interface IAppSettings {
  /** 是否每次启动都显示启动页 */
  showStartPage: boolean
  /** 评论头像是否圆形 */
  isAvatarRadius: boolean
  banner: {
    useDot: boolean
    dotPosition: string
  }
  /** 布局配置 */
  layout: {
    /** h_row_col1 = 一行一列 / h_row_col2 = 一行两列 */
    home: string
    /** lr_image_text=左图右文 / lr_text_image=左文右图 / tb_image_text=上图下文 / tb_text_image=上文下图 / only_text=仅文字 */
    cardType: string
  }
  /** 广告配置 */
  ad: {
    /** 屏蔽广告时长,时间到后自动恢复展示(单位小时) */
    timeout: number
    /** 是否屏蔽广告 */
    disabled: boolean
  }
  /** 评论弹幕(文章详情) */
  barrage: {
    use: boolean
    /** 弹幕位置(rightToLeft / leftBottom) */
    type: string
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
  showStartPage: false,
  isAvatarRadius: false,
  banner: {
    useDot: true,
    dotPosition: 'right',
  },
  layout: {
    home: 'h_row_col1',
    cardType: 'lr_image_text',
  },
  ad: {
    timeout: 3,
    disabled: false,
  },
  barrage: {
    use: false,
    type: 'leftBottom',
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
