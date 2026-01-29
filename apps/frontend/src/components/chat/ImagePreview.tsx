'use client';

interface ImagePreviewProps {
  images: File[];
  onRemove: (index: number) => void;
}

export function ImagePreview({ images, onRemove }: ImagePreviewProps) {
  if (images.length === 0) return null;

  return (
    <div className="flex gap-2 p-2 bg-gray-50 border-t border-gray-200 overflow-x-auto">
      {images.map((file, index) => (
        <div key={index} className="relative flex-shrink-0">
          <div className="w-20 h-20 rounded-lg overflow-hidden border border-gray-300">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={URL.createObjectURL(file)}
              alt={`Preview ${index + 1}`}
              className="w-full h-full object-cover"
            />
          </div>
          <button
            onClick={() => onRemove(index)}
            className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-sm hover:bg-red-600 transition-colors"
            aria-label="Eliminar imagen"
          >
            &times;
          </button>
        </div>
      ))}
    </div>
  );
}
