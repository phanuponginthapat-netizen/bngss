import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import { isNativeFcmSupported } from "@/lib/fcmPush";

export default function DebugFcmPage(){
  const [info, setInfo] = useState<any>({});
  useEffect(()=>{ (async()=>{
    const out:any={};
    out.isNative=isNativeFcmSupported();
    out.platform=Capacitor.getPlatform();
    out.isNativePlatform=Capacitor.isNativePlatform();
    try{ out.perm=await PushNotifications.checkPermissions(); }catch(e:any){ out.permErr=String(e); }
    try{ const { value } = await import("capacitor-apk-updater").then(m=> (m as any).ApkUpdater.getAppVersion()).catch(()=>({value:"no"})); out.appVersion=value; }catch{}
    try{ const v=await (await import("capacitor-apk-updater")).ApkUpdater.getAppVersion(); out.version=v; }catch(e:any){ out.verErr=String(e); }
    // try register and capture token
    try{
      const addListener = (PushNotifications as any).addListener;
      let tok="";
      const h = await addListener.call(PushNotifications,"registration", (t:any)=>{ tok=t.value; out.token=tok.slice(0,30)+"..."; });
      const herr = await addListener.call(PushNotifications,"registrationError", (e:any)=>{ out.regErr=JSON.stringify(e).slice(0,200); });
      setTimeout(()=>{ try{ h.remove(); herr.remove(); }catch{} setInfo({...out}); }, 3000);
      await PushNotifications.register();
      setTimeout(()=> setInfo((p:any)=>({...p, token: tok? tok.slice(0,30)+"...":"(no token yet)", regErr: out.regErr})), 3500);
    }catch(e:any){ out.regErr=String(e); }
    setInfo(out);
  })(); },[]);
  return (
    <div className="p-4 space-y-3 max-w-xl mx-auto">
      <h1 className="text-xl font-bold">Debug FCM</h1>
      <pre className="text-xs bg-muted p-3 rounded overflow-auto">{JSON.stringify(info,null,2)}</pre>
      <p className="text-xs text-muted-foreground">เปิดหน้านี้แล้วแคปส่งมา — จะเห็นว่า permission / token / error อะไร</p>
    </div>
  );
}
