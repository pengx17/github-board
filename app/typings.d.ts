/// <reference types="vite/client" />

declare const process: {
  env: {
    GITHUB_ACCESS_TOKEN: string;
  };
};

declare module "datascript";