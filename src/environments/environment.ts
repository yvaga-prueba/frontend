export const environment = {
  production: false,
  get apiUrl(): string {
   /*
    if (typeof window !== 'undefined' && (window as any).appConfig?.API_URL) {
      return (window as any).appConfig.API_URL;
    }*/

   // return 'http://localhost:8080/api';
    return 'http://192.168.0.104:8080/api';
    //return 'http://172.20.10.3:8080/api';
  }
};