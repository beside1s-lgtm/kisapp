'use client';

import { useCallback, useEffect, useState } from 'react';
import type { UserProfile } from '@/lib/types';
import type { HandoverDutyTimelineTemplate, HandoverItem } from '@/lib/types/handover';
import {
  getAllHandoverDutyTemplates,
  onHandoverDutyTemplatesUpdate,
  recordAddedManualItemToDutyTemplate,
  recordEditedItemToDutyTemplate,
  recordRemovedItemToDutyTemplate,
  resetHandoverDutyTemplate,
  resolveDutyForHandoverItem,
  restoreHiddenKeysInDutyTemplates,
  syncHandoverDutyTemplatesFromTimeline,
} from '@/lib/services/handoverDutyTemplateService';

/**
 * HandoverEditor와 HandoverPopupModal이 공용으로 사용하는
 * 업무 표준 타임라인 학습·구독·복원 훅.
 */
export function useHandoverDutyTemplateSync(enabled = true) {
  const [dutyTimelineTemplates, setDutyTimelineTemplates] = useState<HandoverDutyTimelineTemplate[]>([]);

  useEffect(() => {
    if (!enabled) return;
    const unsub = onHandoverDutyTemplatesUpdate(setDutyTimelineTemplates);
    return () => unsub();
  }, [enabled]);

  const refreshTemplates = useCallback(async () => {
    const latest = await getAllHandoverDutyTemplates();
    setDutyTimelineTemplates(latest);
  }, []);

  const persistAddedItem = useCallback(
    async (
      targetDuty: string,
      newItem: HandoverItem,
      user?: Pick<UserProfile, 'email' | 'name'>
    ) => {
      if (!targetDuty || !newItem.includeInDutyTemplate) return;
      await recordAddedManualItemToDutyTemplate({
        dutyName: targetDuty,
        item: newItem,
        updatedByEmail: user?.email,
        updatedByName: user?.name,
      });
      await refreshTemplates();
    },
    [refreshTemplates]
  );

  const persistEditedItem = useCallback(
    async (
      updatedItem: HandoverItem | undefined,
      selectedDuties: string[],
      user?: Pick<UserProfile, 'email' | 'name'>
    ): Promise<string> => {
      if (!updatedItem) return '';
      const isLearnable =
        updatedItem.sourceType !== 'approval' &&
        updatedItem.sourceType !== 'department_task' &&
        (updatedItem.sourceType === 'system_auto' || updatedItem.includeInDutyTemplate !== false);
      if (!isLearnable) return '';

      const targetDuty = resolveDutyForHandoverItem(updatedItem, selectedDuties);
      if (!targetDuty) return '';

      await recordEditedItemToDutyTemplate({
        dutyName: targetDuty,
        item: updatedItem,
        updatedByEmail: user?.email,
        updatedByName: user?.name,
      });
      await refreshTemplates();
      return targetDuty;
    },
    [refreshTemplates]
  );

  const persistRemovedItem = useCallback(
    async (
      targetItem: HandoverItem | undefined,
      selectedDuties: string[],
      user?: Pick<UserProfile, 'email' | 'name'>
    ) => {
      if (!targetItem) return;
      if (targetItem.sourceType !== 'system_auto' && !targetItem.customTemplateItemId) return;
      const targetDuty = resolveDutyForHandoverItem(targetItem, selectedDuties);
      if (!targetDuty) return;

      await recordRemovedItemToDutyTemplate({
        dutyName: targetDuty,
        item: targetItem,
        updatedByEmail: user?.email,
        updatedByName: user?.name,
      });
      await refreshTemplates();
    },
    [refreshTemplates]
  );

  const restoreDismissedForDuties = useCallback(
    async (selectedDuties: string[]) => {
      await restoreHiddenKeysInDutyTemplates(selectedDuties);
      await refreshTemplates();
    },
    [refreshTemplates]
  );

  const syncTimelineTemplates = useCallback(
    async (params: {
      selectedDuties: string[];
      items: HandoverItem[];
      dismissedSystemTaskKeys: string[];
      includeAllManualItems: boolean;
      user?: Pick<UserProfile, 'email' | 'name'>;
    }) => {
      await syncHandoverDutyTemplatesFromTimeline({
        selectedDuties: params.selectedDuties,
        items: params.items,
        dismissedSystemTaskKeys: params.dismissedSystemTaskKeys,
        includeAllManualItems: params.includeAllManualItems,
        updatedByEmail: params.user?.email,
        updatedByName: params.user?.name,
      }).catch(() => 0);
      await refreshTemplates();
    },
    [refreshTemplates]
  );

  const resetTemplatesForDuties = useCallback(
    async (selectedDuties: string[]) => {
      for (const duty of selectedDuties) {
        await resetHandoverDutyTemplate(duty);
      }
      await refreshTemplates();
    },
    [refreshTemplates]
  );

  return {
    dutyTimelineTemplates,
    persistAddedItem,
    persistEditedItem,
    persistRemovedItem,
    restoreDismissedForDuties,
    syncTimelineTemplates,
    resetTemplatesForDuties,
  };
}
