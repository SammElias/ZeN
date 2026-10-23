/** Original short tones for ZEN, synthesized locally without audio assets. */
export function noticeTone(name:string,sampleRate:number):Float32Array{
 if(!Number.isInteger(sampleRate)||sampleRate<8000||sampleRate>192000)throw Error('Invalid audio sample rate.');
 const notes=name==='finish'?[660,880]:name==='error'?[330,247]:name==='approval'?[523.25,659.25,523.25]:[660];
 const step=Math.round(sampleRate*.11),active=Math.round(sampleRate*.08),samples=new Float32Array(step*notes.length);
 for(let n=0;n<notes.length;n++)for(let i=0;i<active;i++){
  const envelope=Math.sin(Math.PI*i/(active-1))**2;
  samples[n*step+i]=.18*envelope*Math.sin(2*Math.PI*notes[n]*i/sampleRate);
 }
 return samples;
}
