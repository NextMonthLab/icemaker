import { useState, useCallback, useRef, type ComponentType } from "react";
import { motion } from "framer-motion";
import { Sun, Moon, Check, ArrowRight, ArrowLeft, Palette, ImageIcon, Sparkles, Upload, X, RefreshCw, Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";

export type ExperienceType = 'radar' | 'spatial' | 'classic';

interface BrandCustomizationScreenProps {
  logoUrl: string | null;
  faviconUrl: string | null;
  brandName: string;
  defaultAccentColor: string;
  imagePool: string[];
  previewId?: string;
  canDeepScan?: boolean;
  isFirstRun?: boolean;
  currentStep?: number;
  totalSteps?: number;
  onConfirm: (preferences: BrandPreferences, experienceType?: ExperienceType) => void;
  onRefreshComplete?: (newData: RefreshResult) => void;
  onBack?: () => void;
  onSkip?: () => void;
}

interface RefreshResult {
  logoUrl: string | null;
  imagePool: string[];
  stats: {
    chars: number;
    images: number;
    hasLogo: boolean;
  };
}

export interface BrandPreferences {
  accentColor: string;
  theme: 'dark' | 'light';
  selectedLogo: string | null;
  selectedImages: string[];
}

interface AccentPreset {
  id: string;
  name: string;
  color: string;
  gradient?: string;
  recommended?: boolean;
}

const accentPresets: AccentPreset[] = [
  { 
    id: 'nextmonth', 
    name: 'NextMonth', 
    color: '#3b82f6', 
    gradient: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
    recommended: true 
  },
  { id: 'ocean', name: 'Ocean', color: '#06b6d4' },
  { id: 'emerald', name: 'Emerald', color: '#10b981' },
  { id: 'amber', name: 'Amber', color: '#f59e0b' },
  { id: 'rose', name: 'Rose', color: '#f43f5e' },
  { id: 'violet', name: 'Violet', color: '#8b5cf6' },
  { id: 'indigo', name: 'Indigo', color: '#6366f1' },
  { id: 'slate', name: 'Slate', color: '#64748b' },
  { id: 'zinc', name: 'Zinc', color: '#a1a1aa' },
  { id: 'white', name: 'White', color: '#ffffff' },
];

const MAX_IMAGES = 12;

function findMatchingPreset(color: string): string | null {
  if (!color) return null;
  const normalizedColor = color.toLowerCase().trim();
  const match = accentPresets.find(p => p.color.toLowerCase() === normalizedColor);
  return match?.id || null;
}

export function BrandCustomizationScreen({
  logoUrl,
  faviconUrl,
  brandName,
  defaultAccentColor,
  imagePool,
  previewId,
  canDeepScan = false,
  isFirstRun = false,
  currentStep = 3,
  totalSteps = 4,
  onConfirm,
  onRefreshComplete,
  onBack,
  onSkip,
}: BrandCustomizationScreenProps) {
  const queryClient = useQueryClient();
  const [selectedPreset, setSelectedPreset] = useState<string | null>(() => {
    const matchedPreset = findMatchingPreset(defaultAccentColor);
    return matchedPreset || 'nextmonth';
  });
  const [accentColor, setAccentColor] = useState(() => {
    const matchedPreset = findMatchingPreset(defaultAccentColor);
    if (matchedPreset) {
      return defaultAccentColor;
    }
    return defaultAccentColor || '#3b82f6';
  });
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [selectedLogo, setSelectedLogo] = useState<string | null>(logoUrl || faviconUrl);
  const [selectedImages, setSelectedImages] = useState<string[]>(() => imagePool.slice(0, MAX_IMAGES));
  const [experienceType] = useState<ExperienceType>('radar');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const handleRefreshSiteData = async () => {
    if (!previewId || isRefreshing) return;
    
    setIsRefreshing(true);
    setRefreshError(null);
    
    try {
      const response = await fetch(`/api/previews/${previewId}/re-extract`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to refresh site data');
      }
      
      const result = await response.json();
      queryClient.invalidateQueries({ queryKey: [`/api/previews/${previewId}`] });
      
      if (onRefreshComplete && result.preview?.siteIdentity) {
        onRefreshComplete({
          logoUrl: result.preview.siteIdentity.logoUrl,
          imagePool: result.preview.siteIdentity.imagePool || [],
          stats: result.stats,
        });
      }
    } catch (error: any) {
      setRefreshError(error.message || 'Failed to refresh site data');
    } finally {
      setIsRefreshing(false);
    }
  };
  
  const handlePresetSelect = useCallback((preset: AccentPreset) => {
    setSelectedPreset(preset.id);
    setAccentColor(preset.color);
  }, []);

  const isPresetSelected = useCallback((presetId: string) => {
    return selectedPreset === presetId;
  }, [selectedPreset]);

  const allLogoCandidates = [
    ...(logoUrl ? [logoUrl] : []),
    ...(faviconUrl && faviconUrl !== logoUrl ? [faviconUrl] : []),
    ...imagePool.filter(img => !img.includes('scaled') && !img.includes('Photography')),
  ].slice(0, 6);

  const displayImages = imagePool.slice(0, MAX_IMAGES);

  const toggleImageSelection = useCallback((img: string) => {
    setSelectedImages(prev => 
      prev.includes(img) 
        ? prev.filter(i => i !== img)
        : prev.length < MAX_IMAGES ? [...prev, img] : prev
    );
  }, []);

  const handleSelectAll = useCallback(() => {
    setSelectedImages(displayImages);
  }, [displayImages]);

  const handleClearAll = useCallback(() => {
    setSelectedImages([]);
  }, []);

  const handleConfirm = useCallback(() => {
    onConfirm({ accentColor, theme, selectedLogo, selectedImages }, experienceType);
  }, [accentColor, theme, selectedLogo, selectedImages, onConfirm, experienceType]);

  const progressPercent = (currentStep / totalSteps) * 100;

  return (
    <div className="min-h-screen bg-black flex flex-col" data-testid="brand-customization-screen">
      {/* Progress Header */}
      <div className="border-b border-white/10 bg-black/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <span className="text-white font-medium">Orbit setup</span>
            </div>
            <span className="text-white/50 text-sm">Step {currentStep} of {totalSteps}</span>
          </div>
          <div className="mt-3 h-1 bg-white/10 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 px-4 py-8 pb-32 overflow-y-auto">
        <div className="max-w-2xl mx-auto space-y-8">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center space-y-2"
          >
            <h1 className="text-2xl md:text-3xl font-bold text-white" data-testid="text-appearance-title">
              {brandName}
            </h1>
            <p className="text-white/60">
              Customise how your Orbit appears to visitors.
            </p>
          </motion.div>

          {/* Setup Mode Status */}
          {isFirstRun && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20"
            >
              <p className="text-sm text-blue-300 text-center">
                Setup mode: confirm branding, then activate.
              </p>
            </motion.div>
          )}

          {/* Refresh Button for Deep Scan */}
          {previewId && canDeepScan && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
            >
              <button
                onClick={handleRefreshSiteData}
                disabled={isRefreshing}
                data-testid="button-refresh-site-data"
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-medium transition-all bg-white/5 border border-white/10 hover:border-white/20 hover:bg-white/[0.07] text-white/60"
              >
                {isRefreshing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Deep scanning website...</span>
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4" />
                    <span>Refresh Site Data (Deep Scan)</span>
                  </>
                )}
              </button>
              {refreshError && (
                <p className="text-xs text-red-400 text-center mt-2">{refreshError}</p>
              )}
            </motion.div>
          )}

          {/* Logo Selection */}
          {allLogoCandidates.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="space-y-4"
            >
              <div className="flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-white/50" />
                <span className="text-sm font-medium text-white/70">Logo</span>
              </div>
              
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                {allLogoCandidates.map((img, i) => {
                  const isRecommended = i === 0 && logoUrl === img;
                  const isSelected = selectedLogo === img;
                  
                  return (
                    <button
                      key={i}
                      onClick={() => setSelectedLogo(img)}
                      className={`
                        relative aspect-square rounded-xl flex items-center justify-center p-3 transition-all
                        focus:outline-none focus:ring-2 focus:ring-blue-500/50
                        ${isSelected
                          ? 'bg-white/[0.07] ring-2 ring-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.15)]'
                          : 'bg-white/5 border border-white/10 hover:border-white/20 hover:bg-white/[0.07]'
                        }
                      `}
                      data-testid={`logo-option-${i}`}
                    >
                      {isRecommended && (
                        <span className="absolute -top-2 right-2 px-2 py-0.5 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 text-white text-xs font-medium">
                          Recommended
                        </span>
                      )}
                      <img
                        src={img}
                        alt=""
                        className="max-w-full max-h-full object-contain"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                      {isSelected && (
                        <div className="absolute top-2 left-2 w-5 h-5 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center">
                          <Check className="w-3 h-3 text-white" />
                        </div>
                      )}
                    </button>
                  );
                })}
                
                {/* Upload Button */}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="aspect-square rounded-xl flex flex-col items-center justify-center gap-2 bg-white/5 border border-dashed border-white/20 hover:border-white/40 hover:bg-white/[0.07] transition-all text-white/50 hover:text-white/70"
                  data-testid="button-upload-logo"
                >
                  <Upload className="w-5 h-5" />
                  <span className="text-xs">Upload</span>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const url = URL.createObjectURL(file);
                      setSelectedLogo(url);
                    }
                  }}
                />
              </div>
            </motion.div>
          )}

          {/* Image Selection Grid */}
          {displayImages.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className="space-y-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-white/50" />
                  <span className="text-sm font-medium text-white/70">
                    Images ({selectedImages.length}/{displayImages.length})
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleSelectAll}
                    className="text-xs text-white/50 hover:text-white/70 transition-colors"
                    data-testid="button-select-all-images"
                  >
                    Select all
                  </button>
                  <span className="text-white/20">|</span>
                  <button
                    onClick={handleClearAll}
                    className="text-xs text-white/50 hover:text-white/70 transition-colors"
                    data-testid="button-clear-images"
                  >
                    Clear
                  </button>
                </div>
              </div>
              
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {displayImages.map((img, i) => {
                  const isSelected = selectedImages.includes(img);
                  
                  return (
                    <button
                      key={i}
                      onClick={() => toggleImageSelection(img)}
                      className={`
                        relative aspect-video rounded-lg overflow-hidden transition-all
                        focus:outline-none focus:ring-2 focus:ring-blue-500/50
                        ${isSelected
                          ? 'ring-2 ring-blue-500 shadow-[0_0_12px_rgba(59,130,246,0.15)]'
                          : 'border border-white/10 opacity-60 hover:opacity-100 hover:border-white/20'
                        }
                      `}
                      data-testid={`image-option-${i}`}
                    >
                      <img
                        src={img}
                        alt=""
                        className="w-full h-full object-cover"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                      {isSelected && (
                        <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center">
                          <Check className="w-2.5 h-2.5 text-white" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
              
              {imagePool.length > MAX_IMAGES && (
                <p className="text-xs text-white/40 text-center">
                  Showing first {MAX_IMAGES} of {imagePool.length} images
                </p>
              )}
            </motion.div>
          )}

          {/* Accent Color Presets */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="space-y-4"
          >
            <div className="flex items-center gap-2">
              <Palette className="w-4 h-4 text-white/50" />
              <span className="text-sm font-medium text-white/70">Accent Colour</span>
            </div>
            
            <div className="grid grid-cols-5 gap-2">
              {accentPresets.map((preset) => {
                const isSelected = selectedPreset === preset.id;
                
                return (
                  <button
                    key={preset.id}
                    onClick={() => handlePresetSelect(preset)}
                    className={`
                      relative flex flex-col items-center gap-1.5 p-3 rounded-xl transition-all
                      focus:outline-none focus:ring-2 focus:ring-blue-500/50
                      ${isSelected
                        ? 'bg-white/[0.07] ring-2 ring-blue-500'
                        : 'bg-white/5 border border-white/10 hover:border-white/20 hover:bg-white/[0.07]'
                      }
                    `}
                    data-testid={`preset-${preset.id}`}
                  >
                    {preset.recommended && (
                      <span className="absolute -top-2 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 text-white text-[10px] font-medium whitespace-nowrap">
                        Recommended
                      </span>
                    )}
                    <div 
                      className={`
                        w-8 h-8 rounded-full transition-all
                        ${isSelected ? 'ring-2 ring-white/50' : ''}
                        ${preset.id === 'white' ? 'border border-white/20' : ''}
                      `}
                      style={{ 
                        background: preset.gradient || preset.color 
                      }}
                    />
                    <span className={`text-xs ${isSelected ? 'text-white' : 'text-white/50'}`}>
                      {preset.name}
                    </span>
                    {isSelected && (
                      <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center">
                        <Check className="w-2.5 h-2.5 text-white" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </motion.div>

          {/* Theme Toggle (Smaller, Secondary) */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="flex items-center justify-center gap-4"
          >
            <span className="text-sm text-white/50">Theme</span>
            <div className="flex rounded-full p-0.5 bg-white/5 border border-white/10">
              <button
                onClick={() => setTheme('dark')}
                className={`
                  flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all text-xs font-medium
                  ${theme === 'dark' 
                    ? 'bg-white/10 text-white' 
                    : 'text-white/50 hover:text-white/70'
                  }
                `}
                data-testid="theme-dark"
              >
                <Moon className="w-3 h-3" />
                Dark
              </button>
              <button
                onClick={() => setTheme('light')}
                className={`
                  flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all text-xs font-medium
                  ${theme === 'light' 
                    ? 'bg-white/10 text-white' 
                    : 'text-white/50 hover:text-white/70'
                  }
                `}
                data-testid="theme-light"
              >
                <Sun className="w-3 h-3" />
                Light
              </button>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Sticky Bottom Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-black/90 backdrop-blur-sm border-t border-white/10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
          {onBack ? (
            <Button
              onClick={onBack}
              variant="ghost"
              className="text-white/60 hover:text-white hover:bg-white/5"
              data-testid="button-back"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-3">
            {onSkip && (
              <button
                onClick={onSkip}
                className="text-sm text-white/40 hover:text-white/60 transition-colors"
                data-testid="button-skip"
              >
                Skip for now
              </button>
            )}
            <Button
              onClick={handleConfirm}
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
              data-testid="button-continue-preview"
            >
              Continue
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
