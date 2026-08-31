/**
 * 随机数工具(源自旧项目 utils/random.js,按需命名导出)
 */

/**
 * 生成指定范围内的随机整数(含边界)
 * @param min 最小值(含)
 * @param max 最大值(不含)
 */
export function getRandomNumberByRange(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min) + min)
}

/**
 * 生成随机颜色(用于瞬间标签等)
 */
export function randomTagColor(): string {
  const colors = ['orange', 'green', 'red', 'blue']
  return colors[getRandomNumberByRange(0, colors.length)]
}
