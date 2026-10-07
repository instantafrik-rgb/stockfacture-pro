/**
 * Image processing utilities for StockFacture Pro
 * Resizes and compresses images client-side to ensure:
 * - Tiny footprint in IndexedDB and Firestore (10-25 KB max)
 * - Fast loading and smooth rendering on low-end mobile / Android devices
 * - Persistent availability across offline sync and backup/restore
 */

export async function compressImageFile(
  file: File,
  maxDimension: number = 240,
  quality: number = 0.75
): Promise<string> {
  return new Promise((resolve, reject) => {
    // Basic format validation
    if (!file.type.startsWith('image/')) {
      return reject(new Error('Le fichier sélectionné n\'est pas une image valide.'));
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        try {
          let { width, height } = img;

          // Scale down if either dimension exceeds maxDimension
          if (width > maxDimension || height > maxDimension) {
            if (width > height) {
              height = Math.round((height * maxDimension) / width);
              width = maxDimension;
            } else {
              width = Math.round((width * maxDimension) / height);
              height = maxDimension;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            return reject(new Error('Impossible d\'initialiser le contexte canvas pour l\'image.'));
          }

          // Crisp image rendering
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';

          // Draw scaled image
          ctx.drawImage(img, 0, 0, width, height);

          // Output as JPEG data URL (universal compatibility & light weight)
          const dataUrl = canvas.toDataURL('image/jpeg', quality);
          resolve(dataUrl);
        } catch (err) {
          reject(err);
        }
      };

      img.onerror = () => {
        reject(new Error('Impossible de charger l\'image pour la compression.'));
      };

      img.src = e.target?.result as string;
    };

    reader.onerror = () => {
      reject(new Error('Erreur de lecture du fichier image.'));
    };

    reader.readAsDataURL(file);
  });
}
