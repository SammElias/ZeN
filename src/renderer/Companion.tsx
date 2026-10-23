import React from 'react';
import type {TaskState} from '../shared/contracts';
import type {RobotPose} from '../shared/companion';
/** Existing surface slot. MascotHost owns the only renderer. */
export function Companion(props:{state?:TaskState|'speaking';size?:'small'|'large';animated?:boolean;pose?:RobotPose;wave?:boolean;variant?:'full'|'head';handGesture?:'wave'|'permission'|'receive'|'success'|null}){
 return <span className="mascot-anchor" data-mascot-anchor={props.variant==='head'?'head':'pet'} aria-hidden="true" style={{display:'block',width:'100%',height:'100%'}}/>;
}
