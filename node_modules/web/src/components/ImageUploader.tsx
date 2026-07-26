import React, { useState, useRef } from 'react';
import { Upload, X } from 'lucide-react';

interface ImageUploaderProps {
  images: string[]; // Base64 data URLs
  onChange: (images: string[]) => void;
  maxFiles?: number;
}

export const ImageUploader: React.FC<ImageUploaderProps> = ({
  images,
  onChange,
  maxFiles = 4
}) => {
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFiles = (files: FileList | File[]) => {
    setErrorMsg('');
    const validFiles: File[] = [];

    Array.from(files).forEach(file => {
      if (!['image/jpeg', 'image/png', 'image/jpg', 'image/webp'].includes(file.type)) {
        setErrorMsg('Only JPG, JPEG, PNG, and WEBP formats are supported.');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        setErrorMsg('File size must be less than 5MB.');
        return;
      }
      validFiles.push(file);
    });

    if (validFiles.length === 0) return;

    if (images.length + validFiles.length > maxFiles) {
      setErrorMsg(`Maximum ${maxFiles} images allowed per request.`);
      return;
    }

    setUploadProgress(10);
    let completed = 0;
    const newImages: string[] = [];

    validFiles.forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) {
          newImages.push(e.target.result as string);
        }
        completed++;
        setUploadProgress(Math.round((completed / validFiles.length) * 100));

        if (completed === validFiles.length) {
          setTimeout(() => {
            onChange([...images, ...newImages]);
            setUploadProgress(null);
          }, 300);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(e.target.files);
    }
  };

  const handleRemove = (index: number) => {
    const updated = images.filter((_, idx) => idx !== index);
    onChange(updated);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        style={{
          border: `2px dashed ${isDragging ? '#0f766e' : '#cbd5e1'}`,
          borderRadius: '10px',
          backgroundColor: isDragging ? '#e2f5f3' : '#f8fafc',
          padding: '20px',
          textAlign: 'center',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px'
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/jpg,image/png,image/webp"
          multiple
          onChange={handleFileSelect}
          style={{ display: 'none' }}
        />

        <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: 'rgba(15,118,110,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Upload size={20} color="#0f766e" />
        </div>

        <div style={{ fontSize: '13px', fontWeight: '700', color: '#0f172a' }}>
          Drag & Drop Job Site Photos or <span style={{ color: '#0f766e', textDecoration: 'underline' }}>Browse Files</span>
        </div>

        <span style={{ fontSize: '11px', color: '#64748b' }}>
          Supports JPG, PNG, WEBP up to 5MB (Max {maxFiles} photos)
        </span>
      </div>

      {uploadProgress !== null && (
        <div style={{ width: '100%', backgroundColor: '#e2e8f0', borderRadius: '4px', height: '6px', overflow: 'hidden' }}>
          <div
            style={{
              width: `${uploadProgress}%`,
              backgroundColor: '#0f766e',
              height: '100%',
              transition: 'width 0.2s ease'
            }}
          />
        </div>
      )}

      {errorMsg && (
        <div style={{ fontSize: '11px', color: '#e11d48', fontWeight: '600' }}>
          ⚠️ {errorMsg}
        </div>
      )}

      {/* THUMBNAIL PREVIEWS */}
      {images.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: '10px', marginTop: '4px' }}>
          {images.map((imgUrl, idx) => (
            <div key={idx} style={{ position: 'relative', width: '100%', height: '80px', borderRadius: '8px', overflow: 'hidden', border: '1px solid #cbd5e1', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
              <img src={imgUrl} alt={`Job Photo ${idx + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemove(idx);
                }}
                style={{
                  position: 'absolute',
                  top: '4px',
                  right: '4px',
                  backgroundColor: 'rgba(15, 23, 42, 0.7)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '50%',
                  width: '20px',
                  height: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer'
                }}
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ImageUploader;
