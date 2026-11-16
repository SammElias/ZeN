import React from 'react';

export function ZenEmblem({className}: {className?: string}) {
  return <img className={['zen-emblem',className].filter(Boolean).join(' ')}
    src="./icons/zen-256.png" width="256" height="256" alt="" draggable={false}/>;
}
