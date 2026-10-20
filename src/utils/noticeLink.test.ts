import { describe, expect, it } from 'vitest'
import { resolveNoticeLink } from './noticeLink'

const base = { entry: {}, platform: 'mp-weixin' as const }

describe('resolveNoticeLink', () => {
  it('none 不展示入口', () => {
    expect(resolveNoticeLink({ ...base, entry: { linkType: 'none' } })).toEqual({ visible: false, text: '' })
    expect(resolveNoticeLink({ ...base, entry: { linkType: 'none', link: 'https://x.com' } })).toEqual({ visible: false, text: '' })
  })

  it('linkType 缺省按 link 非空回退 external(历史兼容)', () => {
    expect(resolveNoticeLink({ ...base, entry: { link: 'https://x.com' } })).toEqual({
      visible: true, behavior: 'copy', text: '复制链接地址',
    })
    expect(resolveNoticeLink({ ...base, entry: {} }).visible).toBe(false)
  })

  it('internal 内部页面', () => {
    expect(resolveNoticeLink({ ...base, entry: { linkType: 'internal', link: '/pages-blog/notice/notice' } })).toEqual({
      visible: true, behavior: 'internal', text: '查看相关页面',
    })
    expect(resolveNoticeLink({ ...base, entry: { linkType: 'internal' } }).visible).toBe(false)
  })

  it('miniapp 仅微信小程序端展示并要求 appId', () => {
    const entry = { linkType: 'miniapp', linkAppId: 'wx123' }
    expect(resolveNoticeLink({ ...base, entry })).toEqual({ visible: true, behavior: 'miniapp', text: '打开小程序' })
    expect(resolveNoticeLink({ ...base, entry: { linkType: 'miniapp' } }).visible).toBe(false)
    expect(resolveNoticeLink({ ...base, entry, platform: 'app' }).visible).toBe(false)
    expect(resolveNoticeLink({ ...base, entry, platform: 'h5' }).visible).toBe(false)
  })

  it('wechat-mp:App 企业资质 webview 打开公众号文章', () => {
    expect(resolveNoticeLink({ ...base, entry: { linkType: 'wechat-mp', link: 'https://mp.weixin.qq.com/s/1' }, platform: 'app', qualification: 'enterprise' })).toEqual({
      visible: true, behavior: 'webview', text: '打开公众号文章',
    })
  })

  it('wechat-mp:App 个人资质/未配置复制公众号链接', () => {
    const entry = { linkType: 'wechat-mp', link: 'https://mp.weixin.qq.com/s/1' }
    expect(resolveNoticeLink({ ...base, entry, platform: 'app', qualification: 'personal' })).toEqual({
      visible: true, behavior: 'copy', text: '复制公众号链接',
    })
    expect(resolveNoticeLink({ ...base, entry, platform: 'app' })).toEqual({
      visible: true, behavior: 'copy', text: '复制公众号链接',
    })
  })

  it('wechat-mp:H5 直接打开公众号文章;微信小程序端保守复制', () => {
    const entry = { linkType: 'wechat-mp', link: 'https://mp.weixin.qq.com/s/1' }
    expect(resolveNoticeLink({ ...base, entry, platform: 'h5' })).toEqual({
      visible: true, behavior: 'h5-open', text: '打开公众号文章',
    })
    expect(resolveNoticeLink({ ...base, entry, platform: 'mp-weixin', qualification: 'enterprise' })).toEqual({
      visible: true, behavior: 'copy', text: '复制公众号链接',
    })
  })

  it('external:App 端按资质区分,企业 webview 打开网页', () => {
    const entry = { linkType: 'external', link: 'https://x.com' }
    expect(resolveNoticeLink({ ...base, entry, platform: 'app', qualification: 'enterprise' })).toEqual({
      visible: true, behavior: 'webview', text: '打开网页',
    })
    expect(resolveNoticeLink({ ...base, entry, platform: 'app', qualification: 'personal' })).toEqual({
      visible: true, behavior: 'copy', text: '复制链接地址',
    })
    expect(resolveNoticeLink({ ...base, entry, platform: 'app' })).toEqual({
      visible: true, behavior: 'copy', text: '复制链接地址',
    })
  })

  it('external:H5 window.open,微信小程序端复制', () => {
    const entry = { linkType: 'external', link: 'https://x.com' }
    expect(resolveNoticeLink({ ...base, entry, platform: 'h5' })).toEqual({
      visible: true, behavior: 'h5-open', text: '打开链接',
    })
    expect(resolveNoticeLink({ ...base, entry, platform: 'mp-weixin' })).toEqual({
      visible: true, behavior: 'copy', text: '复制链接地址',
    })
  })

  it('external/wechat-mp 缺 link 不展示入口', () => {
    expect(resolveNoticeLink({ ...base, entry: { linkType: 'external' }, platform: 'h5' }).visible).toBe(false)
    expect(resolveNoticeLink({ ...base, entry: { linkType: 'wechat-mp' }, platform: 'h5' }).visible).toBe(false)
  })
})
