/**
 * Live2D 自主说话管理器
 * 驱动模型口型（lip sync）+ 说话气泡钩子
 */

import { LAppModel } from './lappmodel';
import { DynamicModelLoader } from './dynamic_model_loader';
import { LAppLive2DManager } from './lapplive2dmanager';

export type TalkStartCallback = (text: string, durationSec: number) => void;
export type TalkEndCallback = () => void;

export class Live2DTalkManager {
  private _onTalkStartCallbacks: TalkStartCallback[] = [];
  private _onTalkEndCallbacks: TalkEndCallback[] = [];
  private _talkTexts: string[] = [];
  private _autoTalkMinInterval = 8000;  // 默认8秒
  private _autoTalkMaxInterval = 20000; // 默认20秒
  private _autoTalkTimer: ReturnType<typeof setTimeout> | null = null;
  private _autoTalkEnabled = false;
  private _pollTimer: ReturnType<typeof setTimeout> | null = null;
  private _currentText = '';

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

    const wavHandler = (model as any)._wavFileHandler;
    if (!wavHandler) {
      console.warn('[Live2DTalk] WavFileHandler 不可用');
      return;
    }

    this._currentText = text || '';
    wavHandler.start(audioUrl);

    // 等待WAV加载完成后获取时长
    this._pollForDuration(wavHandler);
  }

  /**
   * 轮询等待 WAV 加载完成，获取时长后触发 onTalkStart
   */
  private _pollForDuration(wavHandler: any): void {
    let attempts = 0;
    const maxAttempts = 50; // 最多等5秒

    const check = () => {
      attempts++;
      const duration = wavHandler.getDuration ? wavHandler.getDuration() : 0;

      if (duration > 0 || attempts >= maxAttempts) {
        // 音频已加载，触发开始回调
        const sec = duration > 0 ? duration : 3; // 未知时长默认3秒
        for (const cb of this._onTalkStartCallbacks) {
          try { cb(this._currentText, sec); } catch (e) { console.error(e); }
        }
        // 开始轮询播放结束
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
    if (this._pollTimer) {
      clearTimeout(this._pollTimer);
    }

    const check = () => {
      if (!wavHandler.isPlaying || !wavHandler.isPlaying()) {
        // 播放结束
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
    // 触发结束回调
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

      // 当前模型是否为说话状态（有对应音频文件）
      // 这里仅演示口型动作，无需真实音频文件时使用随机表情代替
      const model = this.getCurrentModel();
      if (model && this._talkTexts.length > 0) {
        const text = this._talkTexts[Math.floor(Math.random() * this._talkTexts.length)];
        // 没有音频时：随机切换一个表情来模拟说话
        if ((model as any).setRandomExpression) {
          (model as any).setRandomExpression();
        }
        // 触发气泡钩子（无音频，使用默认2秒时长）
        this._currentText = text;
        for (const cb of this._onTalkStartCallbacks) {
          try { cb(text, 2); } catch (e) { console.error(e); }
        }
        // 2秒后自动结束气泡
        setTimeout(() => {
          for (const cb of this._onTalkEndCallbacks) {
            try { cb(); } catch (e) { console.error(e); }
          }
          this._scheduleAutoTalk();
        }, 2000);
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
