/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL for the cloud transcription backend (enables ApiEngine). */
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
