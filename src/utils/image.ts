/** 图片预览  */
export function imagePreview(url: string, urls?: string[]) {
  uni.previewImage({
    current: url,
    urls: urls ?? [],
    indicator: 'number',
    loop: true,
  })
}
