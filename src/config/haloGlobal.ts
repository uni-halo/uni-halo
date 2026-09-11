/**
 * Halo 全局配置默认值
 * 与 src/api/uni-halo.ts 的 getHaloGlobalInfo(/actuator/globalinfo)配合,deepMerge 使用
 */
import type { IHaloGlobalConfig } from '@/api/types/uni-halo'

export const DefaultHaloGlobalConfigs: IHaloGlobalConfig = {
  allowAnonymousComments: true,
  allowRegistration: true,
  mustVerifyEmailOnRegistration: true,
  mustVerifyPhoneOnRegistration: false,
  restrictRegistrationDomain: false,
  shopDisabled: true,
}
