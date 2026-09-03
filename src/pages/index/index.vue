<script lang="ts" setup>
/**
 * 入口页(源自旧项目 pages/index/index.vue,新建复刻)
 * 职责:检查插件可用性 → 获取配置 → 二维码 scene 跳文章 → 审计模式 mock → 启动页/首页分流
 */
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { getQRCodeInfo } from '@/api/uni-halo'
import { useAppConfigStore } from '@/store/appConfig'
import { useSettingStore } from '@/store/setting'
import { collectSiteDefaults } from '@/utils/preference'
import { usePluginAvailable } from '@/utils/plugin'

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
const DEV_TO_PATH = `${articleDetailPath}?name=01a057b2-3200-74af-8afe-28a054092e82`

/* ---------------- 状态 ---------------- */
const appConfigStore = useAppConfigStore()
const settingStore = useSettingStore()
const uniHaloPluginId = 'plugin-uni-halo'
const uniHaloPluginAvailableError = '阿偶，检测到当前插件没有安装或者启用，无法启动 uni-halo 哦，请联系管理员'
const uniHaloPluginAvailable = ref(true)

/* ---------------- 逻辑 ---------------- */
/** 检查插件可用性 */
async function handleCheckPluginAvailable(): Promise<boolean> {
  uniHaloPluginAvailable.value = await usePluginAvailable(uniHaloPluginId)
  return uniHaloPluginAvailable.value
}

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

/** 获取审核模式数据(公开接口 /audit-data,enabled 联动设置页开关) */
async function handleAuditMode() {
  await appConfigStore.fetchAuditData()
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

  // 检查插件
  if (!(await handleCheckPluginAvailable()))
    return

  // 获取配置
  try {
    const res = await appConfigStore.fetchConfigs()
    if (!res) {
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

    // 审计模式数据(公开接口 /audit-data)
    await handleAuditMode()

    // 两层偏好合并:应用站点默认(L0)到 setting store(内部合并本地差异,含旧数据迁移)
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
  <view class="app-page h-screen w-screen flex items-center justify-center" style="background-color: #fff;">
    <uh-plugin-unavailable
      v-if="!uniHaloPluginAvailable"
      :plugin-id="uniHaloPluginId"
      :error-text="uniHaloPluginAvailableError"
      :use-border="false"
      :use-decoration="false"
    />
  </view>
</template>
