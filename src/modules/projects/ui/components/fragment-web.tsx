import { useState } from "react";
import { ExternalLinkIcon, RefreshCcwIcon, PaletteIcon, Loader2Icon } from "lucide-react";
import { Fragment } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Hint } from "@/src/components/ui/hint";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

const THEMES = {
  default: {
    name: 'Default',
    colors: ['#3b82f6', '#8b5cf6', '#ec4899'],
  },
  neobrutalism: {
    name: 'Neobrutalism',
    colors: ['#000000', '#FFFF00', '#FF00FF'],
  },
  glassmorphism: {
    name: 'Glassmorphism',
    colors: ['#ffffff', '#e0e7ff', '#c7d2fe'],
  },
  claymorphism: {
    name: 'Claymorphism',
    colors: ['#8B7CFF', '#FF6B9D', '#FFC864'],
  }
} as const;

interface Props {
  data: Fragment;
  onFilesUpdate?: (files: { [path: string]: string }) => void;
}

export const FragmentWeb = ({ data, onFilesUpdate }: Props) => {
  const [fragmentKey, setFragmentKey] = useState(0);
  const [copied, setCopied] = useState(false);
  const [selectedTheme, setSelectedTheme] = useState<keyof typeof THEMES>('default');
  const [isApplyingTheme, setIsApplyingTheme] = useState(false);
  const [open, setOpen] = useState(false);

  const onRefresh = () => {
    setFragmentKey((prev) => prev + 1);
  }

  const handleCopy = async () => {
    navigator.clipboard.writeText(data.sandboxUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const applyTheme = async (themeKey: keyof typeof THEMES) => {
    if (isApplyingTheme) return;
    
    setIsApplyingTheme(true);
    setOpen(false); // Close popover
    
    try {
      const response = await fetch(`/api/fragments/${data.id}/apply-theme`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ theme: themeKey }),
      });

      if (!response.ok) {
        throw new Error('Failed to apply theme');
      }

      const result = await response.json();
      
      setSelectedTheme(themeKey);
      setFragmentKey((prev) => prev + 1);
      
      if (onFilesUpdate && result.files) {
        onFilesUpdate(result.files);
      }
    } catch (error) {
      console.error('Error applying theme:', error);
    } finally {
      setIsApplyingTheme(false);
    }
  }

  return (
    <div className="flex flex-col w-full h-full">
      <div className="p-2 border-b bg-sidebar flex items-center gap-x-2">
        <Hint text="Refresh Preview">
          <Button size="sm" variant="outline" onClick={onRefresh}>
            <RefreshCcwIcon />
          </Button>
        </Hint>

        {/* Dùng Popover thay vì DropdownMenu */}
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button size="sm" variant="outline" disabled={isApplyingTheme}>
              {isApplyingTheme ? (
                <Loader2Icon className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <PaletteIcon className="w-4 h-4 mr-2" />
              )}
              <span className="hidden sm:inline">
                {isApplyingTheme ? 'Applying...' : THEMES[selectedTheme].name}
              </span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-2" align="start">
            <div className="space-y-1">
              {Object.entries(THEMES).map(([key, theme]) => (
                <button
                  key={key}
                  onClick={() => applyTheme(key as keyof typeof THEMES)}
                  disabled={isApplyingTheme}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div className="flex gap-1">
                    {theme.colors.map((color, i) => (
                      <div
                        key={i}
                        className="w-4 h-4 rounded-full border border-gray-300"
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                  <span className="flex-1 text-left text-sm">{theme.name}</span>
                  {selectedTheme === key && (
                    <span className="text-primary font-bold">✓</span>
                  )}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        <Hint text={copied ? "Copied!" : "Copy URL"}>
          <Button 
            size="sm" variant="outline" onClick={handleCopy}
            className="flex-1 justify-start text-start font-normal"
            disabled={!data.sandboxUrl || copied}>
            <span className="truncate">
              {data.sandboxUrl}
            </span>
          </Button>
        </Hint>
        
        <Hint text="Open in new tab">
          <Button
            size="sm" variant="outline"
            disabled={!data.sandboxUrl}
            onClick={() => {
              if (!data.sandboxUrl) return;
              window.open(data.sandboxUrl, "_blank");
            }}>
            <ExternalLinkIcon />
          </Button>
        </Hint>
      </div>
      
      <iframe 
        key={fragmentKey}
        className="h-full w-full"
        sandbox="allow-forms allow-scripts allow-same-origin"
        loading="lazy"
        src={data.sandboxUrl}
      />
    </div>
  )
}