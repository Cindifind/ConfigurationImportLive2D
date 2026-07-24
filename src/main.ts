/**
 * Copyright(c) Live2D Inc. All rights reserved.
 *
 * Use of this source code is governed by the Live2D Open Software license
 * that can be found at https://www.live2d.com/eula/live2d-open-software-license-agreement_en.html.
 */

import { LAppDelegate } from './lappdelegate';
import * as LAppDefine from './lappdefine';
import { DynamicModelLoader } from './dynamic_model_loader';
import { CubismShaderManager_WebGL } from '@framework/rendering/cubismshader_webgl';
import { LAppLive2DManager } from './lapplive2dmanager';
import { LAppSubdelegate } from './lappsubdelegate';
import { LAppModel, LoadStep } from './lappmodel';
import { LAppView } from './lappview';
import { getTalkManager, TalkStartCallback, TalkEndCallback, TalkActionCallback, ModelBehaviorInfo } from './live2dtalkmanager';
import { CubismFramework } from '@framework/live2dcubismframework';

// 声明全局配置接口
interface Window {
  Live2DConfig?: {
    modelPath?: string;
    modelName?: string;
    showBackground?: boolean;
    backgroundImage?: string;
    shaderPath?: string;
  };
}

/**
 * 等待着色器异步加载完成后再启动渲染循环
 * 解决 "[CSM][W]Shader program is not initialized" 警告
 */
function waitForShadersThenRun(maxWaitMs = 8000): void {
  const app = LAppDelegate.getInstance() as any;
  const subdelegates: any[] = app._subdelegates;
  
  if (!subdelegates || subdelegates.length === 0) {
    console.warn('[Live2D] 无 subdelegate，直接启动渲染循环');
    LAppDelegate.getInstance().run();
    return;
  }

  const gl = subdelegates[0].getGl();
  if (!gl) {
    console.warn('[Live2D] GL context 不可用，直接启动渲染循环');
    LAppDelegate.getInstance().run();
    return;
  }

  console.log('[Live2D] 开始等待着色器加载...');
  
  const startTime = Date.now();
  let pollCount = 0;
  const checkShader = (): void => {
    pollCount++;
    try {
      const shader = CubismShaderManager_WebGL.getInstance().getShader(gl);
      if (shader && (shader as any)._isShaderLoaded) {
        console.log(`[Live2D] 着色器已加载 (轮询${pollCount}次, ${Date.now() - startTime}ms)，启动渲染循环`);
        LAppDelegate.getInstance().run();
        return;
      }
      if (pollCount === 1 || pollCount % 20 === 0) {
        console.log(`[Live2D] 着色器尚未就绪，继续等待... (轮询${pollCount}次, ${Date.now() - startTime}ms)`);
      }
    } catch (_) {
      // GL context 可能还未就绪
    }

    if (Date.now() - startTime > maxWaitMs) {
      console.warn(`[Live2D] 着色器加载超时 (${maxWaitMs}ms)，强制启动渲染循环`);
      LAppDelegate.getInstance().run();
      return;
    }

    setTimeout(checkShader, 50);
  };

  // 先等 100ms 让模型加载触发着色器加载
  setTimeout(checkShader, 100);
}

/**
 * アプリケーションの初期化処理
 * 页面加载完成 或 动态import后 都会调用
 */
function initApp(): void {
  console.log('[Live2D] initApp() 开始初始化...');
  
  // 从HTML元素获取配置
  const configElement = document.getElementById('live2d-container') || document.querySelector('[data-cubism-model]');
  
  // 默认使用 lappdefine 中的 ResourcesPath（支持跨域CDN配置）
  let modelPath = LAppDefine.ResourcesPath;
  let modelName = 'Haru';
  
  // 优先级：HTML data属性 > URL参数 > 默认值
  let showBackground = true; // 默认显示背景图
  let backgroundImage = '';  // 自定义背景图路径（空字符串 = 使用默认）
  let shaderPath = '';       // 自定义着色器路径（空字符串 = 使用默认）
  let targetContainer: HTMLElement | undefined = undefined;

  if (configElement) {
    const htmlModelPath = configElement.getAttribute('data-model-path');
    const htmlModelName = configElement.getAttribute('data-cubism-model');
    const htmlShowBg = configElement.getAttribute('data-show-background');
    const htmlBgImage = configElement.getAttribute('data-background-image');
    const htmlShaderPath = configElement.getAttribute('data-shader-path');
    const htmlContainer = configElement.getAttribute('data-container');

    if (htmlModelPath) modelPath = htmlModelPath;
    if (htmlModelName) modelName = htmlModelName;
    if (htmlShowBg !== null) showBackground = htmlShowBg === 'true';
    if (htmlBgImage !== null) backgroundImage = htmlBgImage;
    if (htmlShaderPath !== null) shaderPath = htmlShaderPath;

    // 容器：data-container 可以是 CSS 选择器，未指定则使用配置元素自身
    if (htmlContainer) {
      targetContainer = document.querySelector(htmlContainer) as HTMLElement || undefined;
      if (!targetContainer) {
        console.warn(`[Live2D] data-container 选择器 "${htmlContainer}" 未匹配到任何元素，回退到配置元素自身`);
      }
    }
    if (!targetContainer) {
      targetContainer = configElement as HTMLElement;
    }

    // 检查通过 API 设置的容器覆盖
    if ((window as any)._live2dContainer) {
      targetContainer = (window as any)._live2dContainer;
    }

    console.log(`[Live2D] HTML配置: modelPath=${modelPath}, modelName=${modelName}, showBackground=${showBackground}, bgImage=${backgroundImage || '默认'}, shaderPath=${shaderPath || '默认'}, container=${htmlContainer || '(自身)'}`);
  } else {
    console.log('[Live2D] 未检测到 HTML 容器属性');
    const urlParams = new URLSearchParams(window.location.search);
    const urlModelPath = urlParams.get('modelPath');
    const urlModelName = urlParams.get('modelName');
    const urlShowBg = urlParams.get('showBackground');
    const urlBgImage = urlParams.get('backgroundImage');
    const urlShaderPath = urlParams.get('shaderPath');
    
    if (urlModelPath) modelPath = urlModelPath;
    if (urlModelName) modelName = urlModelName;
    if (urlShowBg !== null) showBackground = urlShowBg === 'true';
    if (urlBgImage !== null) backgroundImage = urlBgImage;
    if (urlShaderPath !== null) shaderPath = urlShaderPath;
  }
  
  // 保存配置到全局变量
  (window as any).Live2DConfig = {
    modelPath: modelPath,
    modelName: modelName,
    showBackground: showBackground,
    backgroundImage: backgroundImage,
    shaderPath: shaderPath
  };
  
  console.log(`[Live2D] 开始初始化 WebGL 和应用程序...`);
  
  // Initialize WebGL and create the application instance
  if (!LAppDelegate.getInstance().initialize(targetContainer)) {
    console.error('[Live2D] LAppDelegate.initialize() 失败!');
    return;
  }
  
  console.log('[Live2D] LAppDelegate.initialize() 完成');
  
  // 从HTML配置加载模型
  DynamicModelLoader.loadModelFromHtmlConfig();
  
  // 等待着色器加载完成后再启动渲染循环
  waitForShadersThenRun();
}

/**
 * ブラウザロード後の処理
 * 兼容两种场景：
 *   1. 页面正常加载（监听 load 事件）
 *   2. 外部动态 import（页面已加载完成，直接执行）
 */
if (document.readyState === 'complete') {
  // 页面已加载完成（动态import场景），直接初始化
  initApp();
} else {
  window.addEventListener('load', initApp, { passive: true });
}

/**
 * 終了時の処理
 */
window.addEventListener(
  'beforeunload',
  (): void => LAppDelegate.releaseInstance(),
  { passive: true }
);

// ===== 就绪状态管理 =====
let _ready = false;
const _onReadyCallbacks: Array<() => void> = [];

/** 模型未就绪时静默跳过 */
function guard(): boolean {
  if (!_ready) return false;
  return true;
}

/** 启动内部就绪检查器 */
function _startReadyChecker(): void {
  let pollCount = 0;
  const check = (): void => {
    pollCount++;
    const mgr = DynamicModelLoader.getLive2DManager();
    
    if (!mgr) {
      if (pollCount <= 3 || pollCount % 20 === 0) {
        console.log(`[Live2D] onReady checker: manager 未就绪 (轮询${pollCount}次)`);
      }
      setTimeout(check, 100);
      return;
    }
    
    const models = (mgr as any)._models;
    if (!models || models.length === 0) {
      if (pollCount <= 3 || pollCount % 20 === 0) {
        console.log(`[Live2D] onReady checker: _models 为空 (轮询${pollCount}次)`);
      }
      setTimeout(check, 100);
      return;
    }
    
    const model = models[0] as LAppModel;
    const state = (model as any)._state;
    if (pollCount <= 3 || pollCount % 10 === 0) {
      console.log(`[Live2D] onReady checker: model._state=${state} (轮询${pollCount}次)`);
    }
    
    if (model && state === LoadStep.CompleteSetup) {
      console.log(`[Live2D] onReady checker: 模型就绪! state=${state}, 待执行回调=${_onReadyCallbacks.length}`);
      _ready = true;
      const cbs = _onReadyCallbacks.splice(0);
      for (const cb of cbs) { try { cb(); } catch (e) { console.error(e); } }
      return;
    }
    setTimeout(check, 100);
  };
  setTimeout(check, 200);
}

_startReadyChecker();

// ===== 对外暴露的 API (window.Live2DModel) =====
function getLive2DManager(): LAppLive2DManager | null {
  return DynamicModelLoader.getLive2DManager();
}

function getSubdelegate(): LAppSubdelegate | null {
  const appDelegate = LAppDelegate.getInstance() as any;
  if (appDelegate._subdelegates && appDelegate._subdelegates.length > 0) {
    return appDelegate._subdelegates[0];
  }
  return null;
}

function buildFullModelPath(modelPath: string, modelName: string): string {
  const normalizedPath = modelPath.endsWith('/') ? modelPath : modelPath + '/';
  if (normalizedPath.endsWith('/' + modelName + '/') || normalizedPath.endsWith('/' + modelName)) {
    return normalizedPath.endsWith('/') ? normalizedPath : normalizedPath + '/';
  }
  return normalizedPath + modelName + '/';
}

(window as any).Live2DModel = {
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
    const modelPath = config?.modelPath || LAppDefine.ResourcesPath;
    const fullPath = buildFullModelPath(modelPath, name);
    DynamicModelLoader.changeModel(fullPath, name + '.model3.json', manager)
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
    if (_ready) { cb(); return; }
    _onReadyCallbacks.push(cb);
  },

  /**
   * 返回 Promise，在模型就绪时 resolve
   * 用法: await Live2DModel.whenReady()
   */
  async whenReady(): Promise<void> {
    if (_ready) return;
    return new Promise(resolve => {
      _onReadyCallbacks.push(resolve);
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
    const mgr = getLive2DManager();
    if (!mgr) return;
    const model = (mgr as any)._models[0] as LAppModel;
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
    const mgr = getLive2DManager();
    if (!mgr) return;
    const model = (mgr as any)._models[0] as LAppModel;
    if (model) {
      model.playMotionById(name, priority);
    }
  },

  /**
   * 停止当前模型的所有 motion
   */
  stopAllMotions(): void {
    if (!guard()) { console.warn('[Live2DModel] stopAllMotions: 模型未就绪'); return; }
    const mgr = getLive2DManager();
    if (!mgr) { console.warn('[Live2DModel] stopAllMotions: manager 为空'); return; }
    const model = (mgr as any)._models[0] as LAppModel;
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
    const mgr = getLive2DManager();
    if (!mgr) { console.warn(`[Live2DModel] playAction: manager 为空`); return; }
    const model = (mgr as any)._models[0] as LAppModel;
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
    const mgr = getLive2DManager();
    if (!mgr) return null;
    const model = (mgr as any)._models[0] as LAppModel;
    if (!model) return null;
    const cubismModel = (model as any)._model;
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
  listParameters(): Array<{ index: number; id: string; min: number; max: number; default: number; current: number }> {
    const mgr = getLive2DManager();
    if (!mgr) return [];
    const model = (mgr as any)._models[0] as LAppModel;
    if (!model) return [];
    const cubismModel = (model as any)._model;
    if (!cubismModel) return [];

    const count = cubismModel.getParameterCount();
    const result = Array.from({ length: count }, (_, i) => {
      const cid = cubismModel.getParameterId(i);
      const name = (typeof cid === 'object' ? cid.getString?.() : String(cid)) || '';
      return {
        index: i,
        id: typeof cid === 'string' ? cid : (cid._id ?? name),
        min: cubismModel.getParameterMinimumValue(i),
        max: cubismModel.getParameterMaximumValue(i),
        default: cubismModel.getParameterDefaultValue(i),
        current: cubismModel.getParameterValueByIndex(i),
      };
    });

    console.table(result);
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
  }
};

// ===== 动作注册表 =====
const _actionRegistry = new Map<string, (...args: any[]) => void>();

// ===== 参数动画注册表 =====
const _animActions = new Map<string, Array<{ paramId: string; value: number; delay?: number }>>();
