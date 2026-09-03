<script lang="ts" setup>
/**
 * 入口页(源自旧项目 pages/index/index.vue,新建复刻)
 * 职责:检查插件可用性 + 维护模式 → 重定向维护页 → 获取配置 → 二维码 scene 跳文章 →
 * 审计模式 mock → 启动页/首页分流
 * 拦截规则(2026-09-04):主插件未激活或维护模式开启(任一命中)均跳转维护页,
 * 不再展示 uh-plugin-unavailable 组件;维护页按 from 参数区分原因展示默认/配置文案。
 */
import { onLoad } from '@dcloudio/uni-app'
import { getQRCodeInfo } from '@/api/uni-halo'
import { useAppConfigStore } from '@/store/appConfig'
import { useSettingStore } from '@/store/setting'
import { collectSiteDefaults } from '@/utils/preference'

definePage({
  // 使用 type: "home" 属性设置首页，其他页面不需要设置，默认为page
  type: 'home',
  style: {
    // 'custom' 表示开启自定义导航栏，默认 'default'
    navigationStyle: 'custom',
    navigationBarTitleText: '初始页面',
  },
})

/* ---------------- 常量 ---------------- */
const homePagePath = '/pages/tabbar/home/home'
const articleDetailPath = '/pages-blog/article-detail/article-detail'

// 本地开发快速跳转页面,发布请置为 false
const DEV_MODE = false
const DEV_TO_TYPE = 'page' as 'page' | 'tabbar'
const DEV_TO_PATH = `/pages-blog/test/test`

/* ---------------- 状态 ---------------- */
const appConfigStore = useAppConfigStore()
const settingStore = useSettingStore()
/** 维护拦截(插件可用性 + 维护模式检查与跳转封装,见 hooks/use-maintenance-intercept) */
const { interceptOrContinue } = useMaintenanceIntercept()

/** 通过二维码 scene 获取文章 id */
async function getPostIdByQRCode(key: string): Promise<string | null> {
  try {
    const response = await getQRCodeInfo(key)
    if (response.data?.postId)
      return response.data.postId as string
  }
  catch (err) {
    console.error('二维码解析失败', err)
  }
  return null
}

onLoad(async (options) => {
  // 本地开发,快速跳转页面,发布请设置 DEV_MODE = false
  if (DEV_MODE && DEV_TO_PATH) {
    if (DEV_TO_TYPE === 'tabbar') {
      uni.switchTab({ url: DEV_TO_PATH })
    }
    else {
      uni.navigateTo({ url: DEV_TO_PATH })
    }
    return
  }

  // 拦截:主插件未激活 或 维护模式开启(任一命中)→ 跳转维护页
  if (await interceptOrContinue())
    return

  // 获取配置(统一 bootstrap: getConfigs + audit-data + love-config 并行一次;
  // TTL 内直接返回缓存。设计见 .docs/static-config-unified-fetch-design.md)
  try {
    const { ok } = await appConfigStore.bootstrap()
    if (!ok) {
      uni.switchTab({ url: homePagePath })
      return
    }

    // 二维码 scene 进入:解析 postId 跳文章详情
    if (options.scene && options.scene !== '') {
      const postId = await getPostIdByQRCode(decodeURIComponent(options.scene))
      if (postId) {
        uni.redirectTo({
          url: `${articleDetailPath}?name=${postId}`,
          animationType: 'slide-in-right',
        })
        return
      }
    }

    // 两层偏好合并:应用站点默认(L0)到 setting store(内部合并本地差异,含旧数据迁移);
    // 审核模式数据已随 bootstrap 拉取(auditData/auditModeEnabled 即可用)
    settingStore.applySiteDefaults(collectSiteDefaults(appConfigStore.configs))

    // 启动页已下线(v2.2 ⑤):直接进首页
    uni.switchTab({ url: homePagePath })
  }
  catch (err) {
    console.error('入口页初始化失败', err)
    uni.switchTab({ url: homePagePath })
  }
})
</script>

<template>
  <view class="app-page h-screen w-screen flex items-center justify-center" style="background-color: #fff;" />
</template>
