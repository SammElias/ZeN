// Local, offline window for physical drag/drop validation. No input automation.
const {app,BrowserWindow}=require('electron');
const path=require('node:path');
app.setPath('userData',path.join(app.getPath('temp'),'zen-drop-window-fixture'));
app.whenReady().then(()=>{
  const window=new BrowserWindow({title:'Referencia de arrastre',width:1000,height:400,x:800,y:0,autoHideMenuBar:true,webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false}});
  window.loadURL('data:text/html;charset=utf-8,'+encodeURIComponent('<!doctype html><meta charset="UTF-8"><title>Referencia de arrastre</title><style>body{background:#eef5f8;color:#182737;font:20px system-ui;padding:24px}h1{font-size:25px}p{margin:18px 0}</style><h1>Referencia local de prueba</h1><p>Código de referencia: <strong>739162</strong></p><p>Arrastra esta ventana hacia la cápsula de ZEN.</p><p>Esta prueba no usa la API.</p>'));
});
app.on('window-all-closed',()=>app.quit());
