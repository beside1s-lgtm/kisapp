import { fetchDocument, setDocument, onDocumentUpdate } from './core';

export interface GlobalSettings {
  contactPhone?: string;
  [key: string]: any;
}

export async function getGlobalSettings(): Promise<GlobalSettings | null> {
  return fetchDocument<GlobalSettings>('settings', 'global');
}

export async function updateGlobalSettings(data: Partial<GlobalSettings>): Promise<void> {
  return setDocument<GlobalSettings>('settings', 'global', data);
}

export function onGlobalSettingsUpdate(callback: (data: GlobalSettings | null) => void): () => void {
  return onDocumentUpdate<GlobalSettings>('settings', 'global', callback);
}
