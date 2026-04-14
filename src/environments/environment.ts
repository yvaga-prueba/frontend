export const environment = {
  production: false,
  get apiUrl(): string {
    if (typeof window !== 'undefined' && (window as any).appConfig?.API_URL) {
      return (window as any).appConfig.API_URL;
    }
    return 'http://localhost:8080/api';
  }
};