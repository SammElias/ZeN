const table=new Uint32Array(256);
for(let n=0;n<256;n++){let c=n;for(let bit=0;bit<8;bit++)c=c&1?0xedb88320^(c>>>1):c>>>1;table[n]=c>>>0;}
export function crc32(bytes:Uint8Array){let crc=0xffffffff;for(const byte of bytes)crc=table[(crc^byte)&255]^(crc>>>8);return (crc^0xffffffff)>>>0;}
