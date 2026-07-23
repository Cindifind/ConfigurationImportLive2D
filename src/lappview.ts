/**
 * Copyright(c) Live2D Inc. All rights reserved.
 *
 * Use of this source code is governed by the Live2D Open Software license
 * that can be found at https://www.live2d.com/eula/live2d-open-software-license-agreement_en.html.
 */

import { CubismMatrix44 } from '@framework/math/cubismmatrix44';
import { CubismViewMatrix } from '@framework/math/cubismviewmatrix';

import * as LAppDefine from './lappdefine';
import { LAppDelegate } from './lappdelegate';
import { LAppPal } from './lapppal';
import { LAppSprite } from './lappsprite';
import { TextureInfo } from './lapptexturemanager';
import { TouchManager } from './touchmanager';
import { LAppSubdelegate } from './lappsubdelegate';

/**
 * 描画クラス。
 */
export class LAppView {
  /**
   * コンストラクタ
   */
  public constructor() {
    this._programId = null;
    this._back = null;

    // タッチ関係のイベント管理
    this._touchManager = new TouchManager();

    // デバイス座標からスクリーン座標に変換するための
    this._deviceToScreen = new CubismMatrix44();

    // 画面の表示の拡大縮小や移動の変換を行う行列
    this._viewMatrix = new CubismViewMatrix();

    // 用户缩放（等比例，最大 1.0）
    this._userScale = 1.0;
    this._baseViewMatrix = new CubismMatrix44();
    this._renderTempMatrix = new CubismMatrix44();
  }

  /**
   * 初期化する。
   */
  public initialize(subdelegate: LAppSubdelegate): void {
    this._subdelegate = subdelegate;
    const { width, height } = subdelegate.getCanvas();

    const ratio: number = width / height;
    const left: number = -ratio;
    const right: number = ratio;
    const bottom: number = LAppDefine.ViewLogicalLeft;
    const top: number = LAppDefine.ViewLogicalRight;

    this._viewMatrix.setScreenRect(left, right, bottom, top); // デバイスに対応する画面の範囲。 Xの左端、Xの右端、Yの下端、Yの上端
    this._viewMatrix.scale(LAppDefine.ViewScale, LAppDefine.ViewScale);

    this._deviceToScreen.loadIdentity();
    if (width > height) {
      const screenW: number = Math.abs(right - left);
      this._deviceToScreen.scaleRelative(screenW / width, -screenW / width);
    } else {
      const screenH: number = Math.abs(top - bottom);
      this._deviceToScreen.scaleRelative(screenH / height, -screenH / height);
    }
    this._deviceToScreen.translateRelative(-width * 0.5, -height * 0.5);

    // 表示範囲の設定
    this._viewMatrix.setMaxScale(LAppDefine.ViewMaxScale); // 限界拡張率
    this._viewMatrix.setMinScale(LAppDefine.ViewMinScale); // 限界縮小率

    // 表示できる最大範囲
    this._viewMatrix.setMaxScreenRect(
      LAppDefine.ViewLogicalMaxLeft,
      LAppDefine.ViewLogicalMaxRight,
      LAppDefine.ViewLogicalMaxBottom,
      LAppDefine.ViewLogicalMaxTop
    );

    // 保存基准矩阵（scale=1.0 时的状态，用于用户缩放）
    this.saveBaseMatrix();
  }

  /**
   * 保存当前 viewMatrix 状态作为缩放基准
   */
  public saveBaseMatrix(): void {
    const arr = this._viewMatrix.getArray();
    const base = this._baseViewMatrix.getArray();
    for (let i = 0; i < 16; i++) {
      base[i] = arr[i];
    }
  }

  /**
   * 解放する
   */
  public release(): void {
    this._viewMatrix = null;
    this._touchManager = null;
    this._deviceToScreen = null;

    this._back.release();
    this._back = null;

    this._subdelegate.getGlManager().getGl().deleteProgram(this._programId);
    this._programId = null;
  }

  /**
   * 描画する。
   */
  public render(): void {
    this._subdelegate.getGlManager().getGl().useProgram(this._programId);

    if (this._back) {
      const config = (window as any).Live2DConfig;
      if (config?.showBackground !== false) {
        this._back.render(this._programId);
      }
    }

    this._subdelegate.getGlManager().getGl().flush();

    const lapplive2dmanager = this._subdelegate.getLive2DManager();
    if (lapplive2dmanager != null) {
      // 应用用户缩放（基于基准矩阵，模型始终居中）
      if (this._userScale !== 1.0) {
        const base = this._baseViewMatrix.getArray();
        const temp = this._renderTempMatrix.getArray();
        for (let i = 0; i < 16; i++) temp[i] = base[i];
        this._renderTempMatrix.scaleRelative(this._userScale, this._userScale);
        lapplive2dmanager.setViewMatrix(this._renderTempMatrix);
      } else {
        lapplive2dmanager.setViewMatrix(this._viewMatrix);
      }

      lapplive2dmanager.onUpdate();
    }
  }

  /**
   * 画像の初期化を行う。
   */
  public initializeSprite(): void {
    const width: number = this._subdelegate.getCanvas().width;
    const height: number = this._subdelegate.getCanvas().height;
    const textureManager = this._subdelegate.getTextureManager();
    const resourcesPath = LAppDefine.ResourcesPath;

    let imageName = '';

    // 背景画像初期化
    const config = (window as any).Live2DConfig;
    if (config?.showBackground !== false) {
      // 自定义背景图 URL（支持 http/https/相对路径），未配置则使用默认
      let bgPath: string;
      if (config?.backgroundImage) {
        const bg = config.backgroundImage;
        // 完整URL直接使用，相对路径拼接 ResourcesPath
        if (bg.startsWith('http://') || bg.startsWith('https://') || bg.startsWith('//')) {
          bgPath = bg;
        } else {
          bgPath = resourcesPath + bg;
        }
      } else {
        imageName = LAppDefine.BackImageName;
        bgPath = resourcesPath + imageName;
      }

      // 非同期なのでコールバック関数を作成
      const initBackGroundTexture = (textureInfo: TextureInfo): void => {
        const x: number = width * 0.5;
        const y: number = height * 0.5;

        const fheight = height * 0.95;
        const ratio = fheight / textureInfo.height;
        const fwidth = textureInfo.width * ratio;
        this._back = new LAppSprite(x, y, fwidth, fheight, textureInfo.id);
        this._back.setSubdelegate(this._subdelegate);
      };

      textureManager.createTextureFromPngFile(
        bgPath,
        false,
        initBackGroundTexture
      );
    }

    // シェーダーを作成
    if (this._programId == null) {
      this._programId = this._subdelegate.createShader();
    }
  }

  /**
   * タッチされた時に呼ばれる。
   *
   * @param pointX スクリーンX座標
   * @param pointY スクリーンY座標
   */
  public onTouchesBegan(pointX: number, pointY: number): void {
    this._touchManager.touchesBegan(
      pointX * window.devicePixelRatio,
      pointY * window.devicePixelRatio
    );
  }

  /**
   * タッチしているときにポインタが動いたら呼ばれる。
   *
   * @param pointX スクリーンX座標
   * @param pointY スクリーンY座標
   */
  public onTouchesMoved(pointX: number, pointY: number): void {
    const posX = pointX * window.devicePixelRatio;
    const posY = pointY * window.devicePixelRatio;

    const lapplive2dmanager = this._subdelegate.getLive2DManager();

    const viewX: number = this.transformViewX(this._touchManager.getX());
    const viewY: number = this.transformViewY(this._touchManager.getY());

    this._touchManager.touchesMoved(posX, posY);

    lapplive2dmanager.onDrag(viewX, viewY);
  }

  /**
   * タッチが終了したら呼ばれる。
   *
   * @param pointX スクリーンX座標
   * @param pointY スクリーンY座標
   */
  public onTouchesEnded(pointX: number, pointY: number): void {
    const posX = pointX * window.devicePixelRatio;
    const posY = pointY * window.devicePixelRatio;

    const lapplive2dmanager = this._subdelegate.getLive2DManager();

    // タッチ終了
    lapplive2dmanager.onDrag(0.0, 0.0);

    // シングルタップ
    const x: number = this.transformViewX(posX);
    const y: number = this.transformViewY(posY);

    if (LAppDefine.DebugTouchLogEnable) {
      LAppPal.printMessage(`[APP]touchesEnded x: ${x} y: ${y}`);
    }
    lapplive2dmanager.onTap(x, y);
  }

  /**
   * X座標をView座標に変換する。
   *
   * @param deviceX デバイスX座標
   */
  public transformViewX(deviceX: number): number {
    const screenX: number = this._deviceToScreen.transformX(deviceX); // 論理座標変換した座標を取得。
    return this._viewMatrix.invertTransformX(screenX); // 拡大、縮小、移動後の値。
  }

  /**
   * Y座標をView座標に変換する。
   *
   * @param deviceY デバイスY座標
   */
  public transformViewY(deviceY: number): number {
    const screenY: number = this._deviceToScreen.transformY(deviceY); // 論理座標変換した座標を取得。
    return this._viewMatrix.invertTransformY(screenY);
  }

  /**
   * X座標をScreen座標に変換する。
   * @param deviceX デバイスX座標
   */
  public transformScreenX(deviceX: number): number {
    return this._deviceToScreen.transformX(deviceX);
  }

  /**
   * Y座標をScreen座標に変換する。
   *
   * @param deviceY デバイスY座標
   */
  public transformScreenY(deviceY: number): number {
    return this._deviceToScreen.transformY(deviceY);
  }

  _touchManager: TouchManager; // タッチマネージャー
  _deviceToScreen: CubismMatrix44; // デバイスからスクリーンへの行列
  _viewMatrix: CubismViewMatrix; // viewMatrix
  _programId: WebGLProgram; // シェーダID
  _back: LAppSprite; // 背景画像
  _changeModel: boolean; // モデル切り替えフラグ
  _isClick: boolean; // クリック中
  private _subdelegate: LAppSubdelegate;

  // 用户缩放（等比例，仅缩小，最大1.0）
  private _userScale: number;
  private _baseViewMatrix: CubismMatrix44; // 基准矩阵（scale=1.0时的快照）
  private _renderTempMatrix: CubismMatrix44; // 渲染用的临时矩阵

  /**
   * 设置用户缩放比例（等比例，仅缩小，范围 [0.3, 1.0]）
   */
  public setUserScale(scale: number): void {
    this._userScale = Math.max(0.3, Math.min(1.0, scale));
  }

  public getUserScale(): number { return this._userScale; }

  public zoomByWheel(delta: number): void {
    const step = 0.05;
    if (delta > 0) {
      this._userScale = Math.min(1.0, this._userScale + step);
    } else {
      this._userScale = Math.max(0.3, this._userScale - step);
    }
  }
}
