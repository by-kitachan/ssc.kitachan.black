interface Mat {
  copyTo(m: any): any;
  roi(rect: any): any;
  cols: number;
  rows: number;
}

// 認識系に使うパラメータ。基本触らない
export const searchHeightRatio = 0.04;
export const minTemplateMatchScore = 0.5;

const Black = 0;
const White = 255;

export function getBorder(m: any) {
  // @ts-ignore
  const cv = window.cv;
  const hsvMask = new cv.Mat();
  const hsv = new cv.Mat();

  cv.cvtColor(m, hsv, cv.COLOR_BGR2HSV_FULL, 0);
  const low = new cv.Mat(hsv.rows, hsv.cols, hsv.type(), [0, 0, 0, 0]);
  const high = new cv.Mat(hsv.rows, hsv.cols, hsv.type(), [255, 255, 245, 0]);
  cv.inRange(hsv, low, high, hsvMask);

  let posCounts: { [pos: number]: number } = {};
  let x;
  let y;

  // console.log(`m ${m.cols}:${m.rows}`);
  // console.log(`hsvMask ${hsvMask.cols}:${hsvMask.rows}`);
  for (y = Math.floor(m.rows * 0.5); y < Math.floor(m.rows * 0.85); y++) {
    let findWhite = false;
    for (x = 1; x < Math.floor(m.cols / 2); x++) {
      // console.log(`${x}:${y} ${hsvMask.data[y * m.cols + x]}`);
      if (!findWhite && hsvMask.data[y * m.cols + x] == White) {
        findWhite = true;
      } else if (findWhite && hsvMask.data[y * m.cols + x] == Black) {
        if (posCounts[x] == null) {
          posCounts[x] = 1;
        } else {
          posCounts[x]++;
        }
        break;
      }
    }
  }
  const mode = (dic: { [x: number]: number }): number => {
    let maxCounter = 0;
    let now = -1;

    Object.entries(dic).forEach(([key, value]) => {
      if (value > maxCounter) {
        maxCounter = value;
        now = Number(key);
      }
    });
    return now;
  };
  const borderX = mode(posCounts);
  // console.log(`borderX:${borderX}`);

  let borderBottom = 0;
  posCounts = {};

  for (y = Math.floor(m.rows * 0.71); y < Math.floor(m.rows * 0.95); y++) {
    let findWhite = false;
    for (x = borderX + 3; x < Math.floor(m.cols - borderX - 3); x++) {
      if (hsvMask.data[y * m.cols + x] == White) {
        findWhite = true;
        break;
      }
    }
    if (!findWhite) {
      borderBottom = y - 1;
      break;
    }
  }
  if (borderBottom == 0) {
    for (y = Math.floor(m.rows * 0.71); y >= Math.floor(m.rows * 0.5); y--) {
      let findWhite = false;
      for (x = borderX + 3; x < Math.floor(m.cols - borderX - 3); x++) {
        if (hsvMask.data[y * m.cols + x] == White) {
          findWhite = true;
          break;
        }
      }
      if (!findWhite) {
        borderBottom = y - 2;
        break;
      }
    }
  }

  high.delete();
  low.delete();
  hsv.delete();
  hsvMask.delete();

  return new cv.Rect(borderX, 0, m.cols - borderX * 2, borderBottom);
}

export function getScrollBarRect(m: any, border: any) {
  // @ts-ignore
  const cv = window.cv;
  const hsvMask = new cv.Mat();
  const hsv = new cv.Mat();

  const crop = m.roi(border);
  cv.cvtColor(crop, hsv, cv.COLOR_BGR2HSV_FULL, 0);
  const low = new cv.Mat(hsv.rows, hsv.cols, hsv.type(), [0, 0, 0, 0]);
  const high = new cv.Mat(hsv.rows, hsv.cols, hsv.type(), [255, 60, 230, 0]);
  cv.inRange(hsv, low, high, hsvMask);

  let top = -1;
  let bottom = -1;
  let findCntLimit =
    Math.floor(border.width * 0.99) - Math.floor(border.width * 0.98);
  for (let y = hsvMask.rows - 1; y >= 0; y--) {
    let findBlackCnt = 0;
    for (
      let x = Math.floor(border.width * 0.98);
      x < Math.floor(border.width * 0.99);
      x++
    ) {
      if (bottom == -1) {
        if (hsvMask.data[y * hsvMask.cols + x] == White) {
          bottom = y + 10;
          break;
        }
      } else if (hsvMask.data[y * hsvMask.cols + x] == Black) {
        if (++findBlackCnt >= findCntLimit) {
          top = y - 4;
          break;
        }
      }
    }
    if (top > 0) {
      break;
    }
  }
  const width = Math.floor(hsvMask.cols * 0.02) + 2;
  const scrollBarLeft =
    Math.floor(border.width * 0.98) + Math.floor((m.cols - border.width) / 2);

  high.delete();
  low.delete();
  crop.delete();
  hsv.delete();
  hsvMask.delete();

  return new cv.Rect(
    scrollBarLeft - Math.floor(width / 2),
    top,
    width,
    bottom - top
  );
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
export function vconcat(src: any, add: any) {
  // @ts-ignore
  const cv = window.cv;
  const vec = new cv.MatVector();
  // 結合元画像
  vec.push_back(src);
  // 結合用画像
  vec.push_back(add);
  const ret = new cv.Mat();
  // 垂直結合
  cv.vconcat(vec, ret);
  vec.delete();
  return ret;
}

// 結合方向
export const CombineDirection = {
  Vertical: 0,
  Horizontal: 1,
} as const;
type CombineDirection = typeof CombineDirection[keyof typeof CombineDirection];

// 単純結合
export function combineSimple(mats: Mat[], direction: CombineDirection) {
  // @ts-ignore
  const cv = window.cv;
  let totalWidth;
  let totalHeight;
  let x = 0;
  let y = 0;
  if (mats.length <= 0) {
    return null;
  } else if (mats.length == 1) {
    return mats[0];
  }

  switch (direction) {
    case CombineDirection.Vertical:
      totalWidth = Math.max(...mats.map((p) => p.cols));
      totalHeight = mats.reduce((prev, curr) => prev + curr.rows, 0);
      break;
    case CombineDirection.Horizontal:
      totalWidth = mats.reduce((prev, curr) => prev + curr.cols, 0);
      totalHeight = Math.max(...mats.map((p) => p.rows));
      break;
    default:
      return null;
  }

  const retMat = new cv.Mat(
    totalHeight,
    totalWidth,
    cv.CV_8UC4,
    [255, 255, 255, 0]
  );
  for (let i = 0; i < mats.length; i++) {
    const roi = retMat.roi(new cv.Rect(x, y, mats[i].cols, mats[i].rows));
    mats[i].copyTo(roi);
    roi.delete();
    switch (direction) {
      case CombineDirection.Vertical:
        y += mats[i].rows;
        break;
      case CombineDirection.Horizontal:
        x += mats[i].cols;
        break;
    }
  }
  return retMat;
}
