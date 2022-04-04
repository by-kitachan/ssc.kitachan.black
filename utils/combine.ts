// 認識系に使うパラメータ。基本触らない
const boundaryYPosHeightRatio = 0.7;
const boundaryYPosHeightThresh = 250;
const boundaryXPosHeightRatio = 0.7;
const boundaryXPosLeftRatio = 0.1;
const boundaryXPosLeftThresh = 240;
const boundaryXPosRightRatio = 0.975;
const boundaryXPosRightThresh = 240;
const boundaryXPosRightGrayThresh = 215;
export const searchHeightRatio = 0.04;
export const minTemplateMatchScore = 0.5;

// テンプレートマッチに使用する左右の座標を計算
// グレースケール化して色見て判断
// 右はスクロールバーを超えるために、スクロールバーを見つけたかのフラグ(findDarkGray)を使用
export function getBoundaryXPos(m: any) {
  // @ts-ignore
  const cv = window.cv;
  let b = new cv.Mat();
  cv.cvtColor(m, b, cv.COLOR_RGBA2GRAY, 0);
  let left = -1;
  let right = -1;

  const y = Math.floor(m.rows * boundaryXPosHeightRatio);
  for (
    let x = Math.floor(m.cols * boundaryXPosLeftRatio);
    x < m.cols * 0.5;
    x++
  ) {
    console.log(`${x}:${y} ${b.data[y * m.cols + x]}`);
    if (b.data[y * m.cols + x] > boundaryXPosLeftThresh) {
      left = x - 1;
      break;
    }
  }

  let findDarkGray = false;
  for (
    let x = Math.floor(m.cols * boundaryXPosRightRatio);
    x >= m.cols * 0.5;
    x--
  ) {
    if (b.data[y * m.cols + x] < boundaryXPosRightGrayThresh && !findDarkGray) {
      findDarkGray = true;
    }
    if (findDarkGray && b.data[y * m.cols + x] > boundaryXPosRightThresh) {
      right = x;
      break;
    }
  }
  b.delete();
  return [left, right];
}

// 画像毎のスキル最下段を取得
// グレースケール化して色見て判断
export function getBoundaryYPos(m: any, x: any) {
  // @ts-ignore
  const cv = window.cv;
  let b = new cv.Mat();
  cv.cvtColor(m, b, cv.COLOR_RGBA2GRAY, 0);
  for (let y = Math.floor(m.rows * boundaryYPosHeightRatio); y < m.rows; y++) {
    if (b.data[y * m.cols + x] > boundaryYPosHeightThresh) {
      return y;
    }
  }
  b.delete();
  return -1;
}

// テンプレートマッチ
// グレースケール化して、一致箇所を探す
// rectは検索範囲を狭める(スループット向上)ために使用
export function templateMatch(m: any, templ: any, rect: any) {
  // @ts-ignore
  const cv = window.cv;
  let dst = new cv.Mat();
  let srcGray = new cv.Mat();
  let templGray = new cv.Mat();
  let mask = new cv.Mat();
  let src = m.roi(rect);
  // グレースケール化
  cv.cvtColor(src, srcGray, cv.COLOR_RGBA2GRAY, 0);
  cv.cvtColor(templ, templGray, cv.COLOR_RGBA2GRAY, 0);
  // テンプレートマッチ
  cv.matchTemplate(srcGray, templGray, dst, cv.TM_CCOEFF_NORMED, mask);
  // 座標毎の一致スコアから最大値を取得
  let result = cv.minMaxLoc(dst, mask);
  // 最大値の座標を取得
  let maxPoint = result.maxLoc;
  // 座標と検索範囲からRect(X, Y, Width, Height)を作成
  const retRect = new cv.Rect(
    maxPoint.x + rect.x,
    maxPoint.y + rect.y,
    templ.cols,
    templ.rows
  );

  templGray.delete();
  srcGray.delete();
  mask.delete();
  dst.delete();
  src.delete();

  // [一致スコア, 一致座標]
  return [result.maxVal, retRect];
}

// 垂直結合
export function vconcat(src: string, add: number) {
  // @ts-ignore
  const cv = window.cv;
  const vec = new cv.MatVector();
  // 結合元画像
  vec.push_back(src);
  // 結合用画像
  vec.push_back(add);
  let ret = new cv.Mat();
  // 垂直結合
  cv.vconcat(vec, ret);
  return ret;
}
