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
   * 动态加载模型
   * @param modelPath 模型路径
   * @param modelJsonName 模型JSON文件名
   * @param subdelegate 子代理对象
   */
  public static async loadModel(
    modelPath: string, 
    modelJsonName: string, 
    subdelegate: LAppSubdelegate
  ): Promise<LAppModel> {
    return new Promise((resolve, reject) => {
      const instance = new LAppModel();
      instance.setSubdelegate(subdelegate);
      
      // 重写加载完成的回调以返回实例
      const originalLoadAssets = instance.loadAssets.bind(instance);
      
      // 临时替换instance的某些方法以捕获加载完成事件
      const originalOnLoadComplete = (instance as any)._onLoadComplete;
      
      // 监听加载状态
      const checkLoadStatus = () => {
        // 这里需要根据实际的加载状态判断逻辑来确定何时认为加载完成
        // 由于LAppModel内部状态复杂，这里简化处理
        setTimeout(() => {
          if ((instance as any)._initialized) {
            resolve(instance);
          } else {
            checkLoadStatus();
          }
        }, 100);
      };
      
      // 开始加载
      instance.loadAssets(modelPath, modelJsonName);
      
      // 启动检查循环
      checkLoadStatus();
    });
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
    // 释放当前模型
    (live2DManager as any)._models.forEach((model: LAppModel) => {
      if (model) {
        // 在实际应用中，应该调用模型的释放方法
        // model.release(); // 如果有release方法的话
      }
    });
    
    // 清空模型数组
    (live2DManager as any)._models = [];
    
    // 获取当前subdelegate以传递给新模型
    const subdelegate: LAppSubdelegate = (live2DManager as any)._subdelegate;
    
    // 加载新模型
    const newModel = await this.loadModel(newModelPath, newModelJsonName, subdelegate);
    
    // 添加新模型到管理器
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
    console.warn('[DynamicModelLoader] 无法获取 Live2DManager：_subdelegates 未就绪');
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
   * 从URL参数加载模型
   */
  public static loadModelFromUrlParams(): void {
    const urlParams = new URLSearchParams(window.location.search);
    const modelPath = urlParams.get('modelPath') || '../../Resources/';
    const modelName = urlParams.get('modelName') || 'Haru';
    const jsonName = urlParams.get('jsonName') || modelName + '.model3.json';
    
    const live2DManager = this.getLive2DManager();
    if (live2DManager) {
      this.changeModel(
        modelPath + modelName + '/',
        jsonName,
        live2DManager
      ).then(() => {
        console.log(`成功加载模型: ${modelName}`);
      }).catch(error => {
        console.error('加载模型失败:', error);
      });
    }
  }

  /**
   * 构建模型目录完整路径
   * 自动处理 modelPath 已包含模型名的情况，避免重复拼接
   */
  private static buildFullModelPath(modelPath: string, modelName: string): string {
    // 确保 modelPath 以 / 结尾
    const normalizedPath = modelPath.endsWith('/') ? modelPath : modelPath + '/';
    // 如果路径已经以 "模型名/" 结尾，不再重复拼接
    if (normalizedPath.endsWith('/' + modelName + '/') || normalizedPath.endsWith('/' + modelName)) {
      return normalizedPath.endsWith('/') ? normalizedPath : normalizedPath + '/';
    }
    return normalizedPath + modelName + '/';
  }

  /**
   * 从HTML配置加载模型
   */
  public static loadModelFromHtmlConfig(): void {
    // 检查全局配置
    const config = (window as any).Live2DConfig;
    if (config && config.modelPath && config.modelName) {
      const modelPath = config.modelPath;
      const modelName = config.modelName;
      
      const fullPath = this.buildFullModelPath(modelPath, modelName);
      console.log(`[DynamicModelLoader] 尝试从HTML配置加载模型: ${modelName}, 完整路径: ${fullPath}`);
      
      const live2DManager = this.getLive2DManager();
      if (live2DManager) {
        this.changeModel(
          fullPath,
          modelName + '.model3.json',
          live2DManager
        ).then(() => {
          console.log(`[DynamicModelLoader] 成功从HTML配置加载模型: ${modelName}`);
        }).catch(error => {
          console.error('[DynamicModelLoader] 从HTML配置加载模型失败:', error);
        });
      }
    } else {
      console.log('[DynamicModelLoader] 未检测到HTML配置，使用默认模型');
    }
  }

  /**
   * 获取可用模型列表
   * @param resourcesPath 资源路径
   */
  public static async getAvailableModels(resourcesPath: string): Promise<string[]> {
    try {
      const response = await fetch(resourcesPath);
      if (!response.ok) {
        throw new Error(`无法访问资源路径: ${resourcesPath}`);
      }
      
      // 注意：由于CORS限制，这种方法通常不适用于获取目录列表
      // 实际应用中需要服务端API来提供可用模型列表
      
      // 这里仅作为示例返回硬编码的模型列表
      return ['Haru', 'Hiyori', 'Mao', 'Natori', 'Rice', 'Mark', 'Wanko', 'Ren'];
    } catch (error) {
      console.error('获取模型列表失败:', error);
      return ['Haru']; // 返回默认模型
    }
  }
}