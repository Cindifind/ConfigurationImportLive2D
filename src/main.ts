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
import { LAppModel } from './lappmodel';
import { LAppView } from './lappview';
import { getTalkManager, TalkStartCallback, TalkEndCallback, TalkActionCallback, ModelBehaviorInfo } from './live2dtalkmanager';

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
    const config = (window as any).Live2DConfig;
    const manager = getLive2DManager();
    if (!manager) {
      console.warn('[Live2DModel] 管理器未就绪，请等待初始化完成后调用');
      return;
    }
    const modelPath = config?.modelPath || LAppDefine.ResourcesPath;
    const fullPath = buildFullModelPath(modelPath, name);
    DynamicModelLoader.changeModel(fullPath, name + '.model3.json', manager)
      .then(() => console.log(`[Live2DModel] 已切换到模型: ${name}`))
      .catch((e: any) => console.error('[Live2DModel] 切换模型失败:', e));
  },

  /**
   * 运行时切换背景显示（无需刷新页面）
   * @param show true=显示, false=隐藏
   */
  showBackground(show: boolean): void {
    const config = (window as any).Live2DConfig;
    if (config) config.showBackground = show;
    // 背景图已在初始化时加载，此开关影响 render() 中的绘制判断
    console.log(`[Live2DModel] 背景显示: ${show}`);
  },

  /**
   * 设置配置项（需刷新页面生效）
   * @param key 配置键: 'modelPath' | 'modelName' | 'showBackground' | 'backgroundImage' | 'shaderPath'
   * @param value 配置值
   */
  setConfig(key: string, value: string | boolean): void {
    const config = (window as any).Live2DConfig || {};
    (config as any)[key] = value;
    (window as any).Live2DConfig = config;
    // 同步更新 DOM 属性
    const container = document.getElementById('live2d-container') || document.querySelector('[data-cubism-model]');
    if (container) {
      const attrName = 'data-' + key.replace(/([A-Z])/g, '-$1').toLowerCase();
      container.setAttribute(attrName, String(value));
    }
    console.log(`[Live2DModel] 配置已更新: ${key} = ${value}（刷新页面后生效）`);
  },

  /**
   * 刷新页面（应用配置更改）
   */
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
   * @param cb 回调函数
   */
  onReady(cb: () => void): void {
    const check = () => {
      const manager = getLive2DManager();
      if (manager && (manager as any)._models && (manager as any)._models.length > 0) {
        const model = (manager as any)._models[0] as LAppModel;
        if (model && (model as any)._state === 78) { // LoadStep.CompleteSetup = 78
          cb();
          return;
        }
      }
      setTimeout(check, 200);
    };
    setTimeout(check, 200);
  },

  // ===== 说话 / 气泡钩子 =====

  /**
   * 播放音频并驱动口型（对口型）
   * @param audioUrl WAV 音频文件 URL
   * @param text     说话文本（显示在气泡中）
   */
  startTalk(audioUrl: string, text?: string): void {
    getTalkManager().startTalk(audioUrl, text);
  },

  /**
   * 停止当前说话
   */
  stopTalk(): void {
    getTalkManager().stopTalk();
  },

  /**
   * 开启自动说话（随机间隔触发）
   * @param minIntervalMs 最小间隔（毫秒），默认 8000
   * @param maxIntervalMs 最大间隔（毫秒），默认 20000
   */
  startAutoTalk(minIntervalMs?: number, maxIntervalMs?: number): void {
    getTalkManager().startAutoTalk(minIntervalMs, maxIntervalMs);
  },

  /**
   * 停止自动说话
   */
  stopAutoTalk(): void {
    getTalkManager().stopAutoTalk();
  },

  /**
   * 设置自动说话的文本库
   * @param texts 文本数组
   */
  setTalkTexts(texts: string[]): void {
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
    getTalkManager().setTalkAction(action);
  },

  /**
   * 指定自动说话时使用的 motion 组名（简单配置方式）
   * @param groupName motion 组名，如 'Talk', 'Speak'，传空字符串恢复自动检测
   *
   * 用法：
   *   Live2DModel.setTalkMotionGroup('Talk');
   */
  setTalkMotionGroup(groupName: string): void {
    getTalkManager().setTalkMotionGroup(groupName);
  },

  // ===== 缩放控制 =====

  /**
   * 获取 LAppView 实例（内部使用）
   */
  _getView(): LAppView | null {
    const sd = getSubdelegate();
    return sd ? sd.getView() : null;
  },

  /**
   * 设置用户缩放比例（等比例，仅缩小，范围 0.3 ~ 1.0）
   * @param scale 缩放值，自动钳位
   */
  setScale(scale: number): void {
    const view = this._getView();
    if (view) view.setUserScale(scale);
  },

  /**
   * 获取当前缩放比例
   * @returns 0.3 ~ 1.0
   */
  getScale(): number {
    const view = this._getView();
    return view ? view.getUserScale() : 1.0;
  },

  /**
   * 滚轮缩放（等比例，仅缩小）
   * @param delta 滚轮 deltaY 值
   */
  zoomByWheel(delta: number): void {
    const view = this._getView();
    if (view) view.zoomByWheel(delta);
  },

  /**
   * 开始拖拽缩放
   * @param x 起始指针 X
   * @param y 起始指针 Y
   * @param cw 容器宽
   * @param ch 容器高
   */
  beginResizeDrag(x: number, y: number, cw: number, ch: number): void {
    const view = this._getView();
    if (view) view.beginResizeDrag(x, y, cw, ch);
  },

  /**
   * 拖拽缩放更新
   */
  updateResizeDrag(x: number, y: number, cw: number, ch: number): void {
    const view = this._getView();
    if (view) view.updateResizeDrag(x, y, cw, ch);
  },

  /**
   * 结束拖拽缩放
   */
  endResizeDrag(): void {
    const view = this._getView();
    if (view) view.endResizeDrag();
  },

  // ===== 模型拖拽平移 =====

  /**
   * 开始拖拽平移模型
   * @param x 指针起始 X（页面坐标）
   * @param y 指针起始 Y（页面坐标）
   */
  beginModelPan(x: number, y: number): void {
    const view = this._getView();
    if (view) {
      const canvas = (view as any)._subdelegate?.getCanvas();
      if (canvas) {
        const rect = canvas.getBoundingClientRect();
        const conv = (view as any)._getPixelToLogical?.() || { x: 0.002, y: 0.002 };
        const logX = (x - rect.left) * conv.x - 1;
        const logY = (rect.bottom - y) * conv.y - 1;
        view.beginModelPan(logX, logY);
      }
    }
  },

  /**
   * 更新拖拽平移（参数为像素位移）
   * @param pixelDX 指针 X 方向位移 px
   * @param pixelDY 指针 Y 方向位移 px
   */
  updateModelPan(pixelDX: number, pixelDY: number): void {
    const view = this._getView();
    if (view) view.updateModelPanByPixel(pixelDX, pixelDY);
  },

  /**
   * 结束拖拽平移
   */
  endModelPan(): void {
    const view = this._getView();
    if (view) view.endModelPan();
  },

  /**
   * 重置模型位置到原点
   */
  resetModelPan(): void {
    const view = this._getView();
    if (view) view.resetModelPan();
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
  }
};

// ===== 动作注册表 =====
const _actionRegistry = new Map<string, (...args: any[]) => void>();
