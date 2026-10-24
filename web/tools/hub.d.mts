export interface HubOptions {
  port?: number;
  host?: string;
  dir?: string;
  token?: string;
  http?: boolean;
}

export function startHub(options?: HubOptions): Promise<{
  url: string;
  token: string;
  dir: string;
  close: () => Promise<void>;
}>;
