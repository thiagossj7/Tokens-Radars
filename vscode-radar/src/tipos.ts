export interface UsoBarra {
  utilization: number;
  reset: number;
  status: string;
}

export interface DatosUso {
  session: UsoBarra | null;
  week: UsoBarra | null;
  representativeClaim: string | null;
  overage: string | null;
  updatedAt: string;
  cached: boolean;
  error: string | null;
}

export interface Credenciales {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: number | null;
  rutaArchivo: string;
  jsonCompleto: any;
}

export interface MensajeWebView {
  type: 'usageData' | 'rupture';
  data?: any;
}
