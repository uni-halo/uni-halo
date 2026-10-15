<script lang="ts" setup>
import { computed, ref } from 'vue'
import { onPageScroll, onPullDownRefresh } from '@dcloudio/uni-app'
import { getFaqs } from '@/api/uni-halo'
import { usePageScroll } from '@/hooks/usePageScroll'
import { useNavbarSticky } from '@/hooks/useNavbarSticky'
import { debounce } from '@/utils/debounce'
import type { IFaqItem } from '@/api/types/uni-halo'

definePage({
  style: {
    navigationBarTitleText: '常见问题',
    enablePullDownRefresh: true,
    navigationStyle: 'custom',
  },
})

const { scrollY, updatePageScrollValue } = usePageScroll()
/** 吸顶偏移 = 自定义导航栏高度（与 votes/notice 等列表页同用法） */
const { height: offsetTop } = useNavbarSticky()
const pageTitle = '常见问题'

/* ---------------- 状态 ---------------- */
/** 全量数据（插件端接口一次取全量：size=0；接口异常时回退 mock） */
const allList = ref<IFaqItem[]>([])
const keyword = ref('')
const accordionName = ref<string>('')
const loading = ref(true)
/** 详情弹窗 */
const detail = ref<{ show: boolean, item: IFaqItem | null }>({ show: false, item: null })

/* ---------------- Mock 数据（插件端 FAQ 模块上线前的本地兜底） ---------------- */
const mockFaqList: IFaqItem[] = [
  {
    name: 'mock-faq-1',
    title: '如何绑定微信账号？',
    description: '进入「我的资料」页面，点击微信绑定按钮，扫码即可完成绑定，全程约 1 分钟。',
    category: '账号相关',
    content: `<p>打开 App，点击底部「我的」→「我的资料」，找到<strong>微信绑定</strong>卡片，点击后按提示扫码即可完成绑定。</p><p>绑定成功后头像将同步更新，也可以使用微信快捷登录。</p>`,
    links: [
      { title: '前往绑定页面', type: 'internal', url: '/pages-admin/my-profile/my-profile' },
      { title: '联系在线客服', type: 'contact' },
    ],
    visible: true,
    priority: 10,
  },
  {
    name: 'mock-faq-2',
    title: '为什么无法验证邮箱？',
    description: '如果遇到无法验证邮箱的情况，可以尝试重新发送验证邮件，或联系客服处理。',
    category: '账号相关',
    content: `<p>请先检查邮箱地址是否输入正确，并留意垃圾邮件文件夹。</p><p>若仍未收到验证邮件，可尝试重新发送；持续失败时请联系客服，或者尝试登录网页端进行操作。</p>`,
    links: [
      { title: '联系在线客服', type: 'contact' },
      { title: '访问站点', type: 'external', url: 'https://uni-halo.cn' },
    ],
    visible: true,
    priority: 20,
  },
  {
    name: 'mock-faq-3',
    title: '忘记密码怎么办？',
    description: '支持通过邮箱验证码重置密码，也可以联系客服协助找回。',
    category: '账号相关',
    content: `<p>在登录页点击「忘记密码」，输入注册邮箱接收验证码即可重置密码。</p><p>若邮箱已失效无法接收验证码，请联系客服协助找回。</p>`,
    links: [{ title: '联系在线客服', type: 'contact' }],
    visible: true,
    priority: 30,
  },
  {
    name: 'mock-faq-4',
    title: '友链申请需要满足什么条件？',
    description: '站点需正常访问且内容合规，申请通过后将在友链页展示。',
    category: '友链相关',
    content: `<p>申请友链需要满足以下条件：</p><ul><li>站点可正常访问，无违规内容</li><li>已添加本站友链</li><li>站点信息（名称、地址、头像、简介）完整</li></ul><p>提交申请后博主会尽快审核，审核结果将在友链页展示。</p>`,
    links: [
      { title: '前往友链页', type: 'internal', url: '/pages-blog/friend-links/friend-links' },
      { title: '联系在线客服', type: 'contact' },
    ],
    visible: true,
    priority: 10,
  },
  {
    name: 'mock-faq-5',
    title: '恋爱相册支持上传视频吗？',
    description: '目前恋爱相册仅支持图片上传，视频上传功能在规划中。',
    category: '功能使用',
    content: `<p>恋爱相册目前仅支持上传<strong>图片</strong>，单张图片不超过 10MB。</p><p>视频上传功能已在规划中，敬请期待。</p>`,
    links: [{ title: '前往恋爱相册', type: 'internal', url: '/pages-blog/love/album' }],
    visible: true,
    priority: 10,
  },
  {
    name: 'mock-faq-6',
    title: '如何参与投票？',
    description: '在投票中心选择感兴趣的投票，点击选项即可完成投票。',
    category: '功能使用',
    content: `<p>进入「投票中心」页，选择感兴趣的投票，点击选项即可完成投票。</p><p>部分投票支持多选或 PK 模式，投票后可以查看实时统计结果。</p>`,
    links: [{ title: '前往投票中心', type: 'internal', url: '/pages-blog/votes/votes' }],
    visible: true,
    priority: 20,
  },
]

/* ---------------- 数据加载 ---------------- */
/** 拉取全量（page=1, size=0 返回全部）；插件端接口异常时回退本地 mock */
async function handleGetData() {
  loading.value = allList.value.length === 0
  try {
    const res = await getFaqs({ page: 1, size: 0 })
    allList.value = res.data?.items || []
  }
  catch (err) {
    console.warn('[faq] 插件端接口不可用，回退 mock 数据', err)
    allList.value = mockFaqList
  }
  finally {
    loading.value = false
    uni.stopPullDownRefresh()
  }
}

/* ---------------- 搜索 ---------------- */
const handleOnInput = debounce(() => {
  accordionName.value = ''
}, 300)

function handleOnClear() {
  keyword.value = ''
}

/* ---------------- 列表分组（搜索过滤 → 按分类分组，排序由服务端完成） ---------------- */
const filteredList = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  if (!kw) {
    return allList.value
  }
  return allList.value.filter(item =>
    (item.title || '').toLowerCase().includes(kw)
    || (item.description || '').toLowerCase().includes(kw)
    || (item.category || '').toLowerCase().includes(kw))
})

const groupedFaq = computed(() => {
  const groups = new Map<string, IFaqItem[]>()
  for (const item of filteredList.value) {
    const category = item.category || '其他'
    if (!groups.has(category)) {
      groups.set(category, [])
    }
    groups.get(category)!.push(item)
  }
  return [...groups.entries()].map(([category, items]) => ({ category, items }))
})

/* ---------------- 交互 ---------------- */
function handleOpenDetail(item: IFaqItem) {
  detail.value = { show: true, item }
}

/** 相关链接点击：内部页面跳转 / 外部链接复制 / 客服按钮由 open-type 原生处理 */
function handleLinkClick(link: NonNullable<IFaqItem['links']>[number]) {
  if (link.type === 'contact') {
    return
  }
  if (!link.url) {
    return
  }
  if (link.type === 'internal') {
    detail.value.show = false
    uni.navigateTo({ url: link.url })
    return
  }
  // 外部链接：复制到剪贴板并提示
  uni.setClipboardData({
    data: link.url,
    success: () => {
      uni.showToast({ icon: 'none', title: '链接已复制，请在浏览器打开' })
    },
  })
}

/* ---------------- 生命周期 ---------------- */
onPageScroll((option: Page.PageScrollOption) => {
  updatePageScrollValue(option.scrollTop)
})

onPullDownRefresh(() => {
  handleGetData()
})

handleGetData()
</script>

<template>
  <view class="app-page min-h-screen w-screen flex flex-col bg-page">
    <uh-navbar :scroll-y="scrollY" :default-title="pageTitle" title-color="text-gray-900" />

    <!-- 吸顶搜索框（参考投票列表搜索框） -->
    <wd-sticky :offset-top="offsetTop">
      <view class="box-border w-screen px-3 pb-1 pt-2">
        <view class="uh-global-card-glass h-9 flex items-center gap-3 rounded-full px-5 shadow-none">
          <wd-icon name="search" size="16px" />
          <input
            v-model="keyword" class="flex-1 text-[26rpx] text-gray-900"
            placeholder="搜索问题..." placeholder-class="text-gray-400" confirm-type="search"
            @input="handleOnInput"
          >
          <view v-if="keyword" class="flex items-center" @click="handleOnClear">
            <wd-icon name="close" size="14px" />
          </view>
        </view>
      </view>
    </wd-sticky>

    <!-- 加载/空状态 -->
    <uh-data-loading
      v-if="loading || groupedFaq.length === 0"
      :loading-status="loading ? 'loading' : 'success'" empty-text="没有找到相关问题哦~"
      min-height="70vh"
    />

    <!-- 分类分组列表 -->
    <view v-else class="box-border flex flex-col p-3 pt-2">
      <view v-for="group in groupedFaq" :key="group.category" class="mb-2 flex flex-col">
        <view class="mb-2 box-border px-1">
          <uh-section-title>{{ group.category }}</uh-section-title>
        </view>
        <view class="uh-global-card-glass uh-shadow-xs overflow-hidden rounded-2xl">
          <wd-collapse v-model="accordionName" :accordion="true">
            <wd-collapse-item
              v-for="item in group.items" :key="item.name || item.title"
              :border="false" custom-body-class="px-3 py-1 !text-xs"
              :title="item.title" :name="item.name || item.title || ''"
            >
              <view class="w-full items-center leading-5.5">
                <text>{{ item.description || '查看详细内容' }}</text>
                <button
                  class="uh-button-native uh-global-card-glass mx-1 box-border rounded-lg bg-primary px-2 py-0.5 text-xs text-gray-900 shadow-none !inline-flex !border"
                  @click="handleOpenDetail(item)"
                >
                  查看详情
                </button>
              </view>
            </wd-collapse-item>
          </wd-collapse>
        </view>
      </view>
    </view>

    <!-- 详情弹窗 -->
    <uh-glass-popup
      v-model="detail.show" :z-index="999" position="bottom" custom-class="!rounded-2xl !border"
    >
      <view v-if="detail.item" class="box-border w-full flex flex-col gap-y-3 p-3">
        <!-- 顶部（参考友链详情弹窗：标题 + 右上角关闭按钮） -->
        <view class="relative box-border w-full flex items-center">
          <text class="text-md font-bold">{{ detail.item.title }}</text>
          <view
            class="uh-global-card-glass absolute right-0 top-0 h-6 w-6 flex items-center justify-center border rounded-lg text-gray-500 shadow-none !bg-white/5"
            @click="detail.show = false"
          >
            <wd-icon name="close" size="28rpx" />
          </view>
        </view>
        <!-- 内容滚动区 -->
        <scroll-view
          :scroll-y="true" :show-scrollbar="false" class="box-border max-h-[50vh] w-full"
        >
          <view class="w-full flex flex-col gap-y-3">
            <view class="text-xs text-gray-600 leading-5">
              {{ detail.item.description }}
            </view>
            <view class="uh-global-card-glass rounded-xl p-3 text-xs text-gray-700 leading-6 shadow-none">
              {{ detail.item.content }}
            </view>
          </view>
        </scroll-view>
        <!-- 相关链接按钮区 -->
        <view v-if="detail.item.links?.length" class="flex flex-col gap-2">
          <template v-for="link in detail.item.links" :key="link.title">
            <!-- 客服按钮：仅微信小程序端渲染 -->
            <!-- #ifdef MP-WEIXIN -->
            <button
              v-if="link.type === 'contact'"
              class="uh-button-native uh-global-card-glass box-border w-full flex items-center justify-center gap-1 rounded-full border px-4 py-2 text-xs text-gray-900 shadow-none"
              open-type="contact"
            >
              <wd-icon name="chat" size="14px" />
              {{ link.title || '联系在线客服' }}
            </button>
            <!-- #endif -->
            <uh-button
              v-if="link.type !== 'contact'"
              custom-class="uh-global-card-glass !rounded-full !py-2 !text-xs shadow-none"
              @action-click="handleLinkClick(link)"
            >
              {{ link.title }}
            </uh-button>
          </template>
        </view>
      </view>
    </uh-glass-popup>
  </view>
</template>
