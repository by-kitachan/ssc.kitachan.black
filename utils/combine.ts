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

  for (y = Math.floor(m.rows * 0.7); y < Math.floor(m.rows * 0.95); y++) {
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

  high.delete();
  low.delete();
  hsv.delete();
  hsvMask.delete();

  return new cv.Rect(borderX, 0, m.cols - borderX * 2, borderBottom);
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
