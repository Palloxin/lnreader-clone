import NativeBackgroundTasks from '@modules/native-background-tasks';
import { BackgroundTaskQueue } from '../BackgroundTaskQueue';
import { executeBackgroundTask } from '../executeTask';

let mockStoredTasks: unknown[] = [];

jest.mock('@modules/native-background-tasks', () => ({
  __esModule: true,
  default: {
    complete: jest.fn(),
    fail: jest.fn(),
    updateProgress: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('../executeTask', () => ({
  executeBackgroundTask: jest.fn(),
}));

jest.mock('@utils/askForPostNoftificationsPermission', () => ({
  askForPostNotificationsPermission: jest.fn().mockResolvedValue(true),
}));

jest.mock('@utils/mmkv/mmkv', () => ({
  getMMKVObject: jest.fn(() => mockStoredTasks),
  setMMKVObject: jest.fn((_key: string, value: unknown[]) => {
    mockStoredTasks = value;
  }),
}));

jest.mock('@i18n/translations', () => ({
  getString: (key: string, options?: Record<string, string>) =>
    key === 'notifications.taskFailed'
      ? `Failed: ${options?.error}`
      : 'Completed',
}));

const task = {
  name: 'LOCAL_RESTORE' as const,
  data: { sourceUri: 'file://backup.zip' },
};

describe('BackgroundTaskQueue completion notifications', () => {
  beforeEach(() => {
    mockStoredTasks = [];
  });

  it('passes a task-provided completion summary to the native notification', async () => {
    jest
      .mocked(executeBackgroundTask)
      .mockImplementation(async (_task, updateProgress) => {
        updateProgress(meta => ({
          ...meta,
          completionText: 'Backup restored with warnings',
        }));
      });

    await new BackgroundTaskQueue().run('restore-1', task);

    expect(NativeBackgroundTasks.complete).toHaveBeenCalledWith(
      'restore-1',
      'Backup restored with warnings',
    );
  });

  it('localizes failure text before handing it to the native notification', async () => {
    jest
      .mocked(executeBackgroundTask)
      .mockRejectedValueOnce(new Error('Invalid backup'));

    await expect(
      new BackgroundTaskQueue().run('restore-2', task),
    ).rejects.toThrow('Invalid backup');
    expect(NativeBackgroundTasks.fail).toHaveBeenCalledWith(
      'restore-2',
      'Failed: Invalid backup',
      false,
    );
  });
});
