/**
 * Copyright(c) Live2D Inc. All rights reserved.
 *
 * Use of this source code is governed by the Live2D Open Software license
 * that can be found at https://www.live2d.com/eula/live2d-open-software-license-agreement_en.html.
 */

import { LAppDelegate } from '../lappdelegate';
import { DynamicModelLoader, resolveModelPath } from '../dynamic_model_loader';
import { LAppLive2DManager } from '../lapplive2dmanager';
import { LAppSubdelegate } from '../lappsubdelegate';
import { LAppModel } from '../lappmodel';
import { LAppView } from '../lappview';
import { getTalkManager, TalkStartCallback, TalkEndCallback, TalkActionCallback, ModelBehaviorInfo } from '../live2dtalkmanager';
import { CubismFramework } from '@framework/live2dcubismframework';

// ===== 就绪状态管理 =====
let _apiReady = false;
const _apiReadyCallbacks: Array<() => void> = [];

/** 模型未就绪时静默跳过 */
function guard(): boolean {
  if (!_apiReady) return false;
  return true;
}

/** 由 initApp() 在模型与着色器就绪后调用，触发所有排队的回调 */
export function setReady(): void {
  _apiReady = true;
  const cbs = _apiReadyCallbacks.splice(0);
  for (const cb of cbs) { try { cb(); } catch (e) { console.error(e); } }
  console.log(`[Live2DModel] setReady: ${cbs.length} 个回调已执行`);
}

// ===== 辅助函数 =====
function getLive2DManager(): LAppLive2DManager | null {
  return DynamicModelLoader.getLive2DManager();
}

function getSubdelegate(): LAppSubdelegate | null {
  return LAppDelegate.getInstance().getFirstSubdelegate();
}

/** 获取当前模型实例 */
function getCurrentModel(): LAppModel | null {
  const mgr = getLive2DManager();
  return mgr ? mgr.getFirstModel() : null;
}

// ===== 动作注册表 =====
const _actionRegistry = new Map<string, (...args: any[]) => void>();

// ===== 参数动画注册表 =====
const _animActions = new Map<string, Array<{ paramId: string; value: number; delay?: number }>>();

// ===== 对外暴露的 API =====
export const Live2DModelAPI = {
  /**
   * 运行时切换模型（无需刷新页面）
   * @param name 模型名称，如 'Haru', 'Mao' 等
   */
  changeModel(name: string): void {
    if (!guard()) return;
    const config = (window as any).Live2DConfig;
    const manager = getLive2DManager();
    if (!manager) {
      console.warn('[Live2DModel] 管理器未就绪');
      return;
    }
    const { dir, name: modelName } = resolveModelPath(name);
    DynamicModelLoader.changeModel(dir, modelName + '.model3.json', manager, config?.texturePath)
      .then(() => console.log(`[Live2DModel] 已切换到模型: ${name}`))
      .catch((e: any) => console.error('[Live2DModel] 切换模型失败:', e));
  },

  /**
   * 运行时切换背景显示
   */
  showBackground(show: boolean): void {
    if (!guard()) return;
    const config = (window as any).Live2DConfig;
    if (config) config.showBackground = show;
    console.log(`[Live2DModel] 背景显示: ${show}`);
  },

  /**
   * 设置配置项
   */
  setConfig(key: string, value: string | boolean): void {
    if (!guard()) return;
    const config = (window as any).Live2DConfig || {};
    (config as any)[key] = value;
    (window as any).Live2DConfig = config;
    const container = document.getElementById('live2d-container') || document.querySelector('[data-cubism-model]');
    if (container) {
      const attrName = 'data-' + key.replace(/([A-Z])/g, '-$1').toLowerCase();
      container.setAttribute(attrName, String(value));
    }
    console.log(`[Live2DModel] 配置已更新: ${key} = ${value}`);
  },

  refresh(): void {
    location.reload();
  },

  /**
   * 获取画布所在的容器元素
   * @returns HTML 容器元素
   */
  getContainer(): HTMLElement | null {
    const sd = getSubdelegate();
    if (sd) {
      const canvas = sd.getCanvas();
      return canvas ? canvas.parentElement : null;
    }
    return null;
  },

  /**
   * 设置画布容器（需在初始化前调用，否则需 refresh()）
   * @param el 目标容器元素 或 CSS 选择器字符串
   *
   * 用法：
   *   // 方式一：传入元素
   *   Live2DModel.setContainer(document.getElementById('my-wrapper'));
   *
   *   // 方式二：传入选择器
   *   Live2DModel.setContainer('#my-wrapper');
   */
  setContainer(el: HTMLElement | string): void {
    const element = typeof el === 'string' ? document.querySelector(el) as HTMLElement : el;
    if (!element) {
      console.warn('[Live2DModel] setContainer: 未找到目标元素');
      return;
    }
    // 存储引用，下次 refresh() 时使用
    (window as any)._live2dContainer = element;
    console.log('[Live2DModel] 容器已设置（需 refresh() 生效）');
  },

  /**
   * 注册初始化完成回调
   * 如果模型已就绪，立即执行；否则排队等待
   * @param cb 回调函数
   */
  onReady(cb: () => void): void {
    if (_apiReady) { cb(); return; }
    _apiReadyCallbacks.push(cb);
  },

  /**
   * 返回 Promise，在模型就绪时 resolve
   * 用法: await Live2DModel.whenReady()
   */
  async whenReady(): Promise<void> {
    if (_apiReady) return;
    return new Promise(resolve => {
      _apiReadyCallbacks.push(resolve);
    });
  },

  // ===== 说话 / 气泡钩子 =====

  /**
   * 播放音频并驱动口型（对口型）
   * @param audioUrl WAV 音频文件 URL
   * @param text     说话文本（显示在气泡中）
   */
  startTalk(audioUrl: string, text?: string): void {
    if (!guard()) return;
    getTalkManager().startTalk(audioUrl, text);
  },

  /**
   * 从 ArrayBuffer 加载 WAV 并驱动口型（无需 fetch）
   * @param arrayBuffer WAV 文件的原始字节数据
   * @param text        说话文本（显示在气泡中）
   *
   * 用法：
   *   const res = await fetch('audio.wav');
   *   const buf = await res.arrayBuffer();
   *   Live2DModel.startTalkFromBytes(buf, '你好！');
   */
  startTalkFromBytes(arrayBuffer: ArrayBuffer, text?: string): void {
    if (!guard()) return;
    getTalkManager().startTalkFromBytes(arrayBuffer, text);
  },

  stopTalk(): void {
    if (!guard()) return;
    getTalkManager().stopTalk();
  },

  startAutoTalk(minIntervalMs?: number, maxIntervalMs?: number): void {
    if (!guard()) return;
    getTalkManager().startAutoTalk(minIntervalMs, maxIntervalMs);
  },

  stopAutoTalk(): void {
    if (!guard()) return;
    getTalkManager().stopAutoTalk();
  },

  setTalkTexts(texts: string[]): void {
    if (!guard()) return;
    getTalkManager().setTalkTexts(texts);
  },

  /**
   * 注册说话开始回调（用于显示气泡）
   * @param cb (text: string, durationSec: number) => void
   */
  onTalkStart(cb: TalkStartCallback): void {
    getTalkManager().onTalkStart(cb);
  },

  /**
   * 注册说话结束回调（用于隐藏气泡）
   * @param cb () => void
   */
  onTalkEnd(cb: TalkEndCallback): void {
    getTalkManager().onTalkEnd(cb);
  },

  /**
   * 获取当前模型的行为信息（motion 组名、表情名等）
   * 用于了解模型支持哪些行为，方便配置 setTalkAction
   * @returns { motionGroups: string[], expressionNames: string[], hasLipSync: boolean }
   *
   * 用法：
   *   Live2DModel.onReady(() => {
   *     const info = Live2DModel.getModelInfo();
   *     console.log(info.motionGroups);     // ['Idle', 'Talk', 'TapBody']
   *     console.log(info.expressionNames);  // ['F01', 'F02', ...]
   *   });
   */
  getModelInfo(): ModelBehaviorInfo | null {
    return getTalkManager().getModelInfo();
  },

  /**
   * 设置自定义说话行为（完全控制模型说话时做什么）
   * @param action 自定义回调 (model, text, durationSec) => void，传 null 恢复自动检测
   *
   * 自动检测模式优先级：
   *   1. 有表达式 → 随机切换表情
   *   2. 有 motion 组 → 播放随机 motion（跳过 Idle 类）
   *   3. 都没有 → 仅显示气泡
   *
   * 用法（使用自定义模型 'Talk' motion 组）：
   *   Live2DModel.setTalkAction((model, text, duration) => {
   *     model.startRandomMotion('Talk', 3);
   *   });
   *
   * 用法（使用多个行为组合）：
   *   Live2DModel.setTalkAction((model, text, duration) => {
   *     model.setRandomExpression();
   *     model.startRandomMotion('Speak', 3);
   *   });
   */
  setTalkAction(action: TalkActionCallback | null): void {
    if (!guard()) return;
    getTalkManager().setTalkAction(action);
  },

  setTalkMotionGroup(groupName: string): void {
    if (!guard()) return;
    getTalkManager().setTalkMotionGroup(groupName);
  },

  /**
   * 加载外部 .motion3.json 并以名称注册
   * @param name motion 名称（后续 playMotion 用此名称）
   * @param url  .motion3.json 文件路径
   *
   * 用法：
   *   await Live2DModel.loadMotion('shy', './Elysia/motions/lasi.motion3.json');
   *   Live2DModel.playMotion('shy');
   */
  async loadMotion(name: string, url: string): Promise<void> {
    const model = getCurrentModel();
    if (!model) return;
    try {
      const res = await fetch(url);
      const buf = await res.arrayBuffer();
      model.loadMotionById(buf, name);
    } catch (e) {
      console.error(`[Live2DModel] 加载 motion 失败: ${url}`, e);
    }
  },

  /**
   * 播放已注册的 motion
   * @param name     加载时注册的名称
   * @param priority 优先级，默认 3（强制）
   *
   * 用法：
   *   Live2DModel.playMotion('shy');
   */
  playMotion(name: string, priority = 3): void {
    if (!guard()) return;
    const model = getCurrentModel();
    if (model) {
      model.playMotionById(name, priority);
    }
  },

  /**
   * 停止当前模型的所有 motion
   */
  stopAllMotions(): void {
    if (!guard()) { console.warn('[Live2DModel] stopAllMotions: 模型未就绪'); return; }
    const model = getCurrentModel();
    if (!model) { console.warn('[Live2DModel] stopAllMotions: model 为空'); return; }
    console.log('[Live2DModel] stopAllMotions: 调用 model.stopAllMotions()');
    model.stopAllMotions();
    model.clearParamOverrides();
  },

  // ===== 缩放控制 =====

  _getView(): LAppView | null {
    const sd = getSubdelegate();
    return sd ? sd.getView() : null;
  },

  setScale(scale: number): void {
    if (!guard()) return;
    const view = this._getView();
    if (view) view.setUserScale(scale);
  },

  getScale(): number {
    const view = this._getView();
    return view ? view.getUserScale() : 1.0;
  },

  zoomByWheel(delta: number): void {
    if (!guard()) return;
    const view = this._getView();
    if (view) view.zoomByWheel(delta);
  },

  // ===== 自定义触控区域 =====

  /**
   * 注册模型触控区域回调（区域名来自 .cdi3.json HitArea 定义）
   * @param areaName 区域名，如 'Head', 'Body'，或自定义名称
   * @param callback 命中回调 (areaName, x, y) => void
   *
   * 用法：
   *   Live2DModel.onHitArea('Head', (name, x, y) => {
   *     console.log(`点击了${name}`);
   *     Live2DModel.startTalk('', '别摸头！');
   *   });
   */
  onHitArea(areaName: string, callback: (areaName: string, x: number, y: number) => void): void {
    const mgr = getLive2DManager();
    if (mgr) mgr.addHitAreaCallback(areaName, callback);
  },

  /**
   * 移除触控区域回调
   */
  offHitArea(areaName: string, callback: (areaName: string, x: number, y: number) => void): void {
    const mgr = getLive2DManager();
    if (mgr) mgr.removeHitAreaCallback(areaName, callback);
  },

  /**
   * 注册任意点击回调（不区分区域，每次点击都触发）
   * @param callback (x, y) => void
   */
  onAnyTap(callback: (x: number, y: number) => void): void {
    const mgr = getLive2DManager();
    if (mgr) mgr.onAnyTap(callback);
  },

  // ===== 通用动作注册表 =====

  /**
   * 注册一个命名动作（通用，不仅限于 talk）
   * @param name 动作名称
   * @param fn   动作函数，参数由调用者传入
   *
   * 用法：
   *   Live2DModel.registerAction('greet', (text) => {
   *     Live2DModel.startTalk('', text);
   *   });
   *   Live2DModel.triggerAction('greet', '你好！');
   */
  registerAction(name: string, fn: (...args: any[]) => void): void {
    _actionRegistry.set(name, fn);
  },

  /**
   * 触发已注册的命名动作
   * @param name 动作名称
   * @param args 传递给动作函数的参数
   */
  triggerAction(name: string, ...args: any[]): void {
    if (!guard()) return;
    const fn = _actionRegistry.get(name);
    if (fn) {
      try { fn(...args); } catch (e) { console.error(`[Live2DModel] action "${name}" 执行出错:`, e); }
    } else {
      console.warn(`[Live2DModel] 未注册的 action: "${name}"`);
    }
  },

  /**
   * 移除已注册的动作
   */
  unregisterAction(name: string): void {
    _actionRegistry.delete(name);
  },

  /**
   * 获取所有已注册的动作名称
   */
  listActions(): string[] {
    return Array.from(_actionRegistry.keys());
  },

  // ===== 参数动画系统 =====

  /**
   * 注册一个参数动画（关键帧序列）
   * @param name 动画名称
   * @param keyframes 关键帧数组
   *
   * 每个关键帧：
   *   paramId - 参数 ID（来自模型 .model3.json 的 Parameters 段）
   *   value   - 目标值（通常 0~1）
   *   delay   - 距上一个关键帧的延迟（毫秒），默认 0
   *
   * 用法：
   *   Live2DModel.setAction('捂胸', [
   *     { paramId: 'Param19', value: 1, delay: 0    },  // 立即设为 1
   *     { paramId: 'Param19', value: 0, delay: 1500 },  // 1.5 秒后归 0
   *   ]);
   *
   *   Live2DModel.playAction('捂胸');
   */
  setAction(name: string, keyframes: Array<{ paramId: string; value: number; delay?: number }>): void {
    _animActions.set(name, keyframes);
  },

  playAction(name: string): void {
    if (!guard()) { console.warn(`[Live2DModel] playAction "${name}" 跳过（模型未就绪）`); return; }
    const kfs = _animActions.get(name);
    if (!kfs) { console.warn(`[Live2DModel] 未注册的动画: "${name}"`); return; }
    const model = getCurrentModel();
    if (!model) { console.warn(`[Live2DModel] playAction: model 为空`); return; }

    // 计算每个关键帧的绝对开始时间和持续时间
    // 持续时间 = 到同参数下一个关键帧的间隔（最后一个用 delay 或 500ms）
    const schedule: Array<{ paramId: string; value: number; startMs: number; holdMs: number }> = [];
    let elapsed = 0;
    for (let i = 0; i < kfs.length; i++) {
      const kf = kfs[i];
      elapsed += kf.delay || 0;
      // 找同参数的下一个关键帧来计算 hold 时间
      let holdMs = 500; // 默认保持 500ms
      for (let j = i + 1; j < kfs.length; j++) {
        if (kfs[j].paramId === kf.paramId) {
          let nextStart = 0;
          for (let k = 0; k <= j; k++) nextStart += kfs[k].delay || 0;
          holdMs = nextStart - elapsed;
          break;
        }
      }
      schedule.push({ paramId: kf.paramId, value: kf.value, startMs: elapsed, holdMs });
    }

    // 用 setTimeout 触发每个关键帧，但通过 setParamOverride 让值在每帧持续生效
    for (const s of schedule) {
      setTimeout(() => {
        model.setParamOverride(s.paramId, s.value, Date.now() + s.holdMs);
        console.log(`[Live2DModel] ${s.paramId} = ${s.value} (hold ${s.holdMs}ms)`);
      }, s.startMs);
    }

    // 标记动画结束
    const totalDuration = elapsed + 500;
    setTimeout(() => {
      model._pendingActionFinish = true;
    }, totalDuration);
  },

  removeAction(name: string): void {
    _animActions.delete(name);
  },

  listAnimNames(): string[] {
    return Array.from(_animActions.keys());
  },

  /**
   * 获取单个参数的完整信息
   * @param paramId 参数 ID（如 'shy', 'Param91' 等）
   * @returns { id, index, min, max, default, current } 或 null
   *
   * 用法：
   *   Live2DModel.getParameter('shy')
   *   // → { id: 'shy', index: 0, min: 0, max: 1, default: 0, current: 0.5 }
   */
  getParameter(paramId: string): { id: string; index: number; min: number; max: number; default: number; current: number } | null {
    const model = getCurrentModel();
    if (!model) return null;
    const cubismModel = model.getModel();
    if (!cubismModel) return null;

    const id = CubismFramework.getIdManager().getId(paramId);
    const index = cubismModel.getParameterIndex(id);
    if (index < 0) return null;

    return {
      id: paramId,
      index,
      min: cubismModel.getParameterMinimumValue(index),
      max: cubismModel.getParameterMaximumValue(index),
      default: cubismModel.getParameterDefaultValue(index),
      current: cubismModel.getParameterValueByIndex(index),
    };
  },

  /**
   * 列出模型所有参数的 ID、取值范围、默认值、当前值
   * 返回数组并在 console 打印表格
   *
   * 用法：
   *   const params = Live2DModel.listParameters()
   *   // Console 输出表格，返回数组
   */
  listParameters(silent = false): Array<{ index: number; id: string; min: number; max: number; default: number; current: number }> {
    const model = getCurrentModel();
    if (!model) return [];
    const cubismModel = model.getModel();
    if (!cubismModel) return [];

    const count = cubismModel.getParameterCount();
    const result = Array.from({ length: count }, (_, i) => {
      const cid = cubismModel.getParameterId(i);
      const name = (typeof cid === 'object' ? cid.getString?.() : String(cid)) || '';
      return {
        index: i,
        id: name,
        min: cubismModel.getParameterMinimumValue(i),
        max: cubismModel.getParameterMaximumValue(i),
        default: cubismModel.getParameterDefaultValue(i),
        current: cubismModel.getParameterValueByIndex(i),
      };
    });

    if (!silent) console.table(result);
    return result;
  },

  /**
   * 列出所有已注册的自定义动画及其关键帧详情
   *
   * 用法：
   *   const anims = Live2DModel.listAnimActions()
   *   // → [{ name: '脸红', keyframes: [{ paramId, value, delay }, ...] }, ...]
   */
  listAnimActions(): Array<{ name: string; keyframes: Array<{ paramId: string; value: number; delay: number }> }> {
    const result: Array<{ name: string; keyframes: Array<{ paramId: string; value: number; delay: number }> }> = [];
    for (const [name, kfs] of _animActions.entries()) {
      result.push({
        name,
        keyframes: kfs.map(kf => ({ paramId: kf.paramId, value: kf.value, delay: kf.delay || 0 })),
      });
    }
    if (result.length > 0) {
      const tableRows: Array<{ action: string; step: number; paramId: string; value: number; delay: number }> = [];
      for (const a of result) {
        for (let i = 0; i < a.keyframes.length; i++) {
          const kf = a.keyframes[i];
          tableRows.push({ action: a.name, step: i, paramId: kf.paramId, value: kf.value, delay: kf.delay });
        }
      }
      console.table(tableRows);
    }
    return result;
  },

  /**
   * 直接设置单个参数值（实时覆盖，用于控制面板滑块）
   * @param paramId 参数 ID
   * @param value   目标值
   */
  _setParamDirect(paramId: string, value: number): void {
    const model = getCurrentModel();
    if (!model) return;
    model.setParamOverride(paramId, value, Date.now() + 500);
  }
};
