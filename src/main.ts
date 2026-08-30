import { createSSRApp } from 'vue'
import App from './App.vue'
import { requestInterceptor } from './http/interceptor'
import { routeInterceptor } from './router/interceptor'

import store from './store'
import '@/style/index.scss'
import 'virtual:uno.css'
import i18n from './locale/index'

export function createApp() {
  const app = createSSRApp(App)
  app.use(store)
  app.use(routeInterceptor)
  app.use(requestInterceptor)
  app.use(i18n)

  return {
    app,
  }
}
