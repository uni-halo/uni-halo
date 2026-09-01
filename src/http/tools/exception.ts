import type { IResponse } from '../types';

export class UniHaloError extends Error {
	public readonly code: number;
	public readonly data?: any;
	/**
	 * @param message 错误提示
	 * @param code 业务码
	 * @param data 附加对象数据
	 */
	constructor(errData: IResponse) {
		super(errData.message);
		// 必须设置name，instanceof、日志打印才正常
		this.name = this.constructor.name;
		this.code = errData.code;
		this.data = errData.data;

		if (Error.captureStackTrace) {
			Error.captureStackTrace(this, UniHaloError);
		}
	}
}
