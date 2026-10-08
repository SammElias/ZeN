import {createContext} from 'react';
import type {RobotPresentation} from '../shared/companion';
export const CompanionContext=createContext<{presentation:RobotPresentation;animated:boolean;motion:'reduced'|'normal'|'expressive';gesture:'wave'|'success'|'thanks'|null;greet:()=>void;drop:boolean;accessory?:'none'|'bow'}|null>(null);
