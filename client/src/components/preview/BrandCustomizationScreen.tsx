import { useState, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import { Sun, Moon, Check, ArrowRight, Palette, ImageIcon, Sparkles, LayoutGrid, Radar } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

export type ExperienceType = 'radar' | 'spatial' | 'classic';

interface BrandCustomizationScreenProps {
  logoUrl: string | null;
  faviconUrl: string | null;
  brandName: string;
  defaultAccentColor: string;
  imagePool: string[];
  onConfirm: (preferences: BrandPreferences, experienceType?: ExperienceType) => void;
}

export interface BrandPreferences {
  accentColor: string;
  theme: 'dark' | 'light';
  selectedLogo: string | null;
  selectedImages: string[];
}

const presetColors = [
  '#ffffff',
  '#f5f5f5',
  '#94a3b8',
  '#64748b',
  '#ef4444',
  '#dc2626',
  '#f97316',
  '#ea580c',
  '#eab308',
  '#ca8a04',
  '#22c55e',
  '#16a34a',
  '#14b8a6',
  '#0d9488',
  '#06b6d4',
  '#0891b2',
  '#3b82f6',
  '#2563eb',
  '#6366f1',
  '#4f46e5',
  '#8b5cf6',
  '#7c3aed',
  '#a855f7',
  '#9333ea',
  '#ec4899',
  '#db2777',
  '#f43f5e',
  '#e11d48',
];

function hexToHue(hex: string): number {
  if (hex.startsWith('hsl')) {
    const match = hex.match(/hsl\((\d+)/);
    return match ? parseInt(match[1]) / 360 : 0.5;
  }
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  if (max !== min) {
    const d = max - min;
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return h;
}

export function BrandCustomizationScreen({
  logoUrl,
  faviconUrl,
  brandName,
  defaultAccentColor,
  imagePool,
  onConfirm,
}: BrandCustomizationScreenProps) {
  const [accentColor, setAccentColor] = useState(defaultAccentColor || '#ffffff');
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [selectedLogo, setSelectedLogo] = useState<string | null>(logoUrl || faviconUrl);
  const [selectedImages, setSelectedImages] = useState<string[]>(imagePool);
  const [experienceType, setExperienceType] = useState<ExperienceType>('radar');
  const [huePosition, setHuePosition] = useState(() => hexToHue(defaultAccentColor || '#3b82f6'));
  const spectrumRef = useRef<HTMLDivElement>(null);
  
  const handleColorChange = useCallback((color: string, updateHue = true) => {
    setAccentColor(color);
    if (updateHue) {
      setHuePosition(hexToHue(color));
    }
  }, []);

  const allLogoCandidates = [
    ...(logoUrl ? [logoUrl] : []),
    ...(faviconUrl && faviconUrl !== logoUrl ? [faviconUrl] : []),
    ...imagePool.filter(img => !img.includes('scaled') && !img.includes('Photography')),
  ].slice(0, 6);

  const toggleImageSelection = useCallback((img: string) => {
    setSelectedImages(prev => 
      prev.includes(img) 
        ? prev.filter(i => i !== img)
        : [...prev, img]
    );
  }, []);

  const handleConfirm = useCallback(() => {
    onConfirm({ accentColor, theme, selectedLogo, selectedImages }, experienceType);
  }, [accentColor, theme, selectedLogo, selectedImages, onConfirm, experienceType]);

  const bgColor = theme === 'dark' ? '#0a0a0a' : '#f5f5f5';
  const textColor = theme === 'dark' ? 'white' : 'black';
  const mutedColor = theme === 'dark' ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)';
  const borderColor = theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex flex-col overflow-y-auto"
      style={{ backgroundColor: bgColor }}
      data-testid="brand-customization-screen"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.1 }}
        className="w-full max-w-md mx-auto space-y-6 px-5 py-8 pb-safe"
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-center"
        >
          <h1 
            className="text-2xl font-semibold mb-2"
            style={{ color: textColor }}
          >
            {brandName}
          </h1>
          <p className="text-sm" style={{ color: mutedColor }}>
            Customize your Orbit appearance
          </p>
        </motion.div>

        {allLogoCandidates.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="space-y-3"
          >
            <div className="flex items-center gap-2">
              <ImageIcon className="w-4 h-4" style={{ color: mutedColor }} />
              <span className="text-sm font-medium" style={{ color: mutedColor }}>
                Select Logo
              </span>
            </div>
            
            <div className="flex gap-3 justify-center flex-wrap">
              {allLogoCandidates.map((img, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedLogo(img)}
                  className="w-20 h-20 rounded-xl flex items-center justify-center p-2.5 transition-all relative overflow-hidden"
                  style={{
                    backgroundColor: theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
                    border: selectedLogo === img 
                      ? `2px solid ${accentColor}` 
                      : `1px solid ${borderColor}`,
                    boxShadow: selectedLogo === img ? `0 0 12px ${accentColor}40` : 'none',
                  }}
                  data-testid={`logo-option-${i}`}
                >
                  <img
                    src={img}
                    alt=""
                    className="max-w-full max-h-full object-contain"
                    style={{ filter: theme === 'dark' ? 'brightness(1.1)' : 'none' }}
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                  {selectedLogo === img && (
                    <div 
                      className="absolute top-1 right-1 w-4 h-4 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: accentColor }}
                    >
                      <Check className="w-3 h-3" style={{ color: accentColor === '#ffffff' ? '#000' : '#fff' }} />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {imagePool.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="space-y-3"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ImageIcon className="w-4 h-4" style={{ color: mutedColor }} />
                <span className="text-sm font-medium" style={{ color: mutedColor }}>
                  Include Images ({selectedImages.length})
                </span>
              </div>
            </div>
            
            <div 
              className="w-full overflow-x-auto pb-2"
              style={{ 
                WebkitOverflowScrolling: 'touch',
                scrollbarWidth: 'none',
                msOverflowStyle: 'none',
              }}
            >
              <div className="flex gap-2" style={{ minWidth: 'max-content' }}>
                {imagePool.map((img, i) => (
                  <button
                    key={i}
                    onClick={() => toggleImageSelection(img)}
                    className="shrink-0 w-20 h-14 rounded-lg overflow-hidden relative transition-all"
                    style={{
                      border: selectedImages.includes(img) 
                        ? `2px solid ${accentColor}` 
                        : `1px solid ${borderColor}`,
                      opacity: selectedImages.includes(img) ? 1 : 0.6,
                    }}
                    data-testid={`image-option-${i}`}
                  >
                    <img
                      src={img}
                      alt=""
                      className="w-full h-full object-cover"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                    {selectedImages.includes(img) && (
                      <div 
                        className="absolute top-1 right-1 w-4 h-4 rounded-full flex items-center justify-center"
                        style={{ backgroundColor: accentColor }}
                      >
                        <Check className="w-3 h-3" style={{ color: accentColor === '#ffffff' ? '#000' : '#fff' }} />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="space-y-4"
        >
          <div className="flex items-center gap-2 mb-3">
            <Palette className="w-4 h-4" style={{ color: mutedColor }} />
            <span className="text-sm font-medium" style={{ color: mutedColor }}>
              Accent Color
            </span>
          </div>
          
          {/* Color Spectrum Slider */}
          <div className="space-y-3">
            <div 
              ref={spectrumRef}
              className="relative h-12 rounded-full cursor-pointer mx-auto"
              style={{ 
                maxWidth: '280px',
                background: 'linear-gradient(to right, #ff0000, #ff8000, #ffff00, #80ff00, #00ff00, #00ff80, #00ffff, #0080ff, #0000ff, #8000ff, #ff00ff, #ff0080, #ff0000)',
              }}
              onPointerDown={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const updateHue = (clientX: number) => {
                  const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
                  const percentage = x / rect.width;
                  setHuePosition(percentage);
                  const hue = Math.round(percentage * 360);
                  setAccentColor(`hsl(${hue}, 70%, 50%)`);
                };
                
                updateHue(e.clientX);
                e.currentTarget.setPointerCapture(e.pointerId);
                
                const handleMove = (moveEvent: PointerEvent) => {
                  updateHue(moveEvent.clientX);
                };
                
                const handleUp = () => {
                  document.removeEventListener('pointermove', handleMove);
                  document.removeEventListener('pointerup', handleUp);
                };
                
                document.addEventListener('pointermove', handleMove);
                document.addEventListener('pointerup', handleUp);
              }}
              data-testid="color-spectrum"
            >
              {/* Current color indicator */}
              <div
                className="absolute top-1/2 -translate-y-1/2 w-7 h-7 rounded-full border-3 border-white shadow-lg pointer-events-none"
                style={{ 
                  left: `calc(${huePosition * 100}% - 14px)`,
                  backgroundColor: accentColor,
                  boxShadow: '0 2px 10px rgba(0,0,0,0.4), 0 0 0 2px rgba(255,255,255,0.8)',
                }}
              />
            </div>
            
            {/* Quick preset colors */}
            <div className="flex justify-center gap-1.5">
              {['#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899', '#ffffff'].map((color) => (
                <button
                  key={color}
                  onClick={() => handleColorChange(color)}
                  className="w-5 h-5 rounded-full transition-all"
                  style={{
                    backgroundColor: color,
                    boxShadow: accentColor === color ? `0 0 0 2px ${bgColor}, 0 0 0 3px ${color}` : 'none',
                    border: color === '#ffffff' ? `1px solid ${borderColor}` : 'none',
                    transform: accentColor === color ? 'scale(1.2)' : 'scale(1)',
                  }}
                  data-testid={`quick-color-${color.replace('#', '')}`}
                />
              ))}
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="space-y-3"
        >
          <span className="text-sm font-medium block text-center" style={{ color: mutedColor }}>
            Theme
          </span>
          
          <div 
            className="flex rounded-full p-1 mx-auto w-fit"
            style={{ backgroundColor: theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }}
          >
            <button
              onClick={() => setTheme('dark')}
              className="flex items-center gap-2 px-5 py-2.5 rounded-full transition-all text-sm font-medium"
              style={{
                backgroundColor: theme === 'dark' ? accentColor : 'transparent',
                color: theme === 'dark' ? (accentColor === '#ffffff' ? '#000' : '#fff') : mutedColor,
              }}
              data-testid="theme-dark"
            >
              <Moon className="w-4 h-4" />
              Dark
            </button>
            <button
              onClick={() => setTheme('light')}
              className="flex items-center gap-2 px-5 py-2.5 rounded-full transition-all text-sm font-medium"
              style={{
                backgroundColor: theme === 'light' ? accentColor : 'transparent',
                color: theme === 'light' ? (accentColor === '#ffffff' ? '#000' : '#fff') : mutedColor,
              }}
              data-testid="theme-light"
            >
              <Sun className="w-4 h-4" />
              Light
            </button>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="pt-4 pb-6"
        >
          <button
            onClick={handleConfirm}
            className="w-full py-4 rounded-xl font-medium text-base transition-all flex items-center justify-center gap-2"
            style={{
              backgroundColor: accentColor,
              color: accentColor === '#ffffff' || accentColor === '#f5f5f5' ? '#000' : '#fff',
            }}
            data-testid="button-continue-preview"
          >
            Continue to Preview
            <ArrowRight className="w-5 h-5" />
          </button>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
