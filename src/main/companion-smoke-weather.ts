import type {WeatherForecast, WeatherLocation} from '../shared/companion-weather';

export function createSmokeWeather() {
  return {
    async find(city:string):Promise<WeatherLocation> {
      if (city!=='Madrid, ES') throw Error('Unexpected weather fixture city');
      return {name:'Madrid',country:'ES',latitude:40.4168,longitude:-3.7038};
    },
    async read(location:WeatherLocation):Promise<WeatherForecast> {
      const dublin = location.country==='IE';
      return {temperature:dublin?9:22,description:dublin?'lluvia ligera':'cielo claro',icon:dublin?'10d':'01d',
        low:dublin?6:14,high:dublin?11:25,rain:dublin,rainChance:dublin?78:undefined,period:'today',updatedAt:Date.now()};
    },
  };
}
