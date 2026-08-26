import { getKisbusDb as db } from './firebase';
import { collection, doc, writeBatch, deleteDoc, getDocs, updateDoc } from 'firebase/firestore';
import type { Destination, NewDestination } from './types';
import { fetchCollection, onCollectionUpdate, addDocument } from './core';
import { sanitizeDataForSystem, normalizeString } from './utils';
import { errorEmitter } from '@/lib/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/lib/errors';

export const getDestinations = () => fetchCollection<Destination>('destinations');
export const onDestinationsUpdate = (callback: (destinations: Destination[]) => void) => onCollectionUpdate<Destination>('destinations', callback);
export const addDestination = (destination: Omit<Destination, 'id'>) => addDocument<Destination>('destinations', destination);

export const addDestinationsInBatch = async (destinations: Omit<Destination, 'id'>[]) => {
    const batch = writeBatch(db());
    destinations.forEach(dest => batch.set(doc(collection(db(), 'destinations')), dest));
    await batch.commit().catch(async (serverError) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: '/destinations', operation: 'create' }));
        throw serverError;
    });
};

export const deleteDestination = (id: string) => deleteDoc(doc(db(), 'destinations', id)).catch(async (serverError) => {
    const permissionError = new FirestorePermissionError({ path: `/destinations/${id}`, operation: 'delete' } satisfies SecurityRuleContext);
    errorEmitter.emit('permission-error', permissionError);
    throw serverError;
});

export const clearDestinations = async () => {
    const snapshot = await getDocs(collection(db(), 'destinations'));
    const batch = writeBatch(db());
    snapshot.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit().catch(async (serverError) => {
        const permissionError = new FirestorePermissionError({ path: `/destinations`, operation: 'delete' } satisfies SecurityRuleContext);
        errorEmitter.emit('permission-error', permissionError);
        throw serverError;
    });
};

export const getSuggestedDestinations = () => fetchCollection<Destination>('suggestedDestinations');
export const onSuggestedDestinationsUpdate = (callback: (destinations: Destination[]) => void) => onCollectionUpdate<Destination>('suggestedDestinations', callback);

export const addSuggestedDestination = async (destination: { name: string }) => {
    const sanitizedName = sanitizeDataForSystem(destination.name);
    if (!sanitizedName) return;
    const currentDests = await getDestinations();
    if (currentDests.some(d => normalizeString(d.name) === normalizeString(sanitizedName))) return;
    const currentSuggestions = await getSuggestedDestinations();
    if (currentSuggestions.some(s => normalizeString(s.name) === normalizeString(sanitizedName))) return;
    await addDocument<Destination>('suggestedDestinations', { name: sanitizedName });
};

export const approveSuggestedDestination = async (suggestion: Destination) => {
    const batch = writeBatch(db());
    const sanitizedName = sanitizeDataForSystem(suggestion.name);
    batch.set(doc(collection(db(), 'destinations')), { name: sanitizedName });
    batch.delete(doc(db(), 'suggestedDestinations', suggestion.id));
    await batch.commit().catch(async (serverError) => {
        const permissionError = new FirestorePermissionError({ path: `/`, operation: 'write', requestResourceData: { approvedSuggestion: suggestion } } satisfies SecurityRuleContext);
        errorEmitter.emit('permission-error', permissionError);
        throw serverError;
    });
};

export const deleteSuggestedDestination = (id: string) => deleteDoc(doc(db(), 'suggestedDestinations', id)).catch(async (serverError) => {
    const permissionError = new FirestorePermissionError({ path: `/suggestedDestinations/${id}`, operation: 'delete' } satisfies SecurityRuleContext);
    errorEmitter.emit('permission-error', permissionError);
    throw serverError;
});

export const clearAllSuggestedDestinations = async () => {
    const snapshot = await getDocs(collection(db(), 'suggestedDestinations'));
    const batch = writeBatch(db());
    snapshot.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit().catch(async (serverError) => {
        const permissionError = new FirestorePermissionError({ path: `/suggestedDestinations`, operation: 'delete' } satisfies SecurityRuleContext);
        errorEmitter.emit('permission-error', permissionError);
        throw serverError;
    });
};

export const updateDestinationZone = async (id: string, zone: string) => {
    const docRef = doc(db(), 'destinations', id);
    await updateDoc(docRef, { zone }).catch(async (serverError) => {
        const permissionError = new FirestorePermissionError({ path: `/destinations/${id}`, operation: 'update' } satisfies SecurityRuleContext);
        errorEmitter.emit('permission-error', permissionError);
        throw serverError;
    });
};

export const updateDestinationSaturdayZone = async (id: string, saturdayZone: string) => {
    const docRef = doc(db(), 'destinations', id);
    await updateDoc(docRef, { saturdayZone }).catch(async (serverError) => {
        const permissionError = new FirestorePermissionError({ path: `/destinations/${id}`, operation: 'update' } satisfies SecurityRuleContext);
        errorEmitter.emit('permission-error', permissionError);
        throw serverError;
    });
};

export const updateDestinationsZoneBatch = async (ids: string[], zone: string) => {
    if (!ids || ids.length === 0) return;
    const batch = writeBatch(db());
    ids.forEach(id => {
        const docRef = doc(db(), 'destinations', id);
        batch.update(docRef, { zone });
    });
    await batch.commit().catch(async (serverError) => {
        const permissionError = new FirestorePermissionError({ path: `/destinations`, operation: 'update' } satisfies SecurityRuleContext);
        errorEmitter.emit('permission-error', permissionError);
        throw serverError;
    });
};

export const updateDestinationsSaturdayZoneBatch = async (ids: string[], saturdayZone: string) => {
    if (!ids || ids.length === 0) return;
    const batch = writeBatch(db());
    ids.forEach(id => {
        const docRef = doc(db(), 'destinations', id);
        batch.update(docRef, { saturdayZone });
    });
    await batch.commit().catch(async (serverError) => {
        const permissionError = new FirestorePermissionError({ path: `/destinations`, operation: 'update' } satisfies SecurityRuleContext);
        errorEmitter.emit('permission-error', permissionError);
        throw serverError;
    });
};

export interface DestinationExcelSyncItem {
  name: string;
  zone?: string;
  saturdayZone?: string;
  mode: 'weekday' | 'saturday' | 'both';
}

export const syncDestinationsFromExcelBatch = async (
  items: DestinationExcelSyncItem[],
  existingDestinations: Destination[]
): Promise<{ addedCount: number; updatedCount: number }> => {
  if (!items || items.length === 0) return { addedCount: 0, updatedCount: 0 };

  const normMap = new Map<string, Destination>();
  existingDestinations.forEach(d => {
    normMap.set(normalizeString(d.name), d);
  });

  const batch = writeBatch(db());
  let addedCount = 0;
  let updatedCount = 0;

  for (const item of items) {
    const normName = normalizeString(item.name);
    if (!normName) continue;

    const existing = normMap.get(normName);
    if (existing) {
      const updateData: Record<string, any> = {};
      if (item.mode === 'weekday') {
        if (item.zone !== undefined) updateData.zone = item.zone;
      } else if (item.mode === 'saturday') {
        if (item.saturdayZone !== undefined) updateData.saturdayZone = item.saturdayZone;
      } else {
        if (item.zone !== undefined) updateData.zone = item.zone;
        if (item.saturdayZone !== undefined) updateData.saturdayZone = item.saturdayZone;
      }

      if (Object.keys(updateData).length > 0) {
        const docRef = doc(db(), 'destinations', existing.id);
        batch.update(docRef, updateData);
        updatedCount++;
      }
    } else {
      const newDocRef = doc(collection(db(), 'destinations'));
      const newData: Record<string, any> = {
        name: item.name,
      };
      if (item.mode === 'weekday') {
        newData.zone = item.zone || '미지정';
      } else if (item.mode === 'saturday') {
        newData.saturdayZone = item.saturdayZone || '미지정';
      } else {
        newData.zone = item.zone || '미지정';
        newData.saturdayZone = item.saturdayZone || '미지정';
      }
      batch.set(newDocRef, newData);
      addedCount++;
    }
  }

  await batch.commit().catch(async (serverError) => {
    const permissionError = new FirestorePermissionError({ path: `/destinations`, operation: 'write' } satisfies SecurityRuleContext);
    errorEmitter.emit('permission-error', permissionError);
    throw serverError;
  });

  return { addedCount, updatedCount };
};

