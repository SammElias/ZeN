import React from 'react';
import {Cloud,CloudFog,CloudLightning,MoonStar,Snowflake,Sun,Wind} from 'lucide-react';
import type {WeatherForecast} from '../shared/companion-weather';

function scene(forecast?:WeatherForecast){
 const code=forecast?.icon.slice(0,2);
 if(code==='13')return 'snow';
 if(code==='09'||code==='10')return 'rain';
 if(code==='11')return 'storm';
 if((forecast?.windKph??0)>=36)return 'wind';
 if(forecast?.icon.endsWith('n'))return 'night';
 if(code==='01')return 'sun';
 return code==='50'?'fog':'cloud';
}

export function HomeWeatherIllustration({forecast,animate}:{forecast?:WeatherForecast;animate:boolean}){
 const kind=scene(forecast);
 const Icon=kind==='sun'?Sun:kind==='night'?MoonStar:kind==='wind'?Wind:kind==='fog'?CloudFog:kind==='storm'?CloudLightning:Cloud;
 return <span className="home-weather-scene" data-scene={kind} data-animate={animate} aria-hidden="true">
  <Icon className="weather-scene-back"/>
  {kind==='cloud'&&forecast&&<Cloud className="weather-scene-front"/>}
  {kind==='rain'&&<span className="weather-drops"><i/><i/><i/></span>}
  {kind==='snow'&&<span className="weather-flakes"><Snowflake/><Snowflake/><Snowflake/></span>}
 </span>;
}
