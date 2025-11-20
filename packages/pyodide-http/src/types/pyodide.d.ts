/**
 * Minimal Pyodide type declarations
 * For full types, install pyodide package as peer dependency
 */

declare module 'pyodide' {
  export interface PyProxy {
    get(key: string): any;
    set(key: string, value: any): void;
    toJs(): any;
    destroy(): void;
  }

  export interface PyodideInterface {
    runPythonAsync(code: string): Promise<any>;
    runPython(code: string): any;
    loadPackage(packages: string | string[]): Promise<void>;
    pyimport(name: string): any;
    globals: {
      get(name: string): any;
      set(name: string, value: any): void;
      toJs(): Map<string, any>;
    };
    FS: {
      writeFile(path: string, data: string | Uint8Array): void;
      readFile(path: string, options?: { encoding?: string }): string | Uint8Array;
      mkdir(path: string): void;
      rmdir(path: string): void;
      unlink(path: string): void;
    };
  }

  export function loadPyodide(options?: {
    indexURL?: string;
    fullStdLib?: boolean;
  }): Promise<PyodideInterface>;

  export type { PyodideInterface };
}
