import type { NextPage } from 'next';
import Head from 'next/head';
import styles from '../styles/Home.module.css';
import { useCallback, useEffect, useState } from 'react';
import {
  getBoundaryXPos,
  getBoundaryYPos,
  minTemplateMatchScore,
  searchHeightRatio,
  templateMatch,
  vconcat,
} from '../utils/combine';
import ImageUploading, { ErrorsType } from 'react-images-uploading';
import { ImageListType } from 'react-images-uploading/dist/typings';
import Script from 'next/script';

function classNames(...classes: any) {
  return classes.filter(Boolean).join(' ');
}

const people = [
  {
    name: '無冠の帝王',
    role: '帝王塾塾長',
    imageUrl:
      'https://pbs.twimg.com/profile_images/1445523701240254471/djeol9PI_400x400.jpg',
    twitterUrl: 'https://twitter.com/teioupawa',
  },
  {
    name: 'ポチ',
    role: '画像処理担当',
    imageUrl:
      'https://pbs.twimg.com/profile_images/1461309767939682304/K3pWuFly_400x400.jpg',
    twitterUrl: 'https://twitter.com/aoneko_uma',
  },
  {
    name: 'おりばー',
    role: 'Web担当',
    imageUrl:
      'https://pbs.twimg.com/profile_images/1395631397247717379/YGOCetpV_400x400.jpg',
    twitterUrl: 'https://twitter.com/oliver_uma',
  },
];

const Home: NextPage = () => {
  const [errors, setErrors] = useState<ErrorsType>();
  const [created, setCreated] = useState(false);
  const [images, setImages] = useState<ImageListType>([]);

  const onChange = (imageList: ImageListType, addUpdateIndex: any) => {
    setImages(imageList);
  };

  useEffect(() => {
    if (errors) {
      if (errors.maxNumber) {
        alert(`設定できる画像は10枚までです。`);
      } else if (errors.acceptType) {
        alert('サポートされてないファイルタイプです。');
      } else if (errors.maxFileSize) {
        alert('最大サイズを超過しています。');
      }
    }
  }, [errors]);

  const onCreate = useCallback(() => {
    // @ts-ignore
    const cv = window.cv;
    // 結合処理入り口
    // TODO: returnしている所はWindows版でエラーにしている箇所。適切なエラーハンドリングお願いします。
    const srcMats = [];
    // imgタグのidから画像読み取り(imgタグにwidthやheight指定あるとリサイズされてしまうので注意)
    for (let i = 0; i < images.length; i++) {
      const img = new Image();
      img.src = images[i].data_url;
      const mat = cv.imread(img);
      console.log(`Input:${i} ${mat.cols}:${mat.rows} pixel`);
      if (i > 0) {
        if (srcMats[0].cols != mat.cols || srcMats[0].rows != mat.rows) {
          console.log('異なる解像度の画像が入力されています');
          return;
        }
      }
      srcMats.push(mat);
    }
    // 1枚目を基準画像とする
    const src = srcMats[0];
    const width = src.cols;
    // スクロールバーが入らないスキルアイコンの両端を取得する(結構適当)
    const [left, right] = getBoundaryXPos(src);
    console.log(`Left:${left} Right:${right}`);
    // 各座標取れない場合は処理終了
    if (width <= 0 || left <= 0 || right <= 0) {
      console.log('境界の取得に失敗しました');
      console.log(`幅:${width} 左:${left} 右:${right}`);
      return;
    }
    // スキルの最下段の座標取得
    // 「スキル枠背景 = LightGray、それより下の背景 = White」なので、それを用いて判断
    let boundaryY = getBoundaryYPos(src, left);
    console.log(`0 Bottom:${boundaryY}`);
    // 左上からスキルの最下段までを切り抜き
    let intMat = src.roi(new cv.Rect(0, 0, width, boundaryY));

    let totalY = boundaryY;
    // 2枚目以降の画像とのテンプレートマッチ用画像切り抜き用の高さ。大体スキル1行分
    const searchHeight = Math.floor(src.rows * searchHeightRatio);
    console.log(`SearchHeight:${searchHeight}`);
    // 2枚目以降
    for (let i = 1; i < srcMats.length; i++) {
      // スキル1行分切り抜き
      let templMat = intMat.roi(
        new cv.Rect(left, totalY - searchHeight, right - left, searchHeight)
      );
      // スキル1行分の一致箇所検索
      const [score, rect] = templateMatch(
        srcMats[i],
        templMat,
        new cv.Rect(left, 0, right - left, srcMats[i].rows)
      );
      templMat.delete();
      if (score < minTemplateMatchScore) {
        console.log(
          `${i}番目と${i + 1}番目の画像の一致箇所が見つかりませんでした`
        );
        return;
      }
      console.log(`${i} ${score} ${rect.x}:${rect.y}`);
      boundaryY = getBoundaryYPos(srcMats[i], left);
      console.log(`${i} Bottom:${boundaryY}`);
      if (boundaryY <= 0) {
        console.log(`${i + 1}番目の画像の境界(下)の取得に失敗しました`);
        return;
      }

      // 結合元は閉じるボタンまで入っているので、スキル枠までを切り抜き、これを結合元画像とする
      const tmpMat = intMat.roi(new cv.Rect(0, 0, width, totalY));
      intMat.delete();
      // 結合対象画像をテンプレートマッチ結果から切り抜き
      const addMat = srcMats[i].roi(
        new cv.Rect(
          0,
          rect.y + searchHeight,
          width,
          boundaryY - rect.y + searchHeight
        )
      );

      // 垂直結合
      intMat = vconcat(tmpMat, addMat);
      addMat.delete();
      // 結合元画像のスキル最下段の座標を覚えておく
      totalY += boundaryY - searchHeight - rect.y;
      console.log(`TotalY:${totalY}`);
    }

    for (let i = 0; i < srcMats.length; i++) {
      srcMats[i].delete();
    }

    // 閉じるボタンまで入っているので、スキル枠までを切り抜き、出力画像とする
    const retMat = intMat.roi(new cv.Rect(0, 0, width, totalY));
    intMat.delete();
    cv.imshow('dest-canvas', retMat);
    setCreated(true);
  }, [images]);

  const onDownload = useCallback(() => {
    const canvas = document.querySelector<HTMLCanvasElement>('#dest-canvas');
    if (canvas) {
      const data = canvas.toDataURL();
      const tmpLink = document.createElement('a');
      tmpLink.download = 'result.png';
      tmpLink.href = data;
      document.body.appendChild(tmpLink);
      tmpLink.click();
      document.body.removeChild(tmpLink);
    }
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <Head>
        <title>レシート因子作成くん</title>
        <meta
          name="description"
          content="「ウマ娘詳細」画面の「継承タブ」の複数枚画像を1枚に結合するツールです"
        />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <Script src="https://docs.opencv.org/4.5.5/opencv.js" />
      <ImageUploading
        multiple
        value={images}
        onChange={onChange}
        maxNumber={10}
        dataURLKey="data_url"
        acceptType={['jpg', 'png', 'jpeg', 'heic']}
        maxFileSize={10 * 1024 * 1024}
      >
        {({
          imageList,
          onImageUpload,
          onImageRemoveAll,
          onImageUpdate,
          onImageRemove,
          isDragging,
          dragProps,
          errors,
        }) => {
          setErrors(errors);
          return (
            <div>
              <div className="mt-12 grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
                <div className="sm:col-span-6">
                  <label
                    htmlFor="cover-photo"
                    className="block text-3xl font-medium text-gray-700 text-center"
                  >
                    レシート因子作成くん
                    <br />
                    <span className="text-sm text-gray-500">
                      ※ 結合する画像の解像度は統一してください
                    </span>
                  </label>
                  <div
                    className={classNames(
                      'mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-dashed rounded-md',
                      isDragging ? 'border-blue-300' : 'border-gray-300'
                    )}
                    {...dragProps}
                  >
                    <div className="space-y-1 text-center">
                      <svg
                        className="mx-auto h-12 w-12 text-gray-400"
                        stroke="currentColor"
                        fill="none"
                        viewBox="0 0 48 48"
                        aria-hidden="true"
                      >
                        <path
                          d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                          strokeWidth={2}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                      <div className="flex text-xm text-gray-600">
                        <button
                          className="relative cursor-pointer bg-white rounded-md font-medium text-indigo-600 hover:text-indigo-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-indigo-500"
                          onClick={onImageUpload}
                          type="button"
                        >
                          <span className="text-xs">画像をアップロード</span>
                        </button>
                        <p className="pl-1 text-xs mt-1.5">
                          または ドラッグ&ドロップ
                        </p>
                      </div>
                      <p className="text-xs text-gray-500">
                        PNG, JPG（最大10MBまで）
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              {imageList.length > 0 && (
                <div className="mt-4">
                  <div className="flex flex-row mb-2">
                    <label
                      htmlFor="cover-photo"
                      className="block text-lg font-medium text-gray-700"
                    >
                      プレビュー
                    </label>
                    <p className="ml-2">
                      <button
                        onClick={onImageRemoveAll}
                        type="button"
                        className="inline-flex items-center px-2.5 py-1.5 border border-transparent text-xs font-medium rounded text-red-700 bg-red-100 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                      >
                        全削除
                      </button>
                    </p>
                  </div>
                  <ul
                    role="list"
                    className="grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-3 sm:gap-x-6 lg:grid-cols-3 xl:gap-x-8"
                  >
                    {imageList.map((image, index) => (
                      <li key={index} className="relative">
                        <div className="group block w-full aspect-w-6 aspect-h-11 rounded-lg bg-gray-100 focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-offset-gray-100 focus-within:ring-indigo-500 overflow-hidden">
                          <img
                            src={image['data_url']}
                            alt=""
                            className="object-contain pointer-events-none group-hover:opacity-75"
                          />
                        </div>
                        <p className="mt-2 block text-sm font-medium text-gray-900 truncate pointer-events-none">
                          {image.file?.name}
                        </p>
                        <p className="block text-sm font-medium text-gray-500 pointer-events-none">
                          {Math.round(
                            ((image.file?.size || 0) / 1024 / 1024) * 10
                          ) / 10}{' '}
                          MB
                        </p>
                        <p className="text-center">
                          <button
                            onClick={() => onImageRemove(index)}
                            type="button"
                            className="inline-flex items-center px-2.5 py-1.5 border border-transparent text-xs font-medium rounded text-red-700 bg-red-100 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                          >
                            削除
                          </button>
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          );
        }}
      </ImageUploading>
      <div className="text-center mt-8">
        <button
          onClick={onCreate}
          type="button"
          className="disabled:opacity-50 inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          がっちゃんこする
        </button>
      </div>

      <div
        style={{ objectFit: 'contain' }}
        className={classNames(created ? 'my-4' : 'h-0')}
      >
        <div className="flex flex-col justify-center items-center">
          {created && (
            <button
              onClick={onDownload}
              type="button"
              style={{ width: 150, margin: 32 }}
              className="disabled:opacity-50 ml-3 inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              ダウンロードする
            </button>
          )}
          <canvas
            id="dest-canvas"
            style={{ maxHeight: '90vh', width: 'auto', margin: '0 auto' }}
          />
          {created && (
            <button
              onClick={onDownload}
              type="button"
              style={{ width: 150, margin: 32 }}
              className="disabled:opacity-50 ml-3 inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              ダウンロードする
            </button>
          )}
        </div>
      </div>

      <div className="bg-white">
        <div className="max-w-7xl mx-auto py-12 px-4 text-center sm:px-6 lg:px-8 lg:py-12">
          <div className="space-y-12">
            <div className="space-y-5 sm:mx-auto sm:max-w-xl sm:space-y-4 lg:max-w-5xl">
              <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
                ツール制作関係者
              </h2>
              <p className="text-xl text-gray-500">
                このツールは「帝王塾」で企画、作成されました。
                <br />
                入塾希望者は
                <a
                  href="https://discord.gg/fYc8WEgwE8"
                  className="text-indigo-600"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  こちら
                </a>
                まで。
              </p>
            </div>
            <ul
              role="list"
              className="mx-auto space-y-16 sm:grid sm:grid-cols-2 sm:gap-16 sm:space-y-0 lg:grid-cols-3 lg:max-w-5xl"
            >
              {people.map((person) => (
                <li key={person.name}>
                  <div className="space-y-6">
                    <img
                      className="mx-auto h-40 w-40 rounded-full xl:w-56 xl:h-56"
                      src={person.imageUrl}
                      alt=""
                    />
                    <div className="space-y-2">
                      <div className="text-lg leading-6 font-medium space-y-1">
                        <h3>{person.name}</h3>
                        <p className="text-indigo-600">{person.role}</p>
                      </div>
                      <ul role="list" className="flex justify-center space-x-5">
                        <li>
                          <a
                            href={person.twitterUrl}
                            className="text-gray-400 hover:text-gray-500"
                          >
                            <span className="sr-only">Twitter</span>
                            <svg
                              className="w-5 h-5"
                              aria-hidden="true"
                              fill="currentColor"
                              viewBox="0 0 20 20"
                            >
                              <path d="M6.29 18.251c7.547 0 11.675-6.253 11.675-11.675 0-.178 0-.355-.012-.53A8.348 8.348 0 0020 3.92a8.19 8.19 0 01-2.357.646 4.118 4.118 0 001.804-2.27 8.224 8.224 0 01-2.605.996 4.107 4.107 0 00-6.993 3.743 11.65 11.65 0 01-8.457-4.287 4.106 4.106 0 001.27 5.477A4.073 4.073 0 01.8 7.713v.052a4.105 4.105 0 003.292 4.022 4.095 4.095 0 01-1.853.07 4.108 4.108 0 003.834 2.85A8.233 8.233 0 010 16.407a11.616 11.616 0 006.29 1.84" />
                            </svg>
                          </a>
                        </li>
                      </ul>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <footer className="bg-white">
        <div className="max-w-7xl mx-auto py-8 px-4 overflow-hidden sm:px-6 lg:px-8">
          <p className="mt-4 text-center text-base text-gray-400">
            &copy; {new Date().getFullYear()} おりばー All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Home;
