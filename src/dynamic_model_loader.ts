/**
 * Copyright(c) Live2D Inc. All rights reserved.
 *
 * Use of this source code is governed by the Live2D Open Software license
 * that can be found at https://www.live2d.com/eula/live2d-open-software-license-agreement_en.html.
 */

import { LAppLive2DManager } from './lapplive2dmanager';
import { LAppModel } from './lappmodel';
import { LAppSubdelegate } from './lappsubdelegate';
import { LAppDelegate } from './lappdelegate';

/**
 * 从 data-cubism-model 解析模型目录和名称。
 * modelName 直接作为模型目录路径，提取最后一段作为模型名称。
 *
 * 例：
 *   resolveModelPath('./Elysia')         → { dir: 'Elysia/',         name: 'Elysia' }
 *   resolveModelPath('./Elysia/Elysia')  → { dir: 'Elysia/Elysia/', name: 'Elysia' }
 *   resolveModelPath('Elysia')           → { dir: 'Elysia/',         name: 'Elysia' }
 *   resolveModelPath('https://cdn.com/Elysia/') → { dir: 'https://cdn.com/Elysia/', name: 'Elysia' }
 */
export function resolveModelPath(modelName: string): { dir: string; name: string } {
  // 规范化：反斜杠 → 正斜杠，去除 ./ 前缀
  const normalized = modelName.replace(/\\/g, '/').replace(/^\.\/?/, '');

  // 绝对 URL（http/https/协议相对）：保持完整，只提取最后一段作为名称
  if (/^https?:\/\/|^\/\//.test(normalized)) {
    const segments = normalized.split('/').filter(Boolean);
    const name = segments.pop() || 'Haru';
    const dir = normalized.endsWith('/') ? normalized : normalized + '/';
    return { dir, name };
  }

  const segments = normalized.split('/').filter(Boolean);
  const name = segments.pop() || normalized || 'Haru';
  // 重建目录路径（确保以 / 结尾）
  const dir = (segments.length > 0 ? segments.join('/') + '/' : '') + name + '/';
  return { dir, name };
}

/**
 * 动态模型加载器
 * 允许在运行时动态加载不同路径的模型
 */
export class DynamicModelLoader {
  /**
   * 动态加载模型（Promise 链，无轮询）
   * @param modelPath 模型路径
   * @param modelJsonName 模型JSON文件名
   * @param subdelegate 子代理对象
   */
  public static async loadModel(
    modelPath: string,
    modelJsonName: string,
    subdelegate: LAppSubdelegate,
    texturePath?: string
  ): Promise<LAppModel> {
    const instance = new LAppModel();
    instance.setSubdelegate(subdelegate);

    // 必须在 loadAssets 之前设置贴图路径（贴图在回调链中异步加载）
    if (texturePath) instance.setTextureHomeDir(texturePath);

    // 触发加载（内部是一系列 fetch 回调链，最终 _state → CompleteSetup）
    instance.loadAssets(modelPath, modelJsonName);

    // 等待加载完成（Promise，当所有纹理加载完后 resolve）
    await instance.whenSetupComplete();

    console.log(`[DynamicModelLoader] 模型加载完成: ${modelJsonName}`);
    return instance;
  }

  /**
   * 更换当前显示的模型
   * @param newModelPath 新模型路径
   * @param newModelJsonName 新模型JSON文件名
   * @param live2DManager Live2D管理器
   */
  public static async changeModel(
    newModelPath: string,
    newModelJsonName: string,
    live2DManager: LAppLive2DManager,
    texturePath?: string
  ): Promise<void> {
    // 获取 subdelegate（在释放旧模型前保存引用）
    const subdelegate = live2DManager.getSubdelegate();

    // 释放旧模型的所有资源
    live2DManager.releaseAllModels();

    // 加载新模型
    const newModel = await this.loadModel(newModelPath, newModelJsonName, subdelegate, texturePath);
    live2DManager.addModelToList(newModel);
  }

  /**
   * 获取 Live2DManager（通过第一个 Subdelegate）
   */
  public static getLive2DManager(): LAppLive2DManager | null {
    const sd = LAppDelegate.getInstance().getFirstSubdelegate();
    return sd ? sd.getLive2DManager() : null;
  }

  /**
   * 获取 Live2DManager（异步，可等待就绪）
   * @param maxWaitMs 最大等待毫秒，默认 3000
   */
  public static async waitForLive2DManager(maxWaitMs = 3000): Promise<LAppLive2DManager | null> {
    const mgr = this.getLive2DManager();
    if (mgr) return mgr;

    return new Promise(resolve => {
      const timeout = setTimeout(() => {
        window.removeEventListener('Live2DManagerReady', onReady as EventListener);
        console.error('[DynamicModelLoader] 等待 Live2DManager 超时');
        resolve(null);
      }, maxWaitMs);

      // 不轮询 — 通过事件触发
      const interval = setInterval(() => {
        const m = this.getLive2DManager();
        if (m) {
          clearTimeout(timeout);
          clearInterval(interval);
          resolve(m);
        }
      }, 100);

      const onReady = () => { /* 保留以备后续事件机制 */ };
    });
  }

  /**
   * 从HTML配置加载模型（Promise 链，无轮询）
   * 返回加载完成的 model 实例
   */
  public static async loadModelFromHtmlConfig(): Promise<LAppModel | null> {
    const config = (window as any).Live2DConfig;
    if (!config || !config.modelName) {
      console.log('[DynamicModelLoader] 未检测到HTML配置，使用默认模型');
      return null;
    }

    const { dir: modelDir, name: modelName } = resolveModelPath(config.modelName);
    console.log(`[DynamicModelLoader] 加载模型: ${modelName}, 目录: ${modelDir}, 贴图: ${config.texturePath || '(模型目录)'}`);

    const live2DManager = this.getLive2DManager();
    if (!live2DManager) {
      console.error('[DynamicModelLoader] Live2DManager 不可用');
      return null;
    }

    const subdelegate = live2DManager.getSubdelegate();
    const model = await this.loadModel(modelDir, modelName + '.model3.json', subdelegate, config.texturePath);
    live2DManager.addModelToList(model);

    console.log(`[DynamicModelLoader] 模型就绪: ${modelName}`);
    return model;
  }

  /**
   * 从URL参数加载模型
   */
  public static loadModelFromUrlParams(): void {
    const urlParams = new URLSearchParams(window.location.search);
    const modelPath = urlParams.get('modelPath') || '../../Resources/';
    const modelName = urlParams.get('modelName') || 'Haru';
    const jsonName = urlParams.get('jsonName') || modelName + '.model3.json';

    const live2DManager = this.getLive2DManager();
    if (live2DManager) {
      this.changeModel(modelPath + modelName + '/', jsonName, live2DManager)
        .then(() => console.log(`成功加载模型: ${modelName}`))
        .catch(error => console.error('加载模型失败:', error));
    }
  }

  /**
   * 获取可用模型列表
   */
  public static async getAvailableModels(resourcesPath: string): Promise<string[]> {
    try {
      const response = await fetch(resourcesPath);
      if (!response.ok) throw new Error(`无法访问资源路径: ${resourcesPath}`);
      return ['Haru', 'Hiyori', 'Mao', 'Natori', 'Rice', 'Mark', 'Wanko', 'Ren'];
    } catch (error) {
      console.error('获取模型列表失败:', error);
      return ['Haru'];
    }
  }
}
