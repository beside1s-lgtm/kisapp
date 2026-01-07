'use client';
import { getDocConfig, saveDocConfig } from '@/app/actions';
import { DocConfig } from '@/lib/types';
import { compressImage } from '@/lib/utils';
import { useEffect, useState, useTransition } from 'react';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Loader2, Image as ImageIcon } from 'lucide-react';
import NextImage from 'next/image';

type SettingsModalProps = {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
};

export function SettingsModal({ isOpen, setIsOpen }: SettingsModalProps) {
  const { toast } = useToast();
  const [isSaving, startSaving] = useTransition();
  const [config, setConfig] = useState<DocConfig>({});
  const [headerPreview, setHeaderPreview] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      getDocConfig().then(data => {
        setConfig(data);
        setHeaderPreview(data.headerImage || '');
      });
    }
  }, [isOpen]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setConfig(prev => ({ ...prev, [name]: name === 'nextNumber' ? parseInt(value) : value }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const reader = new FileReader();
      reader.onloadend = () => setHeaderPreview(reader.result as string);
      reader.readAsDataURL(e.target.files[0]);
    }
  };

  const handleSave = () => {
    startSaving(async () => {
      let finalConfig = { ...config };
      if (headerPreview !== config.headerImage) {
        finalConfig.headerImage = headerPreview ? await compressImage(headerPreview, 600) : '';
      }

      const result = await saveDocConfig(finalConfig);
      if (result.success) {
        toast({ title: 'Settings Saved' });
        setIsOpen(false);
      } else {
        toast({ variant: 'destructive', title: 'Save Failed', description: result.error });
      }
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Document Settings</DialogTitle>
          <DialogDescription>
            Configure the official document template and numbering.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-6 py-4">
          <div className="space-y-2">
            <Label htmlFor="nextNumber">Next Document Number</Label>
            <Input id="nextNumber" name="nextNumber" type="number" value={config.nextNumber || 1} onChange={handleChange} />
          </div>
          <div className="space-y-2">
            <Label>Header Image</Label>
            <div className="p-4 border-2 border-dashed rounded-lg text-center relative group">
              <Input id="header-up" type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
              <Label htmlFor="header-up" className="cursor-pointer block">
                {headerPreview ? (
                  <div className="relative h-16 w-full">
                    <NextImage src={headerPreview} alt="Header Preview" layout="fill" objectFit="contain" />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity text-xs font-bold text-white rounded-md">Change</div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-1 py-2">
                    <ImageIcon className="text-muted-foreground" size={24} />
                    <span className="text-sm font-medium text-muted-foreground">Upload Header Image</span>
                  </div>
                )}
              </Label>
            </div>
          </div>
          <div className="space-y-4 pt-4 border-t">
            <h4 className="font-semibold">Footer Information</h4>
            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Input id="address" name="address" value={config.address || ''} onChange={handleChange} />
            </div>
             <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input id="phone" name="phone" value={config.phone || ''} onChange={handleChange} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fax">Fax</Label>
                  <Input id="fax" name="fax" value={config.fax || ''} onChange={handleChange} />
                </div>
             </div>
             <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" name="email" type="email" value={config.email || ''} onChange={handleChange} />
            </div>
            <div className="space-y-2">
                <Label htmlFor="homepage">Homepage</Label>
                <Input id="homepage" name="homepage" value={config.homepage || ''} onChange={handleChange} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Settings
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
