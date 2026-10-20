/**
 * 互动增强佩戴装饰槽位（buildWornSlots / nameStyleCssOf）单测
 */
import { describe, expect, it } from 'vitest'
import { buildWornSlots, nameStyleCssOf } from '@/utils/wornDecorations'
import type { IPublicIdentity } from '@/api/types/halo-plugin-third/interaction-plus'

function identityOf(overrides: Partial<IPublicIdentity> = {}): IPublicIdentity {
  return {
    userName: 'tester',
    displayName: '测试者',
    ...overrides,
  }
}

describe('buildWornSlots', () => {
  it('无身份时全部槽位 invisible', () => {
    for (const id of [null, undefined]) {
      const slots = buildWornSlots(id)
      expect(slots.avatarFrame.visible).toBe(false)
      expect(slots.primaryBadge.visible).toBe(false)
      expect(slots.title.visible).toBe(false)
      expect(slots.cardBackground.visible).toBe(false)
    }
  })

  it('佩戴齐全且策略开启时全部槽位可见且带有效数据', () => {
    const slots = buildWornSlots(identityOf({
      decorations: {
        avatarFrame: { type: 'avatar_frame', url: 'https://cdn.example.com/frame.png' },
        primaryBadge: { type: 'badge', url: 'https://cdn.example.com/badge.png' },
        title: {
          type: 'title',
          url: 'https://cdn.example.com/title.png',
          titleText: '氛围组',
          titleColor: '#ffffff',
          titleBackground: '#f83856',
        },
        cardBackground: { type: 'card_background', url: 'https://cdn.example.com/bg.png' },
      },
      display: {
        userCard: { showAvatarFrame: true, showPrimaryBadge: true, showTitle: true },
      },
    }))
    expect(slots.avatarFrame).toEqual({ visible: true, url: 'https://cdn.example.com/frame.png' })
    expect(slots.primaryBadge).toEqual({ visible: true, url: 'https://cdn.example.com/badge.png' })
    expect(slots.cardBackground).toEqual({ visible: true, url: 'https://cdn.example.com/bg.png' })
    expect(slots.title.visible).toBe(true)
    expect(slots.title.text).toBe('氛围组')
    expect(slots.title.style).toBe('background-image:#f83856;color:#ffffff')
  })

  it('display.userCard 未下发时头像框/主勋章/称号不展示(未配置视为关闭,对齐试点)', () => {
    const slots = buildWornSlots(identityOf({
      decorations: {
        avatarFrame: { type: 'avatar_frame', url: 'https://cdn.example.com/frame.png' },
        title: { type: 'title', titleText: '称号' },
      },
    }))
    expect(slots.avatarFrame.visible).toBe(false)
    expect(slots.primaryBadge.visible).toBe(false)
    expect(slots.title.visible).toBe(false)
    // 名片背景不受 userCard 策略裁剪
  })

  it('策略单项关闭时仅关闭对应槽位', () => {
    const slots = buildWornSlots(identityOf({
      decorations: {
        avatarFrame: { type: 'avatar_frame', url: 'https://cdn.example.com/frame.png' },
        primaryBadge: { type: 'badge', url: 'https://cdn.example.com/badge.png' },
        title: { type: 'title', titleText: '称号' },
      },
      display: { userCard: { showAvatarFrame: true, showPrimaryBadge: false, showTitle: true } },
    }))
    expect(slots.avatarFrame.visible).toBe(true)
    expect(slots.primaryBadge.visible).toBe(false)
    expect(slots.title.visible).toBe(true)
  })

  it('素材 URL 非法时槽位 invisible', () => {
    const slots = buildWornSlots(identityOf({
      decorations: {
        avatarFrame: { type: 'avatar_frame', url: 'notaurl' },
        primaryBadge: { type: 'badge', url: 'https://ok.example.com/b.png' },
      },
      display: { userCard: { showAvatarFrame: true, showPrimaryBadge: true } },
    }))
    expect(slots.avatarFrame.visible).toBe(false)
    expect(slots.primaryBadge.visible).toBe(true)
  })

  it('称号渐变第二色组合 135° 渐变', () => {
    const slots = buildWornSlots(identityOf({
      decorations: {
        title: {
          type: 'title',
          titleText: '称号',
          titleBackground: '#111111',
          titleBackgroundSecondary: '#222222',
        },
      },
      display: { userCard: { showTitle: true } },
    }))
    expect(slots.title.style).toBe('background-image:linear-gradient(135deg,#111111,#222222);')
  })

  it('称号无任何颜色时 style 为空串', () => {
    const slots = buildWornSlots(identityOf({
      decorations: { title: { type: 'title', titleText: '称号' } },
      display: { userCard: { showTitle: true } },
    }))
    expect(slots.title.visible).toBe(true)
    expect(slots.title.style).toBe('')
  })
})

describe('nameStyleCssOf', () => {
  it('无样式返回空串', () => {
    expect(nameStyleCssOf(null)).toBe('')
    expect(nameStyleCssOf(identityOf())).toBe('')
  })

  it('渐变模式组合 linear-gradient + 文字挖空', () => {
    expect(nameStyleCssOf(identityOf({
      decorations: { nameStyle: { type: 'name_style', nameStyle: { mode: 'gradient', colors: ['#f00', '#00f'] } } },
    }))).toBe(
      'background-image:linear-gradient(135deg,#f00,#00f);-webkit-background-clip:text;background-clip:text;color:transparent',
    )
  })

  it('纯色模式返回 color', () => {
    expect(nameStyleCssOf(identityOf({
      decorations: { nameStyle: { type: 'name_style', nameStyle: { mode: 'solid', color: '#333333' } } },
    }))).toBe('color:#333333')
  })
})
