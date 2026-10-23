import React from 'react';
import {Companion} from './Companion';
import type {TaskState} from '../shared/contracts';
/** Geometry only; the persistent mascot controller owns all decorative states. */
export function CapsuleHead({state}:{state:TaskState|'speaking';permissionKey:string;canReceive:boolean;enabled:boolean;blocked:boolean}){
 return <span className="capsule-character"><Companion state={state} variant="head"/></span>;
}
