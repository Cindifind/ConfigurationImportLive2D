/**
 * Copyright(c) Live2D Inc. All rights reserved.
 *
 * Use of this source code is governed by the Live2D Open Software license
 * that can be found at https://www.live2d.com/eula/live2d-open-software-license-agreement_en.html.
 */

"use strict";
const fs = require('fs');

// 尝试多种路径，以适应不同的构建环境
function findResourcePath(possiblePaths) {
  for (const path of possiblePaths) {
    if (fs.existsSync(path)) {
      return path;
    }
  }
  throw new Error(`Could not find resource directory. Tried paths: ${possiblePaths.join(', ')}`);
}

// 定义可能的资源路径
const corePath = findResourcePath(['../../../Core', '../public/Core', './public/Core', '../../Core']);
const resourcesPath = findResourcePath(['../../Resources', '../public/Resources', './public/Resources', '../Resources']);
const shadersPath = findResourcePath(['../../../Framework/Shaders', '../public/Framework/Shaders', './public/Framework/Shaders', '../../Framework/Shaders']);
const frameworkSrcPath = findResourcePath(['../../../Framework/src', '../public/Framework/src', './public/Framework/src', '../../Framework/src']);

const publicResources = [
  {src: corePath, dst: './public/Core'},
  {src: resourcesPath, dst: './public/Resources'},
  {src: shadersPath, dst: './public/Framework/Shaders'},
  {src: frameworkSrcPath, dst: './public/Framework/src'},
];

publicResources.forEach((e)=>{if (fs.existsSync(e.dst)) fs.rmSync(e.dst, { recursive: true })});
publicResources.forEach((e)=>fs.cpSync(e.src, e.dst, {recursive: true}));
