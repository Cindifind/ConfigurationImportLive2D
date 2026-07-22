/**
 * Copyright(c) Live2D Inc. All rights reserved.
 *
 * Use of this source code is governed by the Live2D Open Software license
 * that can be found at https://www.live2d.com/eula/live2d-open-software-license-agreement_en.html.
 */

import { CubismMatrix44 } from '@framework/math/cubismmatrix44';
import { ACubismMotion } from '@framework/motion/acubismmotion';
import { CubismWebGLOffscreenManager } from '@framework/rendering/cubismoffscreenmanager';

import * as LAppDefine from './lappdefine';
import { LAppModel } from './lappmodel';
import { LAppPal } from './lapppal';
import { LAppSubdelegate } from './lappsubdelegate';

/**
 * サンプルアプリケーションにおいてCubismModelを管理するクラス
 * モデル生成と破棄、タップイベントの処理、モデル切り替えを行う。
 */
export class LAppLive2DManager {
  /**
   * 現在のシーンで保持しているすべてのモデルを解放する
   */
  private releaseAllModel(): void {
    this._models.length = 0;
  }

  public setOffscreenSize(width: number, height: number): void {
    for (let i = 0; i < this._models.length; i++) {
      const model: LAppModel = this._models[i];
      model?.setRenderTargetSize(width, height);
    }
  }

  /**
   * 画面をドラッグした時の処理
   *
   * @param x 画面のX座標
   * @param y 画面のY座標
   */
  public onDrag(x: number, y: number): void {
    const model: LAppModel = this._models[0];
    if (model) {
      model.setDragging(x, y);
    }
  }

  /**
   * 画面をタップした時の処理
   *
   * @param x 画面のX座標
   * @param y 画面のY座標
   */
  public onTap(x: number, y: number): void {
    if (LAppDefine.DebugLogEnable) {
      LAppPal.printMessage(
        `[APP]tap point: {x: ${x.toFixed(2)} y: ${y.toFixed(2)}}`
      );
    }

    const model: LAppModel = this._models[0];
    let handled = false;

    // 1. 检查自定义触控区域回调
    if (model && this._hitAreaCallbacks.size > 0) {
      const setting = (model as any)._modelSetting;
      if (setting) {
        const hitCount = setting.getHitAreasCount?.() || 0;
        for (let i = 0; i < hitCount; i++) {
          const name: string = setting.getHitAreaName(i);
          const cbs = this._hitAreaCallbacks.get(name);
          if (cbs && model.hitTest(name, x, y)) {
            for (const cb of cbs) {
              try { cb(name, x, y); } catch (e) { console.error(e); }
            }
            handled = true;
            break;
          }
        }
      }
    }

    // 2. 触发任意点击回调
    for (const cb of this._onAnyTapCallbacks) {
      try { cb(x, y); } catch (e) { console.error(e); }
    }

    // 3. 默认行为（仅在未被子定义回调处理时执行）
    if (!handled) {
      if (model) {
        if (model.hitTest(LAppDefine.HitAreaNameHead, x, y)) {
          if (LAppDefine.DebugLogEnable) {
            LAppPal.printMessage(`[APP]hit area: [${LAppDefine.HitAreaNameHead}]`);
          }
          model.setRandomExpression();
        } else if (model.hitTest(LAppDefine.HitAreaNameBody, x, y)) {
          if (LAppDefine.DebugLogEnable) {
            LAppPal.printMessage(`[APP]hit area: [${LAppDefine.HitAreaNameBody}]`);
          }
          model.startRandomMotion(
            LAppDefine.MotionGroupTapBody,
            LAppDefine.PriorityNormal,
            this.finishedMotion,
            this.beganMotion
          );
        }
      }
    }
  }

  /**
   * 注册自定义触控区域回调
   * @param areaName 区域名（来自模型 .cdi3.json 定义的 HitArea）
   * @param callback 命中时回调 (areaName, x, y) => void
   */
  public addHitAreaCallback(areaName: string, callback: (areaName: string, x: number, y: number) => void): void {
    if (!this._hitAreaCallbacks.has(areaName)) {
      this._hitAreaCallbacks.set(areaName, []);
    }
    this._hitAreaCallbacks.get(areaName)!.push(callback);
  }

  /**
   * 移除自定义触控区域回调
   */
  public removeHitAreaCallback(areaName: string, callback: (areaName: string, x: number, y: number) => void): void {
    const cbs = this._hitAreaCallbacks.get(areaName);
    if (cbs) {
      const idx = cbs.indexOf(callback);
      if (idx >= 0) cbs.splice(idx, 1);
    }
  }

  /**
   * 注册任意点击回调（不区分区域）
   */
  public onAnyTap(callback: (x: number, y: number) => void): void {
    this._onAnyTapCallbacks.push(callback);
  }

  /**
   * 画面を更新するときの処理
   * モデルの更新処理及び描画処理を行う
   */
  public onUpdate(): void {
    // 全てのモデルの描画処理開始前に、フレームごとのリセットフラグをクリアする
    const gl = this._subdelegate.getGl();
    CubismWebGLOffscreenManager.getInstance().beginFrameProcess(gl);

    const { width, height } = this._subdelegate.getCanvas();

    const projection: CubismMatrix44 = new CubismMatrix44();
    const model: LAppModel = this._models[0];

    if (model.getModel()) {
      if (model.getModel().getCanvasWidth() > 1.0 && width < height) {
        // 横に長いモデルを縦長ウィンドウに表示する際モデルの横サイズでscaleを算出する
        model.getModelMatrix().setWidth(2.0);
        projection.scale(1.0, width / height);
      } else {
        projection.scale(height / width, 1.0);
      }

      // 必要があればここで乗算
      if (this._viewMatrix != null) {
        projection.multiplyByMatrix(this._viewMatrix);
      }
    }

    model.update();
    model.draw(projection); // 参照渡しなのでprojectionは変質する。

    // モデルで使用するオフスクリーン管理の終了処理
    CubismWebGLOffscreenManager.getInstance().endFrameProcess(gl);
    // もし余っているオフスクリーンのリソースを解放したい場合行う処理
    CubismWebGLOffscreenManager.getInstance().releaseStaleRenderTextures(gl);
  }

  /**
   * 次のシーンに切りかえる
   * サンプルアプリケーションではモデルセットの切り替えを行う。
   */
  public nextScene(): void {
    const no: number = (this._sceneIndex + 1) % LAppDefine.ModelDirSize;
    this.changeScene(no);
  }

  /**
   * シーンを切り替える
   * サンプルアプリケーションではモデルセットの切り替えを行う。
   * @param index
   */
  private changeScene(index: number): void {
    this._sceneIndex = index;

    if (LAppDefine.DebugLogEnable) {
      LAppPal.printMessage(`[APP]model index: ${this._sceneIndex}`);
    }

    // ModelDir[]に保持したディレクトリ名から
    // model3.jsonのパスを決定する。
    // ディレクトリ名とmodel3.jsonの名前を一致させておくこと。
    const model: string = LAppDefine.ModelDir[index];
    const modelPath: string = LAppDefine.ResourcesPath + model + '/';
    let modelJsonName: string = LAppDefine.ModelDir[index];
    modelJsonName += '.model3.json';

    this.releaseAllModel();
    const instance = new LAppModel();
    instance.setSubdelegate(this._subdelegate);
    instance.loadAssets(modelPath, modelJsonName);
    this._models.push(instance);
  }

  public setViewMatrix(m: CubismMatrix44) {
    for (let i = 0; i < 16; i++) {
      this._viewMatrix.getArray()[i] = m.getArray()[i];
    }
  }

  /**
   * モデルの追加
   */
  public addModel(sceneIndex: number = 0): void {
    this._sceneIndex = sceneIndex;
    this.changeScene(this._sceneIndex);
  }

  /**
   * コンストラクタ
   */
  public constructor() {
    this._subdelegate = null;
    this._viewMatrix = new CubismMatrix44();
    this._models = new Array<LAppModel>();
    this._sceneIndex = 0;
  }

  /**
   * 解放する。
   */
  public release(): void {}

  /**
   * 初期化する。
   * @param subdelegate
   */
  public initialize(subdelegate: LAppSubdelegate): void {
    this._subdelegate = subdelegate;
    // 如果已通过 HTML data-* 属性配置了模型，跳过默认模型加载（避免404）
    const config = (typeof window !== 'undefined') ? (window as any).Live2DConfig : null;
    if (config?.modelPath && config?.modelName) {
      return;
    }
    this.changeScene(this._sceneIndex);
  }

  /**
   * 自身が所属するSubdelegate
   */
  private _subdelegate: LAppSubdelegate;

  _viewMatrix: CubismMatrix44; // モデル描画に用いるview行列
  _models: Array<LAppModel>; // モデルインスタンスのコンテナ
  private _sceneIndex: number; // 表示するシーンのインデックス値
  private _hitAreaCallbacks: Map<string, Array<(areaName: string, x: number, y: number) => void>> = new Map();
  private _onAnyTapCallbacks: Array<(x: number, y: number) => void> = [];

  // モーション再生開始のコールバック関数
  beganMotion = (self: ACubismMotion): void => {
    LAppPal.printMessage('Motion Began:');
    console.log(self);
  };
  // モーション再生終了のコールバック関数
  finishedMotion = (self: ACubismMotion): void => {
    LAppPal.printMessage('Motion Finished:');
    console.log(self);
  };
}
