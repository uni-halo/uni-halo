# kex-color-picker

跨端颜色选择器（uni-app **Vue3** / `<script setup>`）。  
支持色域 / 色相 / 透明度、HEX·RGB·HSL·HSV 可编辑、预设色、最近使用、复制、原色对比。

支持：**H5 / App（vue 页）/ 微信小程序 / 支付宝小程序 / 其它小程序 / 鸿蒙**。

> 颜色换算内置于插件 `color-utils.js`，**无需**业务侧 `libs`。  
> 弹层依赖 css 渐变与 `position: fixed`，**请在 vue 页面使用**（不支持 nvue）。

---

## 目录

1. [功能一览](#功能一览)
2. [安装](#安装)
3. [三种用法怎么选](#三种用法怎么选)
4. [快速上手](#快速上手)
5. [完整示例](#完整示例)
6. [输出格式 format](#输出格式-format)
7. [Props](#props)
8. [Events](#events)
9. [方法 ref](#方法-ref)
10. [插槽](#插槽)
11. [v-model 说明](#v-model-说明)
12. [多端说明](#多端说明)
13. [常见问题](#常见问题)
14. [注意事项](#注意事项)
15. [版本](#版本)

---

## 功能一览

| 能力 | 说明 |
| --- | --- |
| 色域选择 | 饱和度 × 明度二维面板 + 色相滑条 |
| 透明度 | `showAlpha` 控制；棋盘格预览透明色 |
| 多格式输出 | `format`：`hex` / `rgb` / `rgba` / `hsl` / `hsv` |
| 手动输入 | 面板内可切换 HEX / RGB / HSL / HSV 并编辑 |
| 原色 / 新色 | 打开时锁定原色，确认前可对比 |
| 预设色 | 内置一组常用色，可用 `presets` 覆盖 |
| 最近使用 | 确认后写入本地 Storage，下次打开可点选 |
| 复制 | 面板内「复制」；内置提示（不依赖 `uni.showToast`，避免被弹层挡住） |
| 清空 | `clearable` 清空 `v-model` |
| 触发器 | 默认色块；可改尺寸、插槽自定义、或隐藏后 `ref.open()` |
| 实时回写 | `realtime`：拖动过程中同步 `v-model`（默认关闭，点确定才写入） |
| 锁滚动 | 打开弹层时锁定页面滚动，关闭后恢复 |

---

## 安装

将插件拷贝到业务项目：

```text
你的项目/uni_modules/kex-color-picker/
```

uni-app **easycom** 会自动注册，页面里直接写标签，**无需** `import` 组件。

要求：

- uni-app **Vue3**（`manifest.json` → `vueVersion: "3"`）
- App 请使用 **vue 页面**（不要用 nvue）

演示页（本示例工程）：首页 → `kex-color-picker`，或路径 `/pages/demos/color-picker/index`。

---

## 三种用法怎么选

| 场景 | 写法 | 默认色块触发器 |
| --- | --- | --- |
| 表单里直接选色 | 默认用法 + `v-model` | ✅ |
| 按钮 / 文案自己画 | `#trigger` 插槽 | 换成你的 UI |
| 外部按钮命令式打开 | `:show-trigger="false"` + `ref.open()` | ❌ |

三种方式的 `format`、`presets`、`realtime` 等 Props 都生效。

---

## 快速上手

### 1. 最少代码（推荐先从这个开始）

点击色块 → 选色 → 点「确定」→ `color` 更新。

```vue
<template>
  <view>
    <kex-color-picker v-model="color" @change="onChange" />
    <text>当前颜色：{{ color }}</text>
    <view :style="{ width: '120rpx', height: '120rpx', backgroundColor: color }" />
  </view>
</template>

<script setup>
import { ref } from 'vue'

const color = ref('#0D9488')

const onChange = (val) => {
  console.log('选中颜色', val)
}
</script>
```

### 2. 输出 RGBA（带透明度）

```vue
<template>
  <kex-color-picker
    v-model="color"
    format="rgba"
    :show-alpha="true"
  />
</template>

<script setup>
import { ref } from 'vue'
const color = ref('rgba(13, 148, 136, 0.8)')
</script>
```

### 3. 不要透明度（纯色 HEX）

```vue
<kex-color-picker
  v-model="color"
  format="hex"
  :show-alpha="false"
/>
```

### 4. 拖动时实时更新页面（如主题色预览）

默认要点「确定」才写入。需要边拖边变，打开 `realtime`：

```vue
<template>
  <view class="page" :style="{ backgroundColor: themeColor }">
    <kex-color-picker
      v-model="themeColor"
      format="hex"
      :realtime="true"
    />
  </view>
</template>

<script setup>
import { ref } from 'vue'
const themeColor = ref('#0D9488')
</script>
```

### 5. 自定义预设色

```vue
<template>
  <kex-color-picker
    v-model="color"
    :presets="brandColors"
    :show-recent="true"
  />
</template>

<script setup>
import { ref } from 'vue'

const color = ref('#E11D48')
const brandColors = [
  '#E11D48',
  '#EA580C',
  '#CA8A04',
  '#16A34A',
  '#0D9488',
  '#0284C7',
  '#1C1917',
  '#FFFFFF'
]
</script>
```

### 6. 自定义触发器（插槽）

```vue
<template>
  <kex-color-picker v-model="color">
    <template #trigger="{ color: c, disabled }">
      <view class="my-trigger" :class="{ disabled }" :style="{ backgroundColor: c }">
        <text>主题色 {{ c }}</text>
      </view>
    </template>
  </kex-color-picker>
</template>

<script setup>
import { ref } from 'vue'
const color = ref('#CA8A04')
</script>

<style>
.my-trigger {
  padding: 16rpx 24rpx;
  border-radius: 12rpx;
  color: #fff;
}
.my-trigger.disabled {
  opacity: 0.45;
}
</style>
```

插槽参数：

| 参数 | 说明 |
| --- | --- |
| `color` | 当前颜色的 css 字符串（用于预览背景） |
| `rgba` | `{ r, g, b, a }` 对象 |
| `disabled` | 是否禁用 |

### 7. 隐藏触发器，外部按钮打开

```vue
<template>
  <view>
    <kex-color-picker
      ref="pickerRef"
      v-model="color"
      :show-trigger="false"
      @confirm="onConfirm"
    />
    <button type="primary" @click="openPicker">选择颜色</button>
    <text>{{ color }}</text>
  </view>
</template>

<script setup>
import { ref } from 'vue'

const color = ref('#1C1917')
const pickerRef = ref(null)

const openPicker = () => {
  pickerRef.value && pickerRef.value.open()
}

const onConfirm = (payload) => {
  // payload: { value, rgba, hsv, hex }
  console.log(payload)
}
</script>
```

### 8. 禁用

```vue
<kex-color-picker v-model="color" :disabled="true" />
```

---

## 完整示例

表单场景：主题色 + 确认回调 + 清空。

```vue
<template>
  <view class="form">
    <view class="form-item">
      <text class="label">主题色</text>
      <kex-color-picker
        v-model="form.theme"
        format="hex"
        size="medium"
        title="选择主题色"
        confirm-text="应用"
        cancel-text="取消"
        :show-alpha="false"
        :presets="presets"
        @change="onThemeChange"
        @confirm="onThemeConfirm"
        @clear="onThemeClear"
      />
    </view>
    <view class="preview" :style="{ backgroundColor: form.theme || '#eee' }" />
  </view>
</template>

<script setup>
import { reactive } from 'vue'

const form = reactive({
  theme: '#0D9488'
})

const presets = ['#E11D48', '#0D9488', '#0284C7', '#1C1917', '#FFFFFF']

const onThemeChange = (val) => {
  console.log('change', val)
}

const onThemeConfirm = ({ value, rgba, hex }) => {
  console.log('confirm', value, rgba, hex)
}

const onThemeClear = () => {
  console.log('已清空')
}
</script>
```

---

## 输出格式 format

`format` 决定 **确认（或 realtime）后写入 `v-model` 的字符串形态**。  
面板顶部的 HEX / RGB / HSL / HSV 切换只影响「编辑输入」，不改变最终输出格式。

| format | 输出示例 | 说明 |
| --- | --- | --- |
| `hex`（默认） | `#0D9488` / `#0D9488CC` | 有透明度且 `showAlpha` 时可能带 alpha 通道 |
| `rgb` | `rgb(13, 148, 136)` | `a < 1` 时自动写成 `rgba(...)` |
| `rgba` | `rgba(13, 148, 136, 0.8)` | 始终带 alpha |
| `hsl` | `hsl(174, 80%, 32%)` | `a < 1` 时可能为 `hsla(...)` |
| `hsv` | `hsv(174, 91%, 58%)` | 色相饱和度明度 |

**回填**：`v-model` 也可传入已有颜色字符串（`#RGB` / `#RRGGBB` / `#RRGGBBAA`、`rgb/rgba`、`hsl/hsla`、`hsv`），组件会解析并定位到色域。

---

## Props

| 属性 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| modelValue | String \| Object | `''` | 双向绑定颜色；对象时需含 `r/g/b`，可选 `a` |
| format | String | `'hex'` | 输出格式，见上表 |
| showAlpha | Boolean | `true` | 是否显示透明度滑条 |
| disabled | Boolean | `false` | 禁用（不可打开） |
| showTrigger | Boolean | `true` | 是否显示触发器；`false` 时用 `ref.open()` |
| size | String | `'medium'` | 触发器尺寸：`small` / `medium` / `large` |
| title | String | `'选择颜色'` | 弹层标题 |
| confirmText | String | `'确定'` | 确认按钮文案 |
| cancelText | String | `'取消'` | 取消按钮文案 |
| clearable | Boolean | `true` | 是否显示「清空」 |
| showPresets | Boolean | `true` | 是否显示预设色区 |
| presets | Array | 内置色板 | 自定义预设，如 `['#E11D48', '#0D9488']` |
| showRecent | Boolean | `true` | 是否显示最近使用 |
| recentLimit | Number | `10` | 最近颜色最多条数 |
| realtime | Boolean | `false` | `true`：拖动/点预设时即时写 `v-model`；`false`：点确定才写 |

---

## Events

| 事件 | 回调参数 | 触发时机 |
| --- | --- | --- |
| update:modelValue | `string` | 与 `change` 同步，供 `v-model` |
| change | `string` | 确认写入，或 `realtime` 时拖动过程中 |
| confirm | `{ value, rgba, hsv, hex }` | 点击「确定」 |
| cancel | — | 点击「取消」或遮罩关闭 |
| clear | — | 点击「清空」（`v-model` 置为 `''`） |
| open | — | 弹层打开 |
| close | — | 弹层关闭动画结束后 |

`confirm` 载荷示例：

```js
{
  value: '#0D9488',           // 按 format 格式化后的值（与 v-model 一致）
  rgba: { r: 13, g: 148, b: 136, a: 1 },
  hsv: { h: 174, s: 91, v: 58 },
  hex: '#0D9488'
}
```

---

## 方法 ref

```vue
<template>
  <kex-color-picker ref="pickerRef" v-model="color" :show-trigger="false" />
</template>

<script setup>
import { ref } from 'vue'
const pickerRef = ref(null)
const color = ref('#0D9488')

pickerRef.value.open()   // 打开
pickerRef.value.close()  // 关闭
</script>
```

| 方法 | 说明 |
| --- | --- |
| `open()` | 打开弹层（`disabled` 时无效） |
| `close()` | 关闭弹层并解锁页面滚动 |

---

## 插槽

| 插槽 | 作用域参数 | 说明 |
| --- | --- | --- |
| `trigger` | `{ color, rgba, disabled }` | 自定义触发器；不写则用默认色块 |
| `footer` | `{ color, rgba }` | 弹层底部扩展区（确定栏下方） |

`footer` 示例：

```vue
<kex-color-picker v-model="color">
  <template #footer="{ color: c }">
    <view class="tip">将应用为：{{ c }}</view>
  </template>
</kex-color-picker>
```

---

## v-model 说明

- **写入**：点击「确定」后，按 `format` 写成字符串赋给 `v-model`（`realtime` 时拖动也会写）。
- **清空**：点「清空」→ `v-model = ''`。
- **取消**：关闭弹层，**不改** `v-model`（除非开了 `realtime` 已改过）。
- **最近色**：仅在「确定」成功后写入本地；Storage key：`kex-color-picker-recent`。

---

## 多端说明

| 端 | 支持 | 说明 |
| --- | --- | --- |
| H5 | √ | 支持鼠标拖选；打开时锁定 `body` 滚动 |
| App（vue） | √ | 触摸拖选；复制用剪贴板 API（已关系统双 toast） |
| 微信 / 支付宝等小程序 | √ | 触摸拖选；遮罩拦截底层滚动 |
| 鸿蒙 | √ | 同 App vue / 小程序路径 |
| nvue | - | 不支持，请用 vue 页 |
| uni-app-x | - | 暂不支持 |

---

## 常见问题

### 1. 点了颜色，页面上的值怎么没变？

默认要点弹层右上角 **「确定」** 才写入。若需要边拖边变，加 `:realtime="true"`。

### 2. H5 复制提示被挡住 / App 出现两个提示？

当前版本已用 **弹层内提示**，并设置 `setClipboardData({ showToast: false })`，避免系统 toast 叠一层。请使用 **≥ 1.0.3**。

### 3. 打开弹层后页面还能滚动？

≥ 1.0.2 会在打开时锁滚动。若仍滚动，确认是否在 **vue 页**（非 nvue），并重新编译。

### 4. 修改 `pages.json` 后找不到演示页？

请 **重新编译运行**（热更新有时不刷新路由）。

### 5. 想隐藏「最近」或「预设」？

```vue
<kex-color-picker
  v-model="color"
  :show-presets="false"
  :show-recent="false"
/>
```

### 6. `format="hex"` 但带了透明度？

开启 `showAlpha` 且 alpha &lt; 1 时，hex 可能输出 8 位（`#RRGGBBAA`）。不需要透明度时设 `:show-alpha="false"`。

---

## 注意事项

1. 仅 **Vue3**；工程需 `vueVersion: "3"`。
2. App / 小程序请放在 **vue 页面**，不要放 nvue。
3. 发布到业务项目时，只需拷贝整个 `uni_modules/kex-color-picker` 目录。
4. 最近颜色存在本地 Storage，清除缓存会丢失。
5. 本示例工程演示页：`pages/demos/color-picker/index`。

---

## 版本

见同目录 [changelog.md](./changelog.md)。当前文档对应 **1.0.3+**。
