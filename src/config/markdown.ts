import { checkImageUrl } from '@/utils/url'

const primaryColor = '#B9E424' 

export const markdownConfig = {
  domain: import.meta.env.VITE_SERVER_BASEURL || '',
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
    `,
    td: `
      padding: 8px;
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
      margin: 20px 0 14px;
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
    `,
    code: '  ',
    strong: 'font-weight: 700;color: rgb(248, 57, 41);',
	img: 'border-radius: 10px',
    video: 'width: 100%',
  },
  containStyle: 'padding:0;background-color:transparent;',
  loadingGif: checkImageUrl(undefined),
  emptyGif: checkImageUrl(undefined),
}
