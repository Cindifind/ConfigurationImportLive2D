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
    subdelegate: LAppSubdelegate
  ): Promise<LAppModel> {
    const instance = new LAppModel();
    instance.setSubdelegate(subdelegate);

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
    live2DManager: LAppLive2DManager
  ): Promise<void> {
    (live2DManager as any)._models.forEach((model: LAppModel) => {
      if (model) { /* model.release(); */ }
    });
    (live2DManager as any)._models = [];

    const subdelegate: LAppSubdelegate = (live2DManager as any)._subdelegate;
    const newModel = await this.loadModel(newModelPath, newModelJsonName, subdelegate);
    (live2DManager as any)._models.push(newModel);
  }

  /**
   * 获取 Live2DManager（通过第一个 Subdelegate）
   */
  public static getLive2DManager(): LAppLive2DManager | null {
    const appDelegate = LAppDelegate.getInstance() as any;
    if (appDelegate && appDelegate._subdelegates && appDelegate._subdelegates.length > 0) {
      return appDelegate._subdelegates[0].getLive2DManager();
    }
    return null;
  }

  /**
   * 获取 Live2DManager（异步，可等待就绪）
   * @param maxWaitMs 最大等待毫秒，默认 3000
   */
  public static async waitForLive2DManager(maxWaitMs = 3000): Promise<LAppLive2DManager | null> {
    const startTime = Date.now();
    while (Date.now() - startTime < maxWaitMs) {
      const mgr = this.getLive2DManager();
      if (mgr) return mgr;
      await new Promise(r => setTimeout(r, 100));
    }
    console.error('[DynamicModelLoader] 等待 Live2DManager 超时');
    return null;
  }

  /**
   * 构建模型目录完整路径
   */
  private static buildFullModelPath(modelPath: string, modelName: string): string {
    const normalizedPath = modelPath.endsWith('/') ? modelPath : modelPath + '/';
    if (normalizedPath.endsWith('/' + modelName + '/') || normalizedPath.endsWith('/' + modelName)) {
      return normalizedPath.endsWith('/') ? normalizedPath : normalizedPath + '/';
    }
    return normalizedPath + modelName + '/';
  }

  /**
   * 从HTML配置加载模型（Promise 链，无轮询）
   * 返回加载完成的 model 实例
   */
  public static async loadModelFromHtmlConfig(): Promise<LAppModel | null> {
    const config = (window as any).Live2DConfig;
    if (!config || !config.modelPath || !config.modelName) {
      console.log('[DynamicModelLoader] 未检测到HTML配置，使用默认模型');
      return null;
    }

    const modelPath = config.modelPath;
    const modelName = config.modelName;
    const fullPath = this.buildFullModelPath(modelPath, modelName);
    console.log(`[DynamicModelLoader] 加载模型: ${modelName}, 路径: ${fullPath}`);

    const live2DManager = this.getLive2DManager();
    if (!live2DManager) {
      console.error('[DynamicModelLoader] Live2DManager 不可用');
      return null;
    }

    const subdelegate: LAppSubdelegate = (live2DManager as any)._subdelegate;
    const model = await this.loadModel(fullPath, modelName + '.model3.json', subdelegate);
    (live2DManager as any)._models.push(model);

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
