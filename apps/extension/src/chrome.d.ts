declare namespace chrome {
  namespace runtime {
    const onInstalled: ChromeEvent<() => void>;
    const onStartup: ChromeEvent<() => void>;
    const onMessage: ChromeEvent<
      (
        message: unknown,
        sender: MessageSender,
        sendResponse: (response?: unknown) => void,
      ) => boolean | void
    >;
    const lastError: { message?: string } | undefined;

    function openOptionsPage(): Promise<void>;
    function sendMessage(message: unknown): Promise<unknown>;

    type MessageSender = {
      tab?: tabs.Tab;
    };
  }

  namespace contextMenus {
    type ContextType = 'page' | 'selection';
    type OnClickData = {
      menuItemId: string | number;
      pageUrl?: string;
      selectionText?: string;
    };
    type CreateProperties = {
      id?: string;
      title?: string;
      contexts?: ContextType[];
      parentId?: string;
      type?: 'normal' | 'separator';
    };

    function create(createProperties: CreateProperties, callback?: () => void): void;
    function removeAll(callback?: () => void): void;

    const onClicked: ChromeEvent<(info: OnClickData, tab?: tabs.Tab) => void>;
  }

  namespace action {
    const onClicked: ChromeEvent<(tab?: tabs.Tab) => void>;
  }

  namespace storage {
    const sync: StorageArea;
    const local: StorageArea;

    type StorageArea = {
      get(keys?: string | string[] | Record<string, unknown> | null): Promise<Record<string, unknown>>;
      set(items: Record<string, unknown>): Promise<void>;
    };
  }

  namespace tabs {
    type Tab = {
      id?: number;
      title?: string;
      url?: string;
    };

    function create(createProperties: { url: string }): Promise<Tab>;
    function query(queryInfo: { active?: boolean; currentWindow?: boolean }): Promise<Tab[]>;
    function sendMessage(tabId: number, message: unknown): Promise<unknown>;
  }

  namespace scripting {
    function executeScript(injection: {
      target: { tabId: number };
      files: string[];
    }): Promise<unknown[]>;
    function executeScript(injection: {
      target: { tabId: number };
      func: () => unknown;
    }): Promise<Array<{ result?: unknown }>>;
  }

  type ChromeEvent<TListener extends (...args: never[]) => void> = {
    addListener(callback: TListener): void;
  };
}
