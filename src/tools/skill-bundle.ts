// Fixed first-party skill, packaged without reading the machine or Codex plugins.
export function analysisSkill() {
  const name=Buffer.from('zen-analysis/SKILL.md');
  const content=Buffer.from('---\nname: zen-analysis\ndescription: Verify small calculations and generated code inside the hosted container.\n---\nUse only synthetic data or the current user input. Verify results with assertions. Never access credentials, host files, external services or install dependencies. Clearly report partial results.\n');
  let crc=0xffffffff; for(const byte of content){crc^=byte;for(let bit=0;bit<8;bit++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);} crc=(crc^0xffffffff)>>>0;
  const local=Buffer.alloc(30);local.writeUInt32LE(0x04034b50);local.writeUInt16LE(20,4);local.writeUInt32LE(crc,14);local.writeUInt32LE(content.length,18);local.writeUInt32LE(content.length,22);local.writeUInt16LE(name.length,26);
  const central=Buffer.alloc(46);central.writeUInt32LE(0x02014b50);central.writeUInt16LE(20,4);central.writeUInt16LE(20,6);central.writeUInt32LE(crc,16);central.writeUInt32LE(content.length,20);central.writeUInt32LE(content.length,24);central.writeUInt16LE(name.length,28);
  const end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(1,8);end.writeUInt16LE(1,10);end.writeUInt32LE(central.length+name.length,12);end.writeUInt32LE(local.length+name.length+content.length,16);
  return {type:'inline' as const,name:'zen-analysis',description:'Verify small calculations and generated code inside the hosted container.',source:{type:'base64' as const,media_type:'application/zip' as const,data:Buffer.concat([local,name,content,central,name,end]).toString('base64')}};
}
