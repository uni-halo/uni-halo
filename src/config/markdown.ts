/**
 * mp-html 富文本 / markdown 渲染业务配置
 * 源自旧项目 common/markdown/markdown.config.js,TS 化复刻(业务封装新建,插件本体走 npm mp-html)
 * 用法:<mp-html :content="html" :tag-style="markdownConfig.tagStyle" :container-style="markdownConfig.containStyle" />
 */
import { checkImageUrl } from '@/utils/url'

const primaryColor = '#B9E424' 

export const markdownConfig = {
  /** 图片域名前缀(mp-html 相对路径补全,源自旧配置 domain: BASE_API) */
  domain: import.meta.env.VITE_SERVER_BASEURL || '',
  /** 标签样式定制(表格/引用/标题/代码等) */
  tagStyle: {
    table: `
      table-layout: fixed;
      border-collapse:collapse;
      margin-bottom: 18px;
      overflow: hidden;
      font-size: 13px;
      color: var(--routine);
      background: #f2f6fc;
      border: 1px solid #dcdcdc;
      border-radius: 4px;
    `,
    th: `
      padding: 8px;
      border-right: 1px solid var(--classE);
      border-bottom: 1px solid var(--classE);
    `,
    td: `
      padding: 8px;
      border-right: 1px solid var(--classE);
      border-bottom: 1px solid var(--classE);
    `,
    blockquote: `
      padding: 8px 15px;
      color: #606266;
	  background-color: rgb(255 255 255 / 55%);
      backdrop-filter: blur(24rpx) saturate(160%);
      -webkit-backdrop-filter: blur(24rpx) saturate(160%);
      border-left: 5px solid ${primaryColor};
      border-radius: 4px;
      line-height: 26px;
      margin-bottom: 18px;
	  box-shadow: 0 0px 12px rgba(0, 0, 0, 0.035);
    `,
    ul: 'padding-left: 15px;line-height: 1.85;',
    ol: 'padding-left: 15px;line-height: 1.85;',
    li: 'margin-bottom: 12px;line-height: 1.85;',
    h1: `
      margin: 30px 0 20px;
      color: ${primaryColor};
      line-height: 24px;
      position: relative;
      font-size:1.2em;
    `,
    h2: `
      color: ${primaryColor};
      line-height: 24px;
      position: relative;
      margin: 22px 0 16px;
      font-size: 1.16em;
    `,
    h3: `
      color: ${primaryColor};
      line-height: 24px;
      position: relative;
      margin: 26px 0 18px;
      font-size: 1.14em;
    `,
    h4: `
      color: ${primaryColor};
      line-height: 24px;
      margin-bottom: 18px;
      position: relative;
      font-size: 1.12em;
    `,
    h5: `
      color: ${primaryColor};
      line-height: 24px;
      margin-bottom: 14px;
      position: relative;
      font-size: 1.1em;
    `,
    h6: `
      color: ${primaryColor};
      line-height: 24px;
      margin-bottom: 14px;
      position: relative;
      font-size: 14px;
    `,
    p: `
      line-height: 1.65;
      margin-bottom: 14px;
      font-size: 14px;
    `,
    code: '  ',
    strong: 'font-weight: 700;color: rgb(248, 57, 41);',
    video: 'width: 100%',
  },
  /** 容器样式 */
  containStyle: 'font-family: Optima-Regular, Optima, PingFangSC-light, PingFangTC-light, "PingFang SC", Cambria, Cochin, Georgia, Times, "Times New Roman", serif;padding:0;font-size: 14px;color: #606266;word-spacing: 0.8px;letter-spacing: 0.8px;border-radius: 0px;background-color:transparent;',
  /** 加载图 / 空图(来自应用配置 imagesConfig) */
  loadingGif: checkImageUrl(undefined),
  emptyGif: checkImageUrl(undefined),
}
