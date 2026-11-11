export type ScreenScope = 'display' | 'window';

export type ScreenSnapshot = {
  id: string;
  image: string;
  capturedAt: number;
  sourceTitle?: string;
  scope?: ScreenScope;
};

export type ScreenContextStatus = {
  state: 'capturing' | 'ready' | 'queued' | 'unavailable' | 'expired' | 'idle' | 'removed';
  capturedAt?: number;
  sourceTitle?: string;
  scope?: ScreenScope;
  snapshotId?: string;
};
