import {z} from 'zod';

export const WeatherKey = z.string().trim().regex(/^[a-fA-F0-9]{32}$/);
export const WeatherLocation = z.object({
  name: z.string().trim().min(1).max(100),
  country: z.string().regex(/^[A-Z]{2}$/),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
}).strict();
export type WeatherLocation = z.infer<typeof WeatherLocation>;
export const dublinWeather: WeatherLocation = {name:'Dublín',country:'IE',latitude:53.3498,longitude:-6.2603};

export const WeatherAction = z.discriminatedUnion('type', [
  z.object({type:z.literal('refresh'),force:z.boolean().optional()}).strict(),
  z.object({type:z.literal('configure'),key:WeatherKey.optional(),city:z.string().trim().min(2).max(100).optional()}).strict(),
  z.object({type:z.literal('provider')}).strict(),
]);
export type WeatherAction = z.infer<typeof WeatherAction>;

export type WeatherForecast = {
  temperature: number;
  description: string;
  icon: string;
  low: number;
  high: number;
  rain: boolean;
  rainChance?: number;
  period: 'today' | 'tomorrow' | 'next24h';
  updatedAt: number;
};

export type WeatherStatus = {
  location: WeatherLocation;
  configured: boolean;
  forecast?: WeatherForecast;
  error?: string;
};

export const weatherRefreshMs = 15 * 60_000;
