import type { NextPage } from 'next';
import Head from 'next/head';
import { useCallback, useEffect, useState, Fragment } from 'react';
import { Transition, Dialog } from '@headlessui/react';
import {
  getBorder,
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
    hp: 'https://aoneko-uma.fanbox.cc/',
  },
  {
    name: 'おりばー',
    role: 'Web担当',
    imageUrl:
      'https://pbs.twimg.com/profile_images/1395631397247717379/YGOCetpV_400x400.jpg',
    twitterUrl: 'https://twitter.com/oliver_uma',
    hp: 'https://youtube.com/c/kitachan',
  },
];

const WarningModal: React.VFC<{
  setOpen: (open: boolean) => void;
  open: boolean;
}> = ({ open, setOpen }) => {
  return (
    <Transition.Root show={open} as={Fragment}>
      <Dialog
        as="div"
        className="fixed z-10 inset-0 overflow-y-auto"
        onClose={setOpen}
      >
        <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <Dialog.Overlay className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" />
          </Transition.Child>
          {/* This element is to trick the browser into centering the modal contents. */}
          <span
            className="hidden sm:inline-block sm:align-middle sm:h-screen"
            aria-hidden="true"
          >
            &#8203;
          </span>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
            enterTo="opacity-100 translate-y-0 sm:scale-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100 translate-y-0 sm:scale-100"
            leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
          >
            <div className="inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle max-w-3xl w-full sm:p-6">
              <div>
                <div className="mt-3 sm:mt-5">
                  <h2 className="text-2xl">注意点</h2>
                  <div className="mt-4 text-sm text-gray-500">
                    ※ 結合する画像の解像度は統一してください。 <br />※
                    結合する順に画像の位置を調整してください。
                    <br />※
                    結合処理において、最下段のスキルを元に次画像結合位置を決めています。
                    <br />
                    最低1行分はスキルを被せて撮影して下さい。(下の赤枠参照)
                    <ul role="list" className="flex justify-center mt-4">
                      <li className="relative">
                        <img
                          src="https://media.discordapp.net/attachments/956400362644971530/961167272678920212/exsample1.png"
                          alt=""
                          className="object-contain pointer-events-none group-hover:opacity-75"
                          style={{ maxHeight: '60vh' }}
                        />
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
              <div className="mt-5 sm:mt-6">
                <button
                  type="button"
                  className="inline-flex justify-center w-full rounded-md border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:text-sm"
                  onClick={() => setOpen(false)}
                >
                  閉じる
                </button>
              </div>
            </div>
          </Transition.Child>
        </div>
      </Dialog>
    </Transition.Root>
  );
};

const Home: NextPage = () => {
  const [errors, setErrors] = useState<ErrorsType>();
  const [created, setCreated] = useState(false);
  const [images, setImages] = useState<ImageListType>([]);
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [deleteSideMargin, setDeleteSideMargin] = useState<boolean>(false);

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

  useEffect(() => {
    document.addEventListener('paste', (e) => {
      const item = e.clipboardData?.items[0];
      const file = item?.getAsFile();
      if (file?.type.indexOf('image') === 0) {
        const reader = new FileReader();
        reader.addEventListener('load', () => {
          const image = { data_url: reader.result, file: file };
          setImages((prv) => [...prv, image]);
        });
        reader.readAsDataURL(file);
      }
    });
  }, []);

  const onCreate = useCallback(() => {
    // @ts-ignore
    const cv = window.cv;
    // 結合処理入り口
    const srcMats = [];
    // imgタグのidから画像読み取り(imgタグにwidthやheight指定あるとリサイズされてしまうので注意)
    for (let i = 0; i < images.length; i++) {
      const img = new Image();
      img.src = images[i].data_url;
      const mat = cv.imread(img);
      // console.log(`Input:${i} ${mat.cols}:${mat.rows} pixel`);
      if (i > 0) {
        if (srcMats[0].cols != mat.cols || srcMats[0].rows != mat.rows) {
          window.alert('異なる解像度の画像が入力されています');
          return;
        }
      }
      srcMats.push(mat);
    }
    // 1枚目を基準画像とする
    const src = srcMats[0];
    const width = src.cols;
    // 左右切り落とし+下端の座標取得
    const border = getBorder(src);
    const height = border.height;
    const left = border.x;
    const right = left + Math.floor(border.width * 0.95);
    // console.log(`幅:${width} 高:${border.height} 左:${left} 右:${right}`);
    // 各座標取れない場合は処理終了
    if (width <= 0 || left <= 0 || right <= 0 || height <= 0) {
      window.alert('境界の取得に失敗しました');
      // console.log(`幅:${width} 高:${height} 左:${left} 右:${right}`);
      return;
    }

    let intMat = src.roi(new cv.Rect(0, 0, width, height));
    let totalY = height;
    const searchHeight = Math.floor(src.rows * searchHeightRatio);
    // console.log(`SearchHeight:${searchHeight}`);
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
        new cv.Rect(left, 0, right - left, height)
      );
      templMat.delete();
      if (score < minTemplateMatchScore) {
        window.alert(
          `${i}番目と${i + 1}番目の画像の一致箇所が見つかりませんでした`
        );
        return;
      }
      // console.log(`${i} ${score} ${rect.x}:${rect.y}`);

      const tmpMat = intMat.roi(new cv.Rect(0, 0, width, totalY));
      intMat.delete();
      const addMat = srcMats[i].roi(
        new cv.Rect(
          0,
          rect.y + searchHeight,
          width,
          height - rect.y + searchHeight
        )
      );

      // 垂直結合
      intMat = vconcat(tmpMat, addMat);
      addMat.delete();
      // 結合元画像のスキル最下段の座標を覚えておく
      totalY += height - searchHeight - rect.y;
      // console.log(`TotalY:${totalY}`);
    }

    for (let i = 0; i < srcMats.length; i++) {
      srcMats[i].delete();
    }

    const retRect = deleteSideMargin ? new cv.Rect(border.x, 0, border.width, totalY) : new cv.Rect(0, 0, width, totalY);
    // 閉じるボタンまで入っているので、スキル枠までを切り抜き、出力画像とする
    const retMat = intMat.roi(retRect);
    intMat.delete();
    cv.imshow('dest-canvas', retMat);
    setCreated(true);
  }, [images]);

  const onDownload = useCallback(() => {
    const canvas = document.querySelector<HTMLCanvasElement>('#dest-canvas');
    if (canvas) {
      canvas.toBlob((blob) => {
        const link = document.createElement('a');
        if (blob) {
          link.href = URL.createObjectURL(blob);
          link.download = 'result.png';
          link.target = '_blank';
          link.click();
        }
      }, 'image/png');
    }
  }, []);

  const onCopy = useCallback(() => {
    const canvas = document.querySelector<HTMLCanvasElement>('#dest-canvas');
    const isSafari = /^((?!chrome|android).)*safari/i.test(
      navigator?.userAgent
    );
    if (canvas) {
      if (isSafari) {
        navigator.clipboard
          .write([
            new ClipboardItem({
              'image/png': new Promise(async (resolve, reject) => {
                try {
                  const blob = (await new Promise((resolve) => {
                    canvas.toBlob((blob) => {
                      if (blob) {
                        resolve(blob);
                      } else {
                        reject();
                      }
                    });
                  })) as Blob;
                  if (blob) {
                    resolve(new Blob([blob], { type: 'image/png' }));
                  } else {
                    reject();
                  }
                } catch (err) {
                  reject(err);
                }
              }),
            }),
          ])
          .then(() => {
            alert('コピーしました。');
          })
          .catch((e) => {
            console.log(e);
            alert('コピーに失敗しました。');
          });
      } else {
        canvas.toBlob((blob) => {
          if (blob) {
            try {
              navigator.clipboard
                .write([
                  new ClipboardItem({
                    'image/png': blob,
                  }),
                ])
                .then(() => {
                  alert('コピーしました。');
                })
                .catch(() => {
                  alert('コピーに失敗しました。');
                });
            } catch (e) {
              alert('コピーに失敗しました。');
            }
          }
        }, 'image/png');
      }
    }
  }, []);

  const onShare = useCallback(() => {
    const canvas = document.querySelector<HTMLCanvasElement>('#dest-canvas');
    if (canvas) {
      canvas.toBlob((blob) => {
        if (blob) {
          const shareData = {
            title: 'レシート因子作成くん',
            text: '「レシート因子作成くん」で作成されました！ #レシート因子 ssc.kitachan.black',
            files: [
              new File([blob], 'result.png', {
                type: 'image/png',
                lastModified: new Date().getTime(),
              }),
            ],
          };
          navigator.share(shareData);
        }
      }, 'image/png');
    }
  }, []);

  const onMove = useCallback(
    (index: number, direction: 'right' | 'left') => {
      const target = images.find((image, idx) => index === idx);
      const exceptTargetImages = images.filter((image, idx) => index !== idx);
      const newImages = [];
      if (target) {
        for (let i = 0; i < exceptTargetImages.length; i++) {
          newImages.push(exceptTargetImages[i]);
          if (i === index) {
            newImages.push(target);
          }
        }
        setImages(newImages);
      }
    },
    [images]
  );

  const title = 'レシート因子作成くんβ';
  const description =
    '「ウマ娘詳細」画面の「継承タブ」の複数枚画像を1枚に結合するツールです';
  const siteUrl = 'https://ssc.kitachan.black';
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <Head>
        <title>{title}</title>
        <meta name="description" content={description} />
        <link rel="icon" href="/favicon.ico" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1"
        />
        <meta name="application-name" content={title} />
        <meta name="description" content={description} />
        <meta name="thumbnail" content={`${siteUrl}/webclip.png`} />
        <link rel="shortcut icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" href="/webclip.png" />
        <link rel="icon" type="image/png" href="/webclip.png" />
        <meta property="og:url" content={siteUrl} />
        <meta property="og:type" content="website" />
        <meta property="og:title" content={title} />
        <meta property="og:image" content={`${siteUrl}/ogp.png`} />
        <meta property="og:description" content={description} />
        <meta property="og:site_name" content={title} />
        <meta property="og:locale" content="ja_JP" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:site" content="@" />
        <meta name="twitter:url" content={siteUrl} />
        <meta name="twitter:title" content={title} />
        <meta name="twitter:description" content={description} />
        <meta name="twitter:image" content={`${siteUrl}/ogp.png`} />
      </Head>
      <Script
        async
        src="https://www.googletagmanager.com/gtag/js?id=UA-212558389-4"
      />
      <Script id="ga-script">{`window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
        
            gtag('config', 'UA-212558389-4');`}</Script>
      <Script src="https://docs.opencv.org/4.5.5/opencv.js" />
      <WarningModal open={modalOpen} setOpen={setModalOpen} />
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
                    レシート因子作成くんβ
                    <br />
                    <span className="text-sm text-gray-500">
                      <b>「スキル画面」「チーム競技場のスコア情報画面」</b>
                      にも対応しています。
                    </span>
                  </label>
                  <div className="my-4 text-center">
                    <button
                      onClick={() => setModalOpen(true)}
                      type="button"
                      className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                    >
                      注意点を表示する
                    </button>
                  </div>
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
                          {index + 1}枚目の画像
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
                            className="mx-2 inline-flex items-center px-2.5 py-1.5 border border-transparent text-xs font-medium rounded text-red-700 bg-red-100 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                          >
                            削除
                          </button>
                          {index !== imageList.length - 1 && (
                            <button
                              onClick={() => onMove(index, 'right')}
                              type="button"
                              className="inline-flex items-center px-2.5 py-1.5 border border-transparent text-xs font-medium rounded text-indigo-700 bg-indigo-100 hover:bg-indigo-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                            >
                              →
                            </button>
                          )}
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
            <div className="flex justify-center my-8">
              <button
                onClick={onDownload}
                type="button"
                style={{ width: 130 }}
                className="mx-1 inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-xs font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                ダウンロードする
              </button>
              <button
                onClick={onCopy}
                type="button"
                style={{ width: 100 }}
                className="mx-1 inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-xs font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                コピーする
              </button>
              {typeof navigator.share !== 'undefined' && (
                <button
                  onClick={onShare}
                  type="button"
                  style={{ width: 100 }}
                  className="mx-1 inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-xs font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  シェアする
                </button>
              )}
            </div>
          )}
          <canvas
            id="dest-canvas"
            style={{ maxHeight: '90vh', width: 'auto', margin: '0 auto' }}
          />
          {created && (
            <div className="flex justify-center my-8">
              <button
                onClick={onDownload}
                type="button"
                style={{ width: 130 }}
                className="mx-1 inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-xs font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                ダウンロードする
              </button>
              <button
                onClick={onCopy}
                type="button"
                style={{ width: 100 }}
                className="mx-1 inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-xs font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                コピーする
              </button>
              {typeof navigator.share !== 'undefined' && (
                <button
                  onClick={onShare}
                  type="button"
                  style={{ width: 100 }}
                  className="mx-1 inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-xs font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  シェアする
                </button>
              )}
            </div>
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
                            target="_blank"
                            rel="noopener noreferrer"
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
                        {person.hp && (
                          <li>
                            <a
                              href={person.hp}
                              className="text-gray-400 hover:text-gray-500"
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <span className="sr-only">HP</span>
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className="h-6 w-6"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                strokeWidth="2"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
                                />
                              </svg>
                            </a>
                          </li>
                        )}
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
