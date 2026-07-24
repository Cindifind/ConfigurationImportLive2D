/**
 * Copyright(c) Live2D Inc. All rights reserved.
 *
 * Use of this source code is governed by the Live2D Open Software license
 * that can be found at https://www.live2d.com/eula/live2d-open-software-license-agreement_en.html.
 */

import { CubismFramework, Option } from '@framework/live2dcubismframework';
import * as LAppDefine from './lappdefine';
import { LAppPal } from './lapppal';
import { LAppSubdelegate } from './lappsubdelegate';
import { CubismLogError } from '@framework/utils/cubismdebug';

export let s_instance: LAppDelegate = null;

/**
 * アプリケーションクラス。
 * Cubism SDKの管理を行う。
 */
export class LAppDelegate {
  /**
   * クラスのインスタンス（シングルトン）を返す。
   * インスタンスが生成されていない場合は内部でインスタンスを生成する。
   *
   * @return クラスのインスタンス
   */
  public static getInstance(): LAppDelegate {
    if (s_instance == null) {
      s_instance = new LAppDelegate();
    }

    return s_instance;
  }

  /**
   * クラスのインスタンス（シングルトン）を解放する。
   */
  public static releaseInstance(): void {
    if (s_instance != null) {
      try { s_instance.release(); } catch (e) { /* 页面卸载时忽略释放错误 */ }
    }
    s_instance = null;
  }

  /**
   * ポインタがアクティブになるときに呼ばれる。
   */
  private onPointerBegan(e: PointerEvent): void {
    for (let i = 0; i < this._subdelegates.length; i++) {
      this._subdelegates[i].onPointBegan(e.pageX, e.pageY);
    }
  }

  /**
   * ポインタが動いたら呼ばれる（按下拖拽用）。
   */
  private onPointerMoved(e: PointerEvent): void {
    for (let i = 0; i < this._subdelegates.length; i++) {
      this._subdelegates[i].onPointMoved(e.pageX, e.pageY);
    }
  }

  /**
   * 鼠标悬停时调用（无需按下），驱动头部跟随鼠标。
   * 使用 clientX/clientY（视口坐标），配合 getBoundingClientRect。
   */
  private onPointerHover(e: PointerEvent): void {
    for (let i = 0; i < this._subdelegates.length; i++) {
      this._subdelegates[i].onPointHover(e.clientX, e.clientY);
    }
  }

  /**
   * ポインタがアクティブでなくなったときに呼ばれる。
   */
  private onPointerEnded(e: PointerEvent): void {
    for (let i = 0; i < this._subdelegates.length; i++) {
      this._subdelegates[i].onPointEnded(e.pageX, e.pageY);
    }
  }

  /**
   * ポインタがキャンセルされると呼ばれる。
   */
  private onPointerCancel(e: PointerEvent): void {
    for (let i = 0; i < this._subdelegates.length; i++) {
      this._subdelegates[i].onTouchCancel(e.pageX, e.pageY);
    }
  }

  /**
   * Resize canvas and re-initialize view.
   */
  public onResize(): void {
    for (let i = 0; i < this._subdelegates.length; i++) {
      this._subdelegates[i].onResize();
    }
  }

  /**
   * 実行処理。
   */
  public run(): void {
    // メインループ
    const loop = (): void => {
      // インスタンスの有無の確認
      if (s_instance == null) {
        return;
      }

      // 時間更新
      LAppPal.updateTime();

      for (let i = 0; i < this._subdelegates.length; i++) {
        this._subdelegates[i].update();
      }

      // ループのために再帰呼び出し
      requestAnimationFrame(loop);
    };
    loop();
  }

  /**
   * 解放する。
   */
  private release(): void {
    this.releaseEventListener();
    this.releaseSubdelegates();

    // Cubism SDKの解放
    CubismFramework.dispose();

    this._cubismOption = null;
  }

  /**
   * イベントリスナーを解除する。
   */
  private releaseEventListener(): void {
    if (this.pointBeganEventListener) { document.removeEventListener('pointerdown', this.pointBeganEventListener); this.pointBeganEventListener = null; }
    if (this.pointMovedEventListener) { document.removeEventListener('pointermove', this.pointMovedEventListener); this.pointMovedEventListener = null; }
    if (this.pointHoverEventListener) { document.removeEventListener('pointermove', this.pointHoverEventListener); this.pointHoverEventListener = null; }
    if (this.pointEndedEventListener) { document.removeEventListener('pointerup', this.pointEndedEventListener); this.pointEndedEventListener = null; }
    if (this.pointCancelEventListener) { document.removeEventListener('pointercancel', this.pointCancelEventListener); this.pointCancelEventListener = null; }
  }

  /**
   * Subdelegate を解放する
   */
  private releaseSubdelegates(): void {
    if (this._subdelegates) {
      for (let i = 0; i < this._subdelegates.length; i++) {
        if (this._subdelegates[i]) this._subdelegates[i].release();
      }
      this._subdelegates.length = 0;
      this._subdelegates = null;
    }
  }

  /**
   * APPに必要な物を初期化する。
   * @param targetContainer 画布挂载目标容器（默认 document.body）
   */
  public initialize(targetContainer?: HTMLElement): boolean {
    // Cubism SDKの初期化
    this.initializeCubism();

    this.initializeSubdelegates(targetContainer);
    this.initializeEventListener();

    return true;
  }

  /**
   * イベントリスナーを設定する。
   */
  private initializeEventListener(): void {
    this.pointBeganEventListener = this.onPointerBegan.bind(this);
    this.pointMovedEventListener = this.onPointerMoved.bind(this);
    this.pointEndedEventListener = this.onPointerEnded.bind(this);
    this.pointCancelEventListener = this.onPointerCancel.bind(this);
    this.pointHoverEventListener = this.onPointerHover.bind(this);

    // ポインタ関連コールバック関数登録
    document.addEventListener('pointerdown', this.pointBeganEventListener, {
      passive: true
    });
    document.addEventListener('pointermove', this.pointMovedEventListener, {
      passive: true
    });
    // 头部跟随鼠标（悬停，无需按下）
    document.addEventListener('pointermove', this.pointHoverEventListener, {
      passive: true
    });
    document.addEventListener('pointerup', this.pointEndedEventListener, {
      passive: true
    });
    document.addEventListener('pointercancel', this.pointCancelEventListener, {
      passive: true
    });
  }

  /**
   * Cubism SDKの初期化
   */
  private initializeCubism(): void {
    LAppPal.updateTime();

    // setup cubism
    this._cubismOption.logFunction = LAppPal.printMessage;
    this._cubismOption.loggingLevel = LAppDefine.CubismLoggingLevel;
    CubismFramework.startUp(this._cubismOption);

    // initialize cubism
    CubismFramework.initialize();
  }

  /**
   * Canvasを生成配置、Subdelegateを初期化する
   * @param targetContainer 画布挂载目标容器（默认 document.body）
   */
  private initializeSubdelegates(targetContainer?: HTMLElement): void {
    const container = targetContainer || document.body;

    // 确保容器有定位上下文（非 static）
    const containerStyle = window.getComputedStyle(container);
    if (containerStyle.position === 'static') {
      container.style.position = 'relative';
    }

    this._canvases.length = LAppDefine.CanvasNum;
    this._subdelegates.length = LAppDefine.CanvasNum;
    for (let i = 0; i < LAppDefine.CanvasNum; i++) {
      const canvas = document.createElement('canvas');
      this._canvases[i] = canvas;
      canvas.style.width = '100%';
      canvas.style.height = '100%';
      canvas.style.display = 'block';

      // キャンバスを DOM に追加
      container.appendChild(canvas);
    }

    for (let i = 0; i < this._canvases.length; i++) {
      const subdelegate = new LAppSubdelegate();
      subdelegate.initialize(this._canvases[i]);
      this._subdelegates[i] = subdelegate;
    }

    for (let i = 0; i < LAppDefine.CanvasNum; i++) {
      if (this._subdelegates[i].isContextLost()) {
        CubismLogError(
          `The context for Canvas at index ${i} was lost, possibly because the acquisition limit for WebGLRenderingContext was reached.`
        );
      }
    }
  }

  /**
   * Privateなコンストラクタ
   */
  private constructor() {
    this._cubismOption = new Option();
    this._subdelegates = new Array<LAppSubdelegate>();
    this._canvases = new Array<HTMLCanvasElement>();
  }

  /**
   * Cubism SDK Option
   */
  private _cubismOption: Option;

  /**
   * 操作対象のcanvas要素
   */
  private _canvases: Array<HTMLCanvasElement>;

  /**
   * Subdelegate
   */
  private _subdelegates: Array<LAppSubdelegate>;

  /**
   * 登録済みイベントリスナー 関数オブジェクト
   */
  private pointBeganEventListener: (this: Document, ev: PointerEvent) => void;

  /**
   * 登録済みイベントリスナー 関数オブジェクト
   */
  private pointMovedEventListener: (this: Document, ev: PointerEvent) => void;

  /**
   * 登録済みイベントリスナー 関数オブジェクト
   */
  private pointEndedEventListener: (this: Document, ev: PointerEvent) => void;

  /**
   * 登録済みイベントリスナー 関数オブジェクト
   */
  private pointCancelEventListener: (this: Document, ev: PointerEvent) => void;

  /**
   * 头部跟随鼠标（悬停）
   */
  private pointHoverEventListener: (this: Document, ev: PointerEvent) => void;
}
