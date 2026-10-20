/**
 * 智阅全能AI助手播客接口类型(plugin-summaraidGPT 公开接口)
 */

/** 对话轮次 */
export interface IPodcastTurn {
  /** 主持人 A(提问) / B(解释) */
  speaker: 'A' | 'B'
  /** 台词内容 */
  text: string
  /** 情感标注 */
  emotion?: string
  /** 语气词 */
  interjection?: string
  /** 轮次开始时间(毫秒) */
  startMs?: number
  /** 轮次结束时间(毫秒) */
  endMs?: number
}

/** 播客音频 */
export interface IPodcastAudio {
  /** 音频文件地址(WAV) */
  url: string
  /** 语音服务商 */
  provider: string
  /** 语音模型 */
  model: string
  /** 音频时长(毫秒) */
  durationMs: number
  /** 生成时间 */
  generatedAt?: string
  /** 逐轮时间戳,用于台词高亮 */
  turns: IPodcastTurn[]
}

/** 公开播客数据(GET articlePodcasts/{postName} 响应) */
export interface IPublicPodcast {
  /** 播客标题 */
  title: string
  audio: IPodcastAudio
}
