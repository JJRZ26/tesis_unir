'use client';

import { useState, useRef, KeyboardEvent, ChangeEvent } from 'react';
import { ImagePreview } from './ImagePreview';

interface MessageInputProps {
  onSend: (text: string, images?: File[]) => void;
  disabled?: boolean;
  placeholder?: string;
}

const MAX_IMAGES = 5;
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

export function MessageInput({
  onSend,
  disabled = false,
  placeholder = 'Escribe un mensaje...',
}: MessageInputProps) {
  const [text, setText] = useState('');
  const [images, setImages] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = () => {
    if (disabled) return;

    const trimmedText = text.trim();
    if (!trimmedText && images.length === 0) return;

    onSend(trimmedText, images.length > 0 ? images : undefined);
    setText('');
    setImages([]);

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleTextChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);

    // Auto-resize textarea
    const textarea = e.target;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 150)}px`;
  };

  const handleImageSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);

    const validFiles = files.filter((file) => {
      if (!ACCEPTED_TYPES.includes(file.type)) {
        console.warn(`Tipo de archivo no soportado: ${file.type}`);
        return false;
      }
      return true;
    });

    const newImages = [...images, ...validFiles].slice(0, MAX_IMAGES);
    setImages(newImages);

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemoveImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAttachClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="border-t border-gray-200 bg-white">
      <ImagePreview images={images} onRemove={handleRemoveImage} />

      <div className="flex items-end gap-2 p-3">
        {/* Attach button */}
        <button
          type="button"
          onClick={handleAttachClick}
          disabled={disabled || images.length >= MAX_IMAGES}
          className={`p-2 rounded-full transition-colors ${
            disabled || images.length >= MAX_IMAGES
              ? 'text-gray-300 cursor-not-allowed'
              : 'text-gray-500 hover:text-sorti-primary hover:bg-gray-100'
          }`}
          aria-label="Adjuntar imagen"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
        </button>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_TYPES.join(',')}
          multiple
          onChange={handleImageSelect}
          className="hidden"
        />

        {/* Text input */}
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={handleTextChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled}
            rows={1}
            className={`w-full resize-none rounded-2xl border border-gray-300 px-4 py-2 pr-12 focus:outline-none focus:border-sorti-primary transition-colors ${
              disabled ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'
            }`}
            style={{ maxHeight: '150px' }}
          />
        </div>

        {/* Send button */}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={disabled || (!text.trim() && images.length === 0)}
          className={`p-2 rounded-full transition-colors ${
            disabled || (!text.trim() && images.length === 0)
              ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
              : 'bg-sorti-primary text-white hover:bg-sorti-secondary'
          }`}
          aria-label="Enviar mensaje"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
            />
          </svg>
        </button>
      </div>

      {/* Image count indicator */}
      {images.length > 0 && (
        <div className="px-3 pb-2 text-xs text-gray-500">
          {images.length} de {MAX_IMAGES} imágenes adjuntas
        </div>
      )}
    </div>
  );
}
