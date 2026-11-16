"""Per-machine safe presentation/power overrides; never school attendance policy."""
import json
import os
import threading
from power_schedule import minute

DEFAULTS = {'kiosk_mirror':True,'kiosk_camera_rotate':0,'voice_enabled':True,
    'power_saving_enabled':False,'screen_idle_minutes':0,'screen_off_time':'',
    'screen_on_time':'','power_off_time':'','power_off_action':'shutdown'}

def validate(values):
    if not isinstance(values,dict) or set(values)-set(DEFAULTS):
        raise ValueError('ค่าตั้งค่าไม่ถูกต้อง')
    out={}
    for key,value in values.items():
        if key in ('kiosk_mirror','voice_enabled','power_saving_enabled'):
            if type(value) is not bool:raise ValueError('ค่าตั้งค่าไม่ถูกต้อง')
        elif key=='kiosk_camera_rotate':
            if type(value) is not int or value not in (0,90,180,270):raise ValueError('มุมกล้องไม่ถูกต้อง')
        elif key=='screen_idle_minutes':
            if type(value) is not int or not 0<=value<=240:raise ValueError('เวลาพักจอต้องอยู่ระหว่าง 0 ถึง 240 นาที')
        elif key.endswith('_time'):
            if not isinstance(value,str) or (value!='' and minute(value) is None):raise ValueError('เวลาไม่ถูกต้อง')
        elif key=='power_off_action' and value not in ('shutdown','sleep'):
            raise ValueError('คำสั่งปิดเครื่องไม่ถูกต้อง')
        out[key]=value
    return out

class Settings:
    def __init__(self,path):
        self.path=path
        self.lock=threading.RLock()
        self.values={}
        if os.path.exists(path):
            with open(path,encoding='utf-8') as f:self.values=validate(json.load(f))
    def merge(self,base):
        with self.lock:return {**base,**self.values}
    def read(self,base):
        merged=self.merge({**DEFAULTS,**base})
        return {key:merged[key] for key in DEFAULTS}
    def save(self,values,base):
        checked=validate(values)
        with self.lock:
            updated={**self.values,**checked}
            os.makedirs(os.path.dirname(self.path),exist_ok=True)
            tmp=self.path+'.tmp'
            with open(tmp,'w',encoding='utf-8') as f:
                json.dump(updated,f);f.flush();os.fsync(f.fileno())
            os.replace(tmp,self.path)
            self.values=updated
            return self.read(base)