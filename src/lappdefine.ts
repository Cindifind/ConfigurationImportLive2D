/**
 * Copyright(c) Live2D Inc. All rights reserved.
 *
 * Use of this source code is governed by the Live2D Open Software license
 * that can be found at https://www.live2d.com/eula/live2d-open-software-license-agreement_en.html.
 */

import { LogLevel } from '@framework/live2dcubismframework';

/**
 * Sample Appで使用する定数
 */

// Canvas width and height pixel values, or dynamic screen size ('auto').
export const CanvasSize: { width: number; height: number } | 'auto' = 'auto';

// キャンバスの数
export const CanvasNum = 1;

// 画面
export const ViewScale = 1.0;
export const ViewMaxScale = 2.0;
export const ViewMinScale = 0.8;

export const ViewLogicalLeft = -1.0;
export const ViewLogicalRight = 1.0;
export const ViewLogicalBottom = -1.0;
export const ViewLogicalTop = 1.0;

export const ViewLogicalMaxLeft = -2.0;
export const ViewLogicalMaxRight = 2.0;
export const ViewLogicalMaxBottom = -2.0;
export const ViewLogicalMaxTop = 2.0;

// ===== 资源基础URL（支持跨域CDN部署） =====
// 使用方法：在引入Live2D脚本之前设置 window.LIVE2D_BASE_URL
//   <script>window.LIVE2D_BASE_URL = 'https://cdn.example.com/live2d/';</script>
//   <script type="module" src="https://cdn.example.com/live2d/assets/index-xxx.js"></script>
// 不设置时默认为 './'（同源部署）
function getBaseUrl(): string {
  if (typeof window !== 'undefined') {
    const w = window as any;
    if (w.LIVE2D_BASE_URL) {
      const url: string = w.LIVE2D_BASE_URL;
      return url.endsWith('/') ? url : url + '/';
    }
  }
  return './';
}

// 相対パス（同源部署）或绝对URL（跨域CDN部署）
export const ResourcesPath = getBaseUrl() + 'Resources/';

// シェーダー相対パス（同源部署）或绝对URL（跨域CDN部署）
export const ShaderPath = getBaseUrl() + 'Framework/Shaders/WebGL/';

/**
 * 获取实际使用的着色器路径
 * 优先使用 HTML 配置中的 data-shader-path，其次使用 LAppDefine.ShaderPath
 */
export function getEffectiveShaderPath(): string {
  if (typeof window !== 'undefined') {
    const config = (window as any).Live2DConfig;
    if (config?.shaderPath) {
      return config.shaderPath.endsWith('/') ? config.shaderPath : config.shaderPath + '/';
    }
  }
  return ShaderPath;
}

// モデルの後ろにある背景の画像ファイル
export const BackImageName = 'back_class_normal.png';

// 歯車
export const GearImageName = 'icon_gear.png';

// 終了ボタン
export const PowerImageName = 'CloseNormal.png';

// モデル定義---------------------------------------------
// モデルを配置したディレクトリ名の配列
// ディレクトリ名とmodel3.jsonの名前を一致させておくこと
export const ModelDir: string[] = [
  'Haru',
  'Hiyori',
  'Mark',
  'Natori',
  'Rice',
  'Mao',
  'Wanko',
  'Ren'
];
export const ModelDirSize: number = ModelDir.length;

// 外部定義ファイル（json）と合わせる
export const MotionGroupIdle = 'Idle'; // アイドリング
export const MotionGroupTapBody = 'TapBody'; // 体をタップしたとき

// 外部定義ファイル（json）と合わせる
export const HitAreaNameHead = 'Head';
export const HitAreaNameBody = 'Body';

// モーションの優先度定数
export const PriorityNone = 0;
export const PriorityIdle = 1;
export const PriorityNormal = 2;
export const PriorityForce = 3;

// MOC3の整合性検証オプション
export const MOCConsistencyValidationEnable = true;
// motion3.jsonの整合性検証オプション
export const MotionConsistencyValidationEnable = true;

// デバッグ用ログの表示オプション
export const DebugLogEnable = true;
export const DebugTouchLogEnable = false;

// Frameworkから出力するログのレベル設定
export const CubismLoggingLevel: LogLevel = LogLevel.LogLevel_Verbose;

// デフォルトのレンダーターゲットサイズ
export const RenderTargetWidth = 1900;
export const RenderTargetHeight = 1000;
