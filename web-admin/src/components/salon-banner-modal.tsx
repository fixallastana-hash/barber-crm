'use client';

import { useRef, useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { getFirebaseFunctions } from '@/lib/firebase';
import { IconCropper } from '@/components/icon-cropper';

type Props = {
  initialBannerUrl?: string;
  onClose: () => void;
  onSaved: (bannerUrl: string) => void;
};

const MAX_FILE_SIZE = 5 * 1024 * 1024;

const allowedTypes = ['image/png', 'image/jpeg'];
const allowedExts = ['.png', '.jpg', '.jpeg'];

function isAllowedFile(file: File) {
  const lowerName = file.name.toLowerCase();
  return (
    allowedTypes.includes(file.type) ||
    allowedExts.some((ext) => lowerName.endsWith(ext))
  );
}

async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        reject(new Error('Не удалось прочитать изображение'));
        return;
      }
      resolve(result.split(',')[1] || '');
    };

    reader.onerror = () => {
      reject(new Error('Не удалось прочитать изображение'));
    };

    reader.readAsDataURL(blob);
  });
}

export default function SalonBannerModal({ initialBannerUrl, onClose, onSaved }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const handleFileSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setError('');
    setSaved(false);

    if (!isAllowedFile(file)) {
      setError('Поддерживаются PNG и JPEG');
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setError('Файл больше 5 МБ');
      return;
    }

    setSelectedFile(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleCropSave = async (
    blob: Blob,
    _positionX: number,
    _positionY: number,
    _scale: number,
  ) => {
    setUploading(true);
    setError('');
    try {
      const bannerBase64 = await blobToBase64(blob);
      const fn = httpsCallable(getFirebaseFunctions(), 'uploadSalonBanner');
      const res = await fn({ bannerBase64 });
      const data = res.data as { bannerUrl: string };
      onSaved(data.bannerUrl);
      setSaved(true);
      setSelectedFile(null);
    } catch (err) {
      const e = err as { message?: string };
      setError(e.message || 'Не удалось сохранить фото');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-black/50"
      role="dialog"
      aria-modal="true"
    >
      <div className="flex min-h-full items-end justify-center p-4 sm:items-center">
        <div className="w-full max-w-2xl rounded-lg bg-white p-6 shadow-xl">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">Фото салона (шапка)</h2>

            <button
              type="button"
              onClick={onClose}
              disabled={uploading}
              className="text-2xl text-gray-400 hover:text-gray-600 disabled:opacity-50"
              aria-label="Закрыть"
            >
              ✕
            </button>
          </div>

          {error && (
            <p className="mb-4 rounded bg-red-50 p-3 text-sm text-red-700">{error}</p>
          )}

          {saved && (
            <p className="mb-4 rounded bg-green-50 p-3 text-sm text-green-700">
              Фото обновлено
            </p>
          )}

          <div className="mb-5 rounded-lg border p-4">
            <div className="mb-3 text-sm font-medium text-gray-700">Текущее фото</div>

            <div className="flex items-center gap-4">
              <div className="h-20 w-48 overflow-hidden rounded-lg border bg-gray-50">
                {initialBannerUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={initialBannerUrl}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-sm text-gray-400">
                    Нет фото
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="rounded border px-4 py-2 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                {initialBannerUrl ? 'Заменить' : 'Загрузить'}
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg"
                onChange={handleFileSelected}
                className="hidden"
              />
            </div>

            <p className="mt-3 text-xs text-gray-500">
              Рекомендуется горизонтальное фото (3:1). Оно показывается в шапке
              страницы онлайн-записи.
            </p>
          </div>

          {selectedFile && (
            <div className="mb-5 rounded-lg border p-4">
              <IconCropper
                file={selectedFile}
                aspect={3}
                outputWidth={1200}
                maxBlobSize={1024 * 1024}
                onSave={(blob, positionX, positionY, scale) => {
                  void handleCropSave(blob, positionX, positionY, scale);
                }}
                onCancel={() => setSelectedFile(null)}
              />
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={uploading}
              className="rounded border px-4 py-2 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              {uploading ? 'Загрузка...' : 'Закрыть'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}