/**
 * JSON 解析工具(源自旧项目 utils/index.js 的 checkJsonAndParse,按需命名导出)
 */

export interface IParseResult<T = unknown> {
  ok: boolean
  jsonData: T
}

/**
 * 安全解析 JSON 字符串(解析失败返回 ok:false,不抛异常)
 * @param jsonStr 待解析字符串
 */
export function checkJsonAndParse<T = unknown>(jsonStr: string): IParseResult<T> {
  try {
    const jsonResult = JSON.parse(jsonStr)
    return {
      ok: true,
      jsonData: jsonResult as T,
    }
  }
  catch {
    return {
      ok: false,
      jsonData: {} as T,
    }
  }
}
