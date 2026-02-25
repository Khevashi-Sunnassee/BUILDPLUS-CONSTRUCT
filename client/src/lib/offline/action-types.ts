export const ACTION_TYPES = {
  TASK_CREATE: 'TASK_CREATE',
  TASK_UPDATE: 'TASK_UPDATE',
  TASK_STATUS_CHANGE: 'TASK_STATUS_CHANGE',
  TASK_COMMENT_ADD: 'TASK_COMMENT_ADD',
  TASK_ATTACH_PHOTO: 'TASK_ATTACH_PHOTO',

  CHECKLIST_CREATE: 'CHECKLIST_CREATE',
  CHECKLIST_UPDATE: 'CHECKLIST_UPDATE',
  CHECKLIST_COMPLETE: 'CHECKLIST_COMPLETE',

  PHOTO_UPLOAD: 'PHOTO_UPLOAD',
} as const;

export type ActionType = typeof ACTION_TYPES[keyof typeof ACTION_TYPES];

export const ENTITY_TYPES = {
  TASK: 'task',
  TASK_GROUP: 'task_group',
  TASK_UPDATE: 'task_update',
  CHECKLIST_INSTANCE: 'checklist_instance',
  CHECKLIST_TEMPLATE: 'checklist_template',
  PHOTO: 'photo',
} as const;

export type EntityType = typeof ENTITY_TYPES[keyof typeof ENTITY_TYPES];

export const CREATE_ACTIONS = new Set([
  ACTION_TYPES.TASK_CREATE,
  ACTION_TYPES.CHECKLIST_CREATE,
  ACTION_TYPES.PHOTO_UPLOAD,
]);

export function isCreateAction(actionType: string): boolean {
  return CREATE_ACTIONS.has(actionType as ActionType);
}

export function getActionPriority(actionType: string): number {
  if (CREATE_ACTIONS.has(actionType as ActionType)) return 0;
  if (actionType === ACTION_TYPES.PHOTO_UPLOAD) return 1;
  return 2;
}

export function getActionDescription(actionType: string, payload: Record<string, unknown>): string {
  switch (actionType) {
    case ACTION_TYPES.TASK_CREATE:
      return `Create task: ${payload.title || 'Untitled'}`;
    case ACTION_TYPES.TASK_UPDATE:
      return `Update task`;
    case ACTION_TYPES.TASK_STATUS_CHANGE:
      return `Change task status to ${payload.status || 'unknown'}`;
    case ACTION_TYPES.TASK_COMMENT_ADD:
      return `Add comment to task`;
    case ACTION_TYPES.TASK_ATTACH_PHOTO:
      return `Attach photo to task`;
    case ACTION_TYPES.CHECKLIST_CREATE:
      return `Create checklist`;
    case ACTION_TYPES.CHECKLIST_UPDATE:
      return `Update checklist responses`;
    case ACTION_TYPES.CHECKLIST_COMPLETE:
      return `Complete checklist`;
    case ACTION_TYPES.PHOTO_UPLOAD:
      return `Upload photo: ${payload.title || 'Untitled'}`;
    default:
      return `Unknown action: ${actionType}`;
  }
}
