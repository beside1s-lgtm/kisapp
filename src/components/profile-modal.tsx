'use client';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { compressImage } from '@/lib/utils';
import { saveUserProfile } from '@/app/actions';
import { useState, useTransition } from 'react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { Loader2 } from 'lucide-react';
import Image from 'next/image';

type ProfileModalProps = {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
};

export function ProfileModal({ isOpen, setIsOpen }: ProfileModalProps) {
  const { user, profile, setProfile } = useAuth();
  const { toast } = useToast();
  const [isSaving, startSaving] = useTransition();

  const [name, setName] = useState(profile?.name || '');
  const [role, setRole] = useState(profile?.role || '담당');
  const [sigPreview, setSigPreview] = useState(profile?.signature || '');

  const handleSave = () => {
    startSaving(async () => {
      if (!user) return;
      
      let finalSignature = profile?.signature || '';
      if (sigPreview !== profile?.signature) {
        finalSignature = sigPreview ? await compressImage(sigPreview) : '';
      }

      const updatedProfile = {
        name,
        role,
        signature: finalSignature,
        email: user.email!,
      };

      const result = await saveUserProfile(user.uid, user.email!, updatedProfile);

      if (result.success) {
        setProfile(updatedProfile);
        toast({ title: 'Profile Updated' });
        setIsOpen(false);
      } else {
        toast({
          variant: 'destructive',
          title: 'Update Failed',
          description: result.error,
        });
      }
    });
  };
  
  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const reader = new FileReader();
      reader.onloadend = () => setSigPreview(reader.result as string);
      reader.readAsDataURL(e.target.files[0]);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>My Profile</DialogTitle>
          <DialogDescription>
            Update your name, role, and signature.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="name" className="text-right">
              Name
            </Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} className="col-span-3" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="role" className="text-right">
              Role
            </Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger className="col-span-3">
                <SelectValue placeholder="Select a role" />
              </SelectTrigger>
              <SelectContent>
                {['담당', '부장', '행정실장', '교감', '교장'].map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-4 items-start gap-4">
            <Label className="text-right pt-2">Signature</Label>
            <div className="col-span-3 space-y-2">
                <div className="p-4 border-2 border-dashed rounded-lg text-center h-32 flex items-center justify-center">
                    <Input type="file" id="sig-upload" accept="image/png, image/jpeg" onChange={onFileChange} className="hidden" />
                    <Label htmlFor="sig-upload" className="cursor-pointer">
                        {sigPreview ? (
                            <Image src={sigPreview} alt="Signature Preview" width={120} height={120} className="max-h-24 object-contain" />
                        ) : (
                            <span className="text-sm text-muted-foreground">Upload Image</span>
                        )}
                    </Label>
                </div>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
