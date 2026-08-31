import { defineUniPages } from '@uni-helper/vite-plugin-uni-pages'
import { tabBar } from './src/tabbar/config'

export default defineUniPages({
  globalStyle: {
    navigationStyle: 'default',
    navigationBarTitleText: 'uni-halo',
    navigationBarBackgroundColor: '#ffffff',
    navigationBarTextStyle: 'black',
    backgroundColor: '#F8F8F8',
  },
  easycom: {
    autoscan: true,
    custom: {
      '^fg-(.*)': '@/components/fg-$1/fg-$1.vue',
      '^uh-(.*)': '@/components/uh-$1/uh-$1.vue',
      '^(?!z-paging-refresh|z-paging-load-more)z-paging(.*)':
        'z-paging/components/z-paging$1/z-paging$1.vue',
      '^wd-(.*)': '@wot-ui/ui/components/wd-$1/wd-$1.vue',
      '^mp-html(.*)': 'mp-html/dist/uni-app/components/mp-html/mp-html$1.vue',
    },
  },
  // tabbar 的配置统一在 “./src/tabbar/config.ts” 文件中
  // pages-blog 是博客页面，对应旧版项目的 pagesA 子包
  subPackages: [{
    root: 'pages-demo',
    pages: [],
  }, {
    root: 'pages-blog',
    pages: [],
  }],
  tabBar: tabBar as any,
})
