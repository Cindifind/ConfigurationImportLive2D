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
import { getTalkManager, TalkStartCallback, TalkEndCallback } from './live2dtalkmanager';

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
  const container = document.getElementById('live2d-container') || document.querySelector('[data-cubism-model]');
  
  // 默认使用 lappdefine 中的 ResourcesPath（支持跨域CDN配置）
  let modelPath = LAppDefine.ResourcesPath;
  let modelName = 'Haru';
  
  // 优先级：HTML data属性 > URL参数 > 默认值
  let showBackground = true; // 默认显示背景图
  let backgroundImage = '';  // 自定义背景图路径（空字符串 = 使用默认）
  let shaderPath = '';       // 自定义着色器路径（空字符串 = 使用默认）
  if (container) {
    const htmlModelPath = container.getAttribute('data-model-path');
    const htmlModelName = container.getAttribute('data-cubism-model');
    const htmlShowBg = container.getAttribute('data-show-background');
    const htmlBgImage = container.getAttribute('data-background-image');
    const htmlShaderPath = container.getAttribute('data-shader-path');
    
    if (htmlModelPath) modelPath = htmlModelPath;
    if (htmlModelName) modelName = htmlModelName;
    if (htmlShowBg !== null) showBackground = htmlShowBg === 'true';
    if (htmlBgImage !== null) backgroundImage = htmlBgImage;
    if (htmlShaderPath !== null) shaderPath = htmlShaderPath;
    console.log(`[Live2D] HTML配置: modelPath=${modelPath}, modelName=${modelName}, showBackground=${showBackground}, bgImage=${backgroundImage || '默认'}, shaderPath=${shaderPath || '默认'}`);
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
  if (!LAppDelegate.getInstance().initialize()) {
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
  }
};
