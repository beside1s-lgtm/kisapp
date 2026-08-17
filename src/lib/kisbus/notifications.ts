import { getKisbusDb as db } from './firebase';
import { collection, doc, query, where, onSnapshot } from 'firebase/firestore';
import type { NotificationSettings, NotificationSchedule, NewNotificationSchedule } from './types';
import { onCollectionUpdate, fetchCollection, setDocument } from './core';

export const getNotificationSettings = () => fetchCollection<NotificationSettings>('notification_settings');

export const onNotificationSettingsUpdate = (callback: (settings: NotificationSettings[]) => void) => 
    onCollectionUpdate<NotificationSettings>('notification_settings', callback);

export const saveNotificationSettings = async (settings: NotificationSettings) => {
    return setDocument('notification_settings', settings.id, {
        ...settings,
        lastModified: new Date().toISOString()
    });
};

// --- Notification Schedules ---

export const getNotificationSchedules = () => fetchCollection<NotificationSchedule>('notification_schedules');

export const onNotificationSchedulesUpdate = (callback: (schedules: NotificationSchedule[]) => void) =>
    onCollectionUpdate<NotificationSchedule>('notification_schedules', callback);

export const addNotificationSchedule = (schedule: NewNotificationSchedule) => {
    const id = doc(collection(db(), 'notification_schedules')).id;
    return setDocument('notification_schedules', id, { ...schedule, id });
};

export const updateNotificationSchedule = (id: string, data: Partial<NotificationSchedule>) =>
    setDocument('notification_schedules', id, data);

export const deleteNotificationSchedule = async (id: string) => {
    const { deleteDoc, doc } = await import('firebase/firestore');
    return deleteDoc(doc(db(), 'notification_schedules', id));
};

export const sendInstantNotification = async (schedule: NotificationSchedule) => {
    const { collection, doc } = await import('firebase/firestore');
    const id = doc(collection(db(), 'instant_notifications')).id;
    return setDocument('instant_notifications', id, {
        ...schedule,
        id,
        sentAt: new Date().toISOString(),
        status: 'pending'
    });
};

// --- Global Config ---

export const onGlobalNotificationConfigUpdate = (callback: (data: { vacationMode?: boolean }) => void) => {
    return onSnapshot(doc(db(), 'config', 'global_notifications'), (docSnap) => {
        callback(docSnap.exists() ? docSnap.data() as { vacationMode?: boolean } : { vacationMode: false });
    });
};

export const updateGlobalNotificationConfig = async (vacationMode: boolean) => {
    const { setDoc, doc } = await import('firebase/firestore');
    return setDoc(doc(db(), 'config', 'global_notifications'), { vacationMode }, { merge: true });
};

