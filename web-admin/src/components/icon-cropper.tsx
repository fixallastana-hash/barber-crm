'use client';

import { useEffect, useRef, useState } from 'react';

type Props = {
  file: File;
  initialPositionX?: number;
  initialPositionY?: number;
  initialScale?: number;
  aspect?: number;
  outputWidth?: number;
  maxBlobSize?: number;
  onSave: (
    blob: Blob,
    positionX: number,
    positionY: number,
    scale: number,
  ) => void;
  onCancel: () => void;
};

const MIN_SCALE = 1;
const MAX_SCALE = 3;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function IconCropper({
  file,
  initialPositionX = 50,
  initialPositionY = 50,
  initialScale = 1,
  aspect = 1,
  outputWidth = 256,
  maxBlobSize = 500 * 1024,
  onSave,
  onCancel,
}: Props) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const objectUrlRef = useRef<string | null>(null);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    startPositionX: number;
    startPositionY: number;
  } | null>(null);

  const [imageSrc, setImageSrc] = useState('');
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  const [positionX, setPositionX] = useState(
    clamp(initialPositionX, 0, 100),
  );
  const [positionY, setPositionY] = useState(
    clamp(initialPositionY, 0, 100),
  );
  const [scale, setScale] = useState(
    clamp(initialScale, MIN_SCALE, MAX_SCALE),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const update = () =>
      setViewportSize({ width: el.clientWidth, height: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const objectUrl = URL.createObjectURL(file);
    objectUrlRef.current = objectUrl;
    setImageSrc(objectUrl);
    setPositionX(clamp(initialPositionX, 0, 100));
    setPositionY(clamp(initialPositionY, 0, 100));
    setScale(clamp(initialScale, MIN_SCALE, MAX_SCALE));
    setError('');
    setSaving(false);

    return () => {
      URL.revokeObjectURL(objectUrl);
      objectUrlRef.current = null;
    };
  }, [file, initialPositionX, initialPositionY, initialScale]);

  const handleImageLoad = () => {
    const image = imageRef.current;
    if (!image) return;

    setImageSize({
      width: image.naturalWidth,
      height: image.naturalHeight,
    });
  };

  const handlePointerDown = (
    event: React.PointerEvent<HTMLDivElement>,
  ) => {
    if (saving || !imageSize.width || !imageSize.height) return;

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);

    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startPositionX: positionX,
      startPositionY: positionY,
    };
  };

  const handlePointerMove = (
    event: React.PointerEvent<HTMLDivElement>,
  ) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    event.preventDefault();

    const viewport = viewportRef.current;
    if (!viewport) return;

    const coverScale = Math.max(
      viewport.clientWidth / imageSize.width,
      viewport.clientHeight / imageSize.height,
    );

    const drawWidth = imageSize.width * coverScale * scale;
    const drawHeight = imageSize.height * coverScale * scale;

    const overflowX = Math.max(0, drawWidth - viewport.clientWidth);
    const overflowY = Math.max(0, drawHeight - viewport.clientHeight);

    const deltaX = event.clientX - drag.startX;
    const deltaY = event.clientY - drag.startY;

    const nextPositionX =
      overflowX === 0
        ? 50
        : clamp(
            drag.startPositionX - (deltaX / overflowX) * 100,
            0,
            100,
          );

    const nextPositionY =
      overflowY === 0
        ? 50
        : clamp(
            drag.startPositionY - (deltaY / overflowY) * 100,
            0,
            100,
          );

    setPositionX(nextPositionX);
    setPositionY(nextPositionY);
  };

  const releasePointer = (
    event: React.PointerEvent<HTMLDivElement>,
  ) => {
    const drag = dragRef.current;

    if (drag?.pointerId === event.pointerId) {
      dragRef.current = null;

      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    }
  };

  const handleSave = async () => {
    const image = imageRef.current;

    if (!image || !imageSize.width || !imageSize.height) {
      setError('Не удалось подготовить изображение');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const outputHeight = Math.max(1, Math.round(outputWidth / aspect));

      const canvas = document.createElement('canvas');
      canvas.width = outputWidth;
      canvas.height = outputHeight;

      const context = canvas.getContext('2d');

      if (!context) {
        throw new Error('Не удалось обработать изображение');
      }

      const coverScale = Math.max(
        outputWidth / imageSize.width,
        outputHeight / imageSize.height,
      );

      const finalScale = coverScale * scale;
      const drawWidth = imageSize.width * finalScale;
      const drawHeight = imageSize.height * finalScale;

      const offsetX =
        -(drawWidth - outputWidth) * (positionX / 100);
      const offsetY =
        -(drawHeight - outputHeight) * (positionY / 100);

      context.clearRect(0, 0, outputWidth, outputHeight);
      context.drawImage(
        image,
        offsetX,
        offsetY,
        drawWidth,
        drawHeight,
      );

      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob(resolve, 'image/png');
      });

      if (!blob) {
        throw new Error('Не удалось создать PNG');
      }

      if (blob.size > maxBlobSize) {
        throw new Error(
          'Изображение получилось слишком большим. Уменьшите масштаб или выберите другое фото.',
        );
      }

      onSave(blob, positionX, positionY, scale);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Не удалось сохранить иконку',
      );
    } finally {
      setSaving(false);
    }
  };

  const previewDimensions = (() => {
    if (!imageSize.width || !imageSize.height || !viewportSize.width || !viewportSize.height) {
      return { width: 0, height: 0 };
    }

    const coverScale = Math.max(
      viewportSize.width / imageSize.width,
      viewportSize.height / imageSize.height,
    );

    return {
      width: imageSize.width * coverScale * scale,
      height: imageSize.height * coverScale * scale,
    };
  })();

  const previewLeft =
    viewportSize.width > 0
      ? -(previewDimensions.width - viewportSize.width) * (positionX / 100)
      : 0;

  const previewTop =
    viewportSize.height > 0
      ? -(previewDimensions.height - viewportSize.height) * (positionY / 100)
      : 0;

  return (
    <div className="space-y-4">
      <div
        ref={viewportRef}
        className="relative mx-auto w-full max-w-[420px] overflow-hidden rounded-2xl border border-gray-200 bg-gray-100"
        style={{ touchAction: 'none', aspectRatio: String(aspect) }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={releasePointer}
        onPointerCancel={releasePointer}
      >
        {imageSrc && (
          <img
            ref={imageRef}
            src={imageSrc}
            alt="Предпросмотр иконки"
            onLoad={handleImageLoad}
            draggable={false}
            className="pointer-events-none absolute max-w-none select-none"
            style={{
              width: previewDimensions.width,
              height: previewDimensions.height,
              left: previewLeft,
              top: previewTop,
            }}
          />
        )}

        <div className="pointer-events-none absolute inset-0 rounded-2xl ring-2 ring-white/90" />
      </div>

      <label className="block">
        <div className="mb-2 flex items-center justify-between text-sm text-gray-700">
          <span>Масштаб</span>
          <span>{scale.toFixed(1)}×</span>
        </div>
        <input
          type="range"
          min={MIN_SCALE}
          max={MAX_SCALE}
          step={0.05}
          value={scale}
          onChange={(event) => {
            setScale(Number(event.target.value));
          }}
          disabled={saving}
          className="w-full"
        />
      </label>

      {error && (
        <p className="rounded bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="rounded border px-4 py-2 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          Отмена
        </button>

        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={saving || !imageSize.width}
          className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? 'Подготовка...' : 'Сохранить'}
        </button>
      </div>
    </div>
  );
}