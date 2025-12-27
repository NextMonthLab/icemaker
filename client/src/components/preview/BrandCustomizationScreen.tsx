import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Sun, Moon, Check, ArrowRight, Palette, ImageIcon, Sparkles, LayoutGrid } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface BrandCustomizationScreenProps {
  logoUrl: string | null;
  faviconUrl: string | null;
  brandName: string;
  defaultAccentColor: string;
  imagePool: string[];
  onConfirm: (preferences: BrandPreferences, spatial?: boolean) => void;
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
  const [selectedImages, setSelectedImages] = useState<string[]>(imagePool.slice(0, 3));
  const [useSpatial, setUseSpatial] = useState(true);

  const allLogoCandidates = [
    ...(logoUrl ? [logoUrl] : []),
    ...(faviconUrl && faviconUrl !== logoUrl ? [faviconUrl] : []),
    ...imagePool.filter(img => !img.includes('scaled') && !img.includes('Photography')),
  ].slice(0, 6);

  const toggleImageSelection = useCallback((img: string) => {
    setSelectedImages(prev => 
      prev.includes(img) 
        ? prev.filter(i => i !== img)
        : [...prev, img].slice(0, 6)
    );
  }, []);

  const handleConfirm = useCallback(() => {
    onConfirm({ accentColor, theme, selectedLogo, selectedImages }, useSpatial);
  }, [accentColor, theme, selectedLogo, selectedImages, onConfirm, useSpatial]);

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
            Customize your Smart Site appearance
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
                  className="w-16 h-16 rounded-xl flex items-center justify-center p-2 transition-all relative overflow-hidden"
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
            
            <ScrollArea className="w-full">
              <div className="flex gap-2 pb-2">
                {imagePool.slice(0, 8).map((img, i) => (
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
            </ScrollArea>
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
          
          <div className="grid grid-cols-7 gap-2 justify-items-center max-w-xs mx-auto">
            {presetColors.map((color) => (
              <button
                key={color}
                onClick={() => setAccentColor(color)}
                className="w-8 h-8 rounded-full transition-all relative"
                style={{
                  backgroundColor: color,
                  boxShadow: accentColor === color 
                    ? `0 0 0 2px ${bgColor}, 0 0 0 4px ${color}` 
                    : 'none',
                  border: color === '#ffffff' || color === '#f5f5f5' ? `1px solid ${borderColor}` : 'none',
                }}
                data-testid={`color-option-${color.replace('#', '')}`}
              >
                {accentColor === color && (
                  <Check 
                    className="w-4 h-4 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
                    style={{ color: color === '#ffffff' || color === '#f5f5f5' ? '#000' : '#fff' }}
                  />
                )}
              </button>
            ))}
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
          transition={{ delay: 0.45 }}
          className="space-y-3"
        >
          <span className="text-sm font-medium block text-center" style={{ color: mutedColor }}>
            Experience
          </span>
          
          <div 
            className="flex rounded-full p-1 mx-auto w-fit"
            style={{ backgroundColor: theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }}
          >
            <button
              onClick={() => setUseSpatial(true)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-full transition-all text-sm font-medium"
              style={{
                backgroundColor: useSpatial ? accentColor : 'transparent',
                color: useSpatial ? (accentColor === '#ffffff' ? '#000' : '#fff') : mutedColor,
              }}
              data-testid="experience-spatial"
            >
              <Sparkles className="w-4 h-4" />
              AI Concierge
            </button>
            <button
              onClick={() => setUseSpatial(false)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-full transition-all text-sm font-medium"
              style={{
                backgroundColor: !useSpatial ? accentColor : 'transparent',
                color: !useSpatial ? (accentColor === '#ffffff' ? '#000' : '#fff') : mutedColor,
              }}
              data-testid="experience-classic"
            >
              <LayoutGrid className="w-4 h-4" />
              Classic
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
