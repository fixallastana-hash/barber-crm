'use client';

import { useEffect, useRef, useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { getFirebaseFunctions } from '@/lib/firebase';
import { IconCropper } from '@/components/icon-cropper';

type Service = {
  id: string;
  name: string;
  durationMinutes: number;
  bufferMinutes: number;
  priceKzt: number;
  iconUrl?: string;
  iconPositionX?: number;
  iconPositionY?: number;
  iconScale?: number;
};

type Props = {
  service: Service | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
};

const MAX_FILE_SIZE = 2 * 1024 * 1024;

const allowedTypes = [
  'image/png',
  'image/jpeg',
  'image/svg+xml',
];

const allowedExts = ['.png', '.jpg', '.jpeg', '.svg'];

function isAllowedIconFile(file: File) {
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
        reject(new Error('Не удалось подготовить изображение'));
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

export default function EditServiceModal({
  service,
  onClose,
  onSaved,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState('');
  const [durationMinutes, setDurationMinutes] = useState('');
  const [bufferMinutes, setBufferMinutes] = useState('0');
  const [priceKzt, setPriceKzt] = useState('');

  const [iconUrl, setIconUrl] = useState('');
  const [iconPositionX, setIconPositionX] = useState(50);
  const [iconPositionY, setIconPositionY] = useState(50);
  const [iconScale, setIconScale] = useState(1);
  const [iconUploadedAt, setIconUploadedAt] = useState(Date.now());

  const [selectedIconFile, setSelectedIconFile] =
    useState<File | null>(null);

  const [saving, setSaving] = useState(false);
  const [uploadingIcon, setUploadingIcon] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (service) {
      setName(service.name);
      setDurationMinutes(String(service.durationMinutes));
      setBufferMinutes(String(service.bufferMinutes));
      setPriceKzt(String(service.priceKzt));

      setIconUrl(service.iconUrl || '');
      setIconPositionX(service.iconPositionX ?? 50);
      setIconPositionY(service.iconPositionY ?? 50);
      setIconScale(service.iconScale ?? 1);
      setIconUploadedAt(Date.now());
    } else {
      setName('');
      setDurationMinutes('');
      setBufferMinutes('0');
      setPriceKzt('');

      setIconUrl('');
      setIconPositionX(50);
      setIconPositionY(50);
      setIconScale(1);
      setIconUploadedAt(Date.now());
    }

    setSelectedIconFile(null);
    setSaving(false);
    setUploadingIcon(false);
    setSaved(false);
    setError('');
  }, [service]);

  if (!service) return null;

  const handleIconFileSelected = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];

    if (!file) return;

    setError('');

    if (!isAllowedIconFile(file)) {
      setError('Допустимы только PNG, JPG, JPEG или SVG.');
      event.target.value = '';
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setError('Размер иконки не должен превышать 2 MB.');
      event.target.value = '';
      return;
    }

    setSelectedIconFile(file);
    event.target.value = '';
  };

  const handleIconCropSave = async (
    blob: Blob,
    positionX: number,
    positionY: number,
    scale: number,
  ) => {
    setUploadingIcon(true);
    setError('');
    setSaved(false);

    try {
      if (blob.size > 500 * 1024) {
        throw new Error(
          'Иконка получилась больше 500 KB. Попробуйте уменьшить масштаб.',
        );
      }

      const iconBase64 = await blobToBase64(blob);

      const uploadServiceIcon = httpsCallable(
        getFirebaseFunctions(),
        'uploadServiceIcon',
      );

      const result = await uploadServiceIcon({
        serviceId: service.id,
        iconBase64,
      });

      const uploadedIconUrl = (
        result.data as { iconUrl: string }
      ).iconUrl;

      setIconUrl(uploadedIconUrl);
      setIconPositionX(positionX);
      setIconPositionY(positionY);
      setIconScale(scale);
      setIconUploadedAt(Date.now());
      setSelectedIconFile(null);

      const updateService = httpsCallable(
        getFirebaseFunctions(),
        'updateService',
      );

      try {
        await updateService({
          serviceId: service.id,
          iconUrl: uploadedIconUrl,
          iconPositionX: positionX,
          iconPositionY: positionY,
          iconScale: scale,
        });

        setSaved(true);
      } catch {
        setError(
          'Иконка загружена, но не сохранена. Попробуйте ещё раз',
        );
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Не удалось загрузить иконку',
      );
    } finally {
      setUploadingIcon(false);
    }
  };

  const handleSave = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    setSaving(true);
    setSaved(false);
    setError('');

    try {
      const updateService = httpsCallable(
        getFirebaseFunctions(),
        'updateService',
      );

      await updateService({
        serviceId: service.id,
        name: name.trim(),
        durationMinutes: Number(durationMinutes),
        bufferMinutes: Number(bufferMinutes),
        priceKzt: Number(priceKzt),
        ...(iconUrl
          ? {
              iconUrl,
              iconPositionX,
              iconPositionY,
              iconScale,
            }
          : {}),
      });

      await onSaved();

      setSaving(false);
      setSaved(true);
      window.setTimeout(onClose, 2000);
    } catch (err) {
      setSaving(false);
      setError(
        err instanceof Error
          ? err.message
          : 'Не удалось сохранить услугу',
      );
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">
            Редактировать услугу
          </h2>

          <button
            type="button"
            onClick={onClose}
            disabled={saving || uploadingIcon}
            className="text-2xl text-gray-400 hover:text-gray-600 disabled:opacity-50"
            aria-label="Закрыть"
          >
            ×
          </button>
        </div>

        {error && (
          <p className="mb-4 rounded bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        )}

        {saved && (
          <p className="mb-4 rounded bg-green-50 p-3 text-sm text-green-700">
            Сохранено
          </p>
        )}

        <div className="mb-5 rounded-lg border p-4">
          <div className="mb-3 text-sm font-medium text-gray-700">
            Иконка услуги
          </div>

          <div className="flex items-center gap-4">
            <div className="h-16 w-16 overflow-hidden rounded-xl border bg-gray-50">
              {iconUrl ? (
                <img
                  src={`${iconUrl}?v=${iconUploadedAt}`}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-xl font-semibold text-gray-400">
                  {name.trim().charAt(0).toUpperCase() || 'У'}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={saving || uploadingIcon}
              className="rounded border px-4 py-2 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              {uploadingIcon
                ? 'Загрузка...'
                : iconUrl
                  ? 'Изменить'
                  : 'Загрузить иконку'}
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/svg+xml"
              onChange={handleIconFileSelected}
              className="hidden"
            />
          </div>
        </div>

        {selectedIconFile && (
          <div className="mb-5 rounded-lg border p-4">
            <IconCropper
              file={selectedIconFile}
              initialPositionX={iconPositionX}
              initialPositionY={iconPositionY}
              initialScale={iconScale}
              onSave={(blob, positionX, positionY, scale) => {
                void handleIconCropSave(
                  blob,
                  positionX,
                  positionY,
                  scale,
                );
              }}
              onCancel={() => setSelectedIconFile(null)}
            />
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-4">
          <label className="block">
            <span className="text-sm text-gray-700">
              Название *
            </span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              disabled={saving || uploadingIcon}
              className="mt-1 w-full rounded border px-3 py-2"
            />
          </label>

          <label className="block">
            <span className="text-sm text-gray-700">
              Длительность (минуты) *
            </span>
            <input
              type="number"
              min={1}
              value={durationMinutes}
              onChange={(e) =>
                setDurationMinutes(e.target.value)
              }
              required
              disabled={saving || uploadingIcon}
              className="mt-1 w-full rounded border px-3 py-2"
            />
          </label>

          <label className="block">
            <span className="text-sm text-gray-700">
              Буфер (минуты)
            </span>
            <input
              type="number"
              min={0}
              value={bufferMinutes}
              onChange={(e) =>
                setBufferMinutes(e.target.value)
              }
              disabled={saving || uploadingIcon}
              className="mt-1 w-full rounded border px-3 py-2"
            />
          </label>

          <label className="block">
            <span className="text-sm text-gray-700">
              Цена (₸) *
            </span>
            <input
              type="number"
              min={0}
              value={priceKzt}
              onChange={(e) => setPriceKzt(e.target.value)}
              required
              disabled={saving || uploadingIcon}
              className="mt-1 w-full rounded border px-3 py-2"
            />
          </label>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving || uploadingIcon}
              className="rounded border px-4 py-2 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Отмена
            </button>

            <button
              type="submit"
              disabled={saving || uploadingIcon || saved}
              className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Сохранение...' : 'Сохранить'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}