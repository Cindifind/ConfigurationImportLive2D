/**
 * Copyright(c) Live2D Inc. All rights reserved.
 *
 * Use of this source code is governed by the Live2D Open Software license
 * that can be found at https://www.live2d.com/eula/live2d-open-software-license-agreement_en.html.
 */

import { LAppGlManager } from './lappglmanager';

/**
 * テクスチャ管理クラス
 * 画像読み込み、管理を行うクラス。
 */
export class LAppTextureManager {
  /**
   * コンストラクタ
   */
  public constructor() {
    this._textures = new Array<TextureInfo>();
  }

  /**
   * 解放する。
   */
  public release(): void {
    for (let i = 0; i < this._textures.length; i++) {
      this._glManager.getGl().deleteTexture(this._textures[i].id);
    }
    this._textures = null;
  }

  /**
   * 画像読み込み
   *
   * @param fileName 読み込む画像ファイルパス名
   * @param usePremultiply Premult処理を有効にするか
   * @return 画像情報、読み込み失敗時はnullを返す
   */
  public createTextureFromPngFile(
    fileName: string,
    usePremultiply: boolean,
    callback: (textureInfo: TextureInfo) => void
  ): void {
    // search loaded texture already
    for (let i = 0; i < this._textures.length; i++) {
      if (
        this._textures[i].fileName == fileName &&
        this._textures[i].usePremultply == usePremultiply
      ) {
        // 2回目以降はキャッシュが使用される(待ち時間なし)
        // WebKitでは同じImageのonloadを再度呼ぶには再インスタンスが必要
        // 詳細：https://stackoverflow.com/a/5024181
        this._textures[i].img = new Image();
        this._textures[i].img.crossOrigin = 'anonymous';
        this._textures[i].img.addEventListener(
          'load',
          (): void => callback(this._textures[i]),
          {
            passive: true
          }
        );
        this._textures[i].img.src = fileName;
        return;
      }
    }

    // データのオンロードをトリガーにする
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.addEventListener(
      'error',
      (): void => {
        console.error(`[LAppTextureManager] 纹理加载失败: ${fileName}`);
        // 加载失败仍然调用回调（传 null），避免阻塞链式加载
        callback(null);
      },
      { passive: true }
    );

    img.addEventListener(
      'load',
      (): void => {
        const gl = this._glManager.getGl();

        // テクスチャオブジェクトの作成
        const tex: WebGLTexture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

        if (usePremultiply) {
          gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, 1);
        }

        // 写入像素数据
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);

        // 检查 WebGL 错误（跨域 tainted 图片会在这里报错）
        const err = gl.getError();
        if (err !== gl.NO_ERROR) {
          console.error(`[LAppTextureManager] texImage2D 失败 (${fileName}), glError=${err}`);
          gl.deleteTexture(tex);
          gl.bindTexture(gl.TEXTURE_2D, null);
          // 仍然调用回调（传 null），避免阻塞
          callback(null);
          return;
        }

        gl.generateMipmap(gl.TEXTURE_2D);
        gl.bindTexture(gl.TEXTURE_2D, null);

        const textureInfo: TextureInfo = new TextureInfo();
        textureInfo.fileName = fileName;
        textureInfo.width = img.width;
        textureInfo.height = img.height;
        textureInfo.id = tex;
        textureInfo.img = img;
        textureInfo.usePremultply = usePremultiply;
        if (this._textures != null) {
          this._textures.push(textureInfo);
        }

        callback(textureInfo);
      },
      { passive: true }
    );
    img.src = fileName;
  }

  /**
   * 画像の解放
   *
   * 配列に存在する画像全てを解放する。
   */
  public releaseTextures(): void {
    for (let i = 0; i < this._textures.length; i++) {
      this._glManager.getGl().deleteTexture(this._textures[i].id);
      this._textures[i] = null;
    }

    this._textures.length = 0;
  }

  /**
   * 画像の解放
   *
   * 指定したテクスチャの画像を解放する。
   * @param texture 解放するテクスチャ
   */
  public releaseTextureByTexture(texture: WebGLTexture): void {
    for (let i = 0; i < this._textures.length; i++) {
      if (this._textures[i].id != texture) {
        continue;
      }

      this._glManager.getGl().deleteTexture(this._textures[i].id);
      this._textures[i] = null;
      this._textures.splice(i, 1);
      break;
    }
  }

  /**
   * 画像の解放
   *
   * 指定した名前の画像を解放する。
   * @param fileName 解放する画像ファイルパス名
   */
  public releaseTextureByFilePath(fileName: string): void {
    for (let i = 0; i < this._textures.length; i++) {
      if (this._textures[i].fileName == fileName) {
        this._glManager.getGl().deleteTexture(this._textures[i].id);
        this._textures[i] = null;
        this._textures.splice(i, 1);
        break;
      }
    }
  }

  /**
   * setter
   * @param glManager
   */
  public setGlManager(glManager: LAppGlManager): void {
    this._glManager = glManager;
  }

  _textures: Array<TextureInfo>;
  private _glManager: LAppGlManager;
}

/**
 * 画像情報構造体
 */
export class TextureInfo {
  img: HTMLImageElement; // 画像
  id: WebGLTexture = null; // テクスチャ
  width = 0; // 横幅
  height = 0; // 高さ
  usePremultply: boolean; // Premult処理を有効にするか
  fileName: string; // ファイル名
}
