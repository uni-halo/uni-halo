/**
 * wot-ui useDialog 弹窗按钮通用样式
 * 确认按钮(实底主色)与取消按钮(玻璃卡片描边)全站统一
 * 注:UnoCSS 66+ important 修饰符为后缀(class!)，前缀(!class)已不再生成 CSS
 */
export const DIALOG_CONFIRM_BUTTON_PROPS = {
  customClass: 'bg-primary! uh-global-card-glass text-gray-900! rounded-lg! h-9! text-2xs!',
}

export const DIALOG_CANCEL_BUTTON_PROPS = {
  customClass: 'border-none! after:border-none! uh-global-card-glass uh-shadow-xs! rounded-lg! text-gray-900! h-9! text-2xs!',
}
