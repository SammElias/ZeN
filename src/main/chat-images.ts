import {nativeImage} from 'electron';
import type {ConversationStore} from '../storage/conversations';

/** Keeps the exact submitted image locally; thumbnails never enter model input. */
export function saveChatImage(store:ConversationStore,chat:string,run:string,data:string,name='Imagen adjunta'){
 const image=nativeImage.createFromDataURL(data),size=image.getSize();
 const ratio=Math.min(1,320/Math.max(size.width,size.height));
 if(!size.width||!size.height)return;
 const thumbnail=image.resize({width:Math.max(1,Math.round(size.width*ratio)),height:Math.max(1,Math.round(size.height*ratio)),quality:'good'});
 store.putMessageImage(chat,run,{name,...size,data,thumbnail:'data:image/jpeg;base64,'+thumbnail.toJPEG(72).toString('base64')});
}

export function recoverChatImages(store:ConversationStore,chat:string){
 for(const image of store.recoverableImages(chat)){
  // Damaged or unsupported legacy pixels must not prevent opening the chat.
  try{saveChatImage(store,chat,image.runId,image.data,'Imagen adjunta');}catch{}
 }
}
