/** 复制文本到剪贴板 */
export function copyToClipboard(content: string, tips = '内容已复制成功！') {
  uni.setClipboardData({
    data: content,
    showToast: false,
    success: () => {
      if (tips) {
        uni.showToast({ icon: 'none', title: tips })
      }
    },
  })
}
