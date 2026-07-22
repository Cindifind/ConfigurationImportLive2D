/**
 * Live2D 自主说话管理器
 * 驱动模型口型（lip sync）+ 说话气泡钩子
 * 自动适配不同模型的行为定义（motion / expression）
 */

import { LAppModel } from './lappmodel';
import { DynamicModelLoader } from './dynamic_model_loader';

export type TalkStartCallback = (text: string, durationSec: number) => void;
export type TalkEndCallback = () => void;

/**
 * 自定义说话行为函数
 * @param model       当前 LAppModel 实例
 * @param text        说话文本
 * @param durationSec 预计持续时长（秒）
 *
 * 示例（使用自定义模型的 motion）：
 *   (model, text, duration) => {
 *     model.startRandomMotion('Talk', 3);
 *   }
 *
 * 示例（使用自定义模型的 expression）：
 *   (model, text, duration) => {
 *     model.setRandomExpression();
 *   }
 */
export type TalkActionCallback = (model: LAppModel, text: string, durationSec: number) => void;

/**
 * 模型行为信息
 */
export interface ModelBehaviorInfo {
  motionGroups: string[];
  expressionNames: string[];
  hasLipSync: boolean;
}

export class Live2DTalkManager {
  private _onTalkStartCallbacks: TalkStartCallback[] = [];
  private _onTalkEndCallbacks: TalkEndCallback[] = [];
  private _talkTexts: string[] = [];
  private _autoTalkMinInterval = 8000;
  private _autoTalkMaxInterval = 20000;
  private _autoTalkTimer: ReturnType<typeof setTimeout> | null = null;
  private _autoTalkEnabled = false;
  private _pollTimer: ReturnType<typeof setTimeout> | null = null;
  private _currentText = '';
  private _talkAction: TalkActionCallback | null = null;
  private _talkMotionGroup = '';

  /**
   * 获取当前模型的行为信息（motion 组名、表情名等）
   * 供用户了解模型支持哪些行为，以便配置 setTalkAction
   */
  public getModelInfo(): ModelBehaviorInfo | null {
    const model = this.getCurrentModel();
    if (!model) return null;

    const setting = (model as any)._modelSetting;
    if (!setting) return null;

    const motionGroups: string[] = [];
    const mgCount = setting.getMotionGroupCount?.() || 0;
    for (let i = 0; i < mgCount; i++) {
      motionGroups.push(setting.getMotionGroupName(i));
    }

    const expressionNames: string[] = [];
    const expCount = setting.getExpressionCount?.() || 0;
    for (let i = 0; i < expCount; i++) {
      expressionNames.push(setting.getExpressionName(i));
    }

    const lipSyncCount = setting.getLipSyncParameterCount?.() || 0;

    return {
      motionGroups,
      expressionNames,
      hasLipSync: lipSyncCount > 0
    };
  }

  /**
   * 指定自动说话时播放的 motion 组名
   * @param groupName motion 组名（如 'Talk', 'Speak' 等），传空字符串恢复自动检测
   */
  public setTalkMotionGroup(groupName: string): void {
    this._talkMotionGroup = groupName;
  }

  /**
   * 设置自定义说话行为（完全由用户控制模型做什么）
   * @param action 自定义行为回调，传 null 恢复自动检测模式
   *
   * 自动检测模式优先级：
   *   1. 有表达式 → 随机切换表情
   *   2. 有 motion 组 → 播放随机 motion（跳过 Idle 类）
   *   3. 都没有 → 仅显示气泡，无模型动画
   */
  public setTalkAction(action: TalkActionCallback | null): void {
    this._talkAction = action;
  }

  /**
   * 设置自动说话的文本库
   */
  public setTalkTexts(texts: string[]): void {
    this._talkTexts = texts;
  }

  /**
   * 获取当前文本库
   */
  public getTalkTexts(): string[] {
    return this._talkTexts;
  }

  /**
   * 注册说话开始回调（用于显示气泡）
   */
  public onTalkStart(callback: TalkStartCallback): void {
    this._onTalkStartCallbacks.push(callback);
  }

  /**
   * 注册说话结束回调（用于隐藏气泡）
   */
  public onTalkEnd(callback: TalkEndCallback): void {
    this._onTalkEndCallbacks.push(callback);
  }

  /**
   * 获取当前模型实例
   */
  private getCurrentModel(): LAppModel | null {
    const manager = DynamicModelLoader.getLive2DManager();
    if (!manager || !(manager as any)._models || (manager as any)._models.length === 0) {
      return null;
    }
    return (manager as any)._models[0] as LAppModel;
  }

  /**
   * 执行说话行为（自动检测 或 使用用户自定义）
   */
  private performTalkAction(model: LAppModel, text: string, durationSec: number): void {
    // 1. 用户自定义行为
    if (this._talkAction) {
      try {
        this._talkAction(model, text, durationSec);
      } catch (e) {
        console.error('[Live2DTalk] 自定义 talkAction 执行出错:', e);
      }
      return;
    }

    // 2. 用户指定了 motion 组名
    if (this._talkMotionGroup) {
      try {
        (model as any).startRandomMotion(this._talkMotionGroup, 3);
      } catch (_) { /* 组名不存在则忽略 */ }
      return;
    }

    // 3. 自动检测：有表情就用表情
    if ((model as any)._expressions && (model as any)._expressions.size > 0) {
      try {
        (model as any).setRandomExpression();
      } catch (_) { /* ignore */ }
      return;
    }

    // 4. 自动检测：查找非 Idle 类的 motion 组
    const setting = (model as any)._modelSetting;
    if (setting) {
      const mgCount = setting.getMotionGroupCount?.() || 0;
      for (let i = 0; i < mgCount; i++) {
        const name: string = setting.getMotionGroupName(i);
        // 跳过 Idle / idle / TapBody 等常用非说话组
        const lower = name.toLowerCase();
        if (lower === 'idle' || lower === 'tapbody' || lower === 'tap') continue;
        try {
          (model as any).startRandomMotion(name, 3);
          return;
        } catch (_) { /* try next */ }
      }
      // 如果只有 Idle，就用 Idle
      if (mgCount > 0) {
        try {
          (model as any).startRandomMotion(setting.getMotionGroupName(0), 3);
        } catch (_) { /* ignore */ }
      }
    }
  }

  /**
   * 播放音频并驱动口型
   * @param audioUrl  WAV 音频文件 URL
   * @param text      说话文本（气泡中显示）
   */
  public startTalk(audioUrl: string, text?: string): void {
    const model = this.getCurrentModel();
    if (!model) {
      console.warn('[Live2DTalk] 模型未就绪');
      return;
    }

    this._currentText = text || '';

    // 有音频文件 → 对口型
    if (audioUrl) {
      const wavHandler = (model as any)._wavFileHandler;
      if (wavHandler) {
        wavHandler.start(audioUrl);
        this._pollForDuration(wavHandler);
        return;
      }
    }

    // 无音频文件 → 用表情/motion 模拟说话
    this._doSilentTalk(model, text || '', 2);
  }

  /**
   * 无音频时模拟说话
   */
  private _doSilentTalk(model: LAppModel, text: string, durationSec: number): void {
    this.performTalkAction(model, text, durationSec);

    for (const cb of this._onTalkStartCallbacks) {
      try { cb(text, durationSec); } catch (e) { console.error(e); }
    }

    setTimeout(() => {
      for (const cb of this._onTalkEndCallbacks) {
        try { cb(); } catch (e) { console.error(e); }
      }
    }, durationSec * 1000);
  }

  /**
   * 轮询等待 WAV 加载完成，获取时长后触发 onTalkStart
   */
  private _pollForDuration(wavHandler: any): void {
    let attempts = 0;
    const maxAttempts = 50;

    const check = () => {
      attempts++;
      const duration = wavHandler.getDuration ? wavHandler.getDuration() : 0;

      if (duration > 0 || attempts >= maxAttempts) {
        const sec = duration > 0 ? duration : 3;
        for (const cb of this._onTalkStartCallbacks) {
          try { cb(this._currentText, sec); } catch (e) { console.error(e); }
        }
        this._pollForCompletion(wavHandler);
      } else {
        setTimeout(check, 100);
      }
    };

    setTimeout(check, 50);
  }

  /**
   * 轮询检测音频播放完成
   */
  private _pollForCompletion(wavHandler: any): void {
    if (this._pollTimer) clearTimeout(this._pollTimer);

    const check = () => {
      if (!wavHandler.isPlaying || !wavHandler.isPlaying()) {
        for (const cb of this._onTalkEndCallbacks) {
          try { cb(); } catch (e) { console.error(e); }
        }
        this._pollTimer = null;
        return;
      }
      this._pollTimer = setTimeout(check, 150);
    };

    this._pollTimer = setTimeout(check, 150);
  }

  /**
   * 停止当前说话
   */
  public stopTalk(): void {
    if (this._pollTimer) {
      clearTimeout(this._pollTimer);
      this._pollTimer = null;
    }
    for (const cb of this._onTalkEndCallbacks) {
      try { cb(); } catch (e) { console.error(e); }
    }
  }

  /**
   * 开启自动说话
   * @param minIntervalMs 最小间隔（毫秒），默认 8000
   * @param maxIntervalMs 最大间隔（毫秒），默认 20000
   */
  public startAutoTalk(minIntervalMs?: number, maxIntervalMs?: number): void {
    if (minIntervalMs !== undefined) this._autoTalkMinInterval = minIntervalMs;
    if (maxIntervalMs !== undefined) this._autoTalkMaxInterval = maxIntervalMs;
    this._autoTalkEnabled = true;
    this._scheduleAutoTalk();
    console.log(`[Live2DTalk] 自动说话已开启 (间隔 ${this._autoTalkMinInterval / 1000}s ~ ${this._autoTalkMaxInterval / 1000}s)`);
  }

  /**
   * 停止自动说话
   */
  public stopAutoTalk(): void {
    this._autoTalkEnabled = false;
    if (this._autoTalkTimer) {
      clearTimeout(this._autoTalkTimer);
      this._autoTalkTimer = null;
    }
    this.stopTalk();
    console.log('[Live2DTalk] 自动说话已停止');
  }

  /**
   * 调度下一次自动说话
   */
  private _scheduleAutoTalk(): void {
    if (!this._autoTalkEnabled) return;

    const delay =
      this._autoTalkMinInterval +
      Math.random() * (this._autoTalkMaxInterval - this._autoTalkMinInterval);

    this._autoTalkTimer = setTimeout(() => {
      if (!this._autoTalkEnabled) return;

      const model = this.getCurrentModel();
      if (model && this._talkTexts.length > 0) {
        const text = this._talkTexts[Math.floor(Math.random() * this._talkTexts.length)];
        this._doSilentTalk(model, text, 2);

        setTimeout(() => this._scheduleAutoTalk(), 2200);
      } else {
        this._scheduleAutoTalk();
      }
    }, delay);
  }
}

// 单例
let talkManagerInstance: Live2DTalkManager | null = null;

export function getTalkManager(): Live2DTalkManager {
  if (!talkManagerInstance) {
    talkManagerInstance = new Live2DTalkManager();
  }
  return talkManagerInstance;
}
