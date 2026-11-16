"""Small same-window Cloud management; credentials and captures stay in memory."""
import base64
import secrets
import threading
import time

import requests
from fastapi import APIRouter, Request
from fastapi.responses import HTMLResponse, JSONResponse
from enrollment_quality import quality_error
from native_admin_ui import ADMIN_HTML

# Public client key, not a private credential.
PUBLIC_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRsa3l4dmhubmZmYmxlcndlZGp6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQzNjY5MTIsImV4cCI6MjA5OTk0MjkxMn0.bQqqX3veJ_pGr9fSa0a-bKIS-w7UmR569a2xDZQ6Cx4'


def create_router(cloud_url, embed, read_card, sync, device_key='', settings_read=None, settings_write=None, power_control=None, diagnostics=None):
    router = APIRouter()
    sessions = {}
    guard = threading.Lock()

    def response(data, status=200):
        return JSONResponse(data, status_code=status, headers={'Cache-Control': 'no-store'})

    def cloud(path, payload, token=None):
        headers = {'apikey': PUBLIC_KEY, 'content-type': 'application/json'}
        if token:
            headers['Authorization'] = 'Bearer ' + token
        elif device_key:
            headers['x-device-key'] = device_key
        url = cloud_url.rsplit('/functions/v1', 1)[0] + path if path.startswith('/auth/') else cloud_url + '/' + path
        r = requests.post(url, headers=headers, json=payload, timeout=30)
        if not r.ok:
            raise ValueError('ตรวจสิทธิ์หรือบันทึกไม่สำเร็จ กรุณาตรวจบัญชีและการเชื่อมต่อ')
        return r.json()

    @router.get('/admin')
    def screen():
        return HTMLResponse(ADMIN_HTML, headers={'Cache-Control':'no-store', 'X-Frame-Options':'SAMEORIGIN'})

    @router.post('/native-admin/action')
    def action(request: Request, body: dict):
        # LAN clients and cross-origin websites cannot manipulate the native panel.
        if request.client is None or request.client.host not in ('127.0.0.1', '::1'):
            return response({'error':'ใช้หน้าจัดการจากเครื่องตู้เท่านั้น'}, 403)
        origin = request.headers.get('origin')
        if origin and origin != str(request.base_url).rstrip('/'):
            return response({'error':'origin_not_allowed'},403)
        kind = body.get('action')
        try:
            if kind == 'open':
                if not device_key:
                    return response({'error':'ยังไม่ได้ตั้งรหัสอุปกรณ์ของโรงเรียน'},401)
                roster = cloud('kiosk-native-admin', {'action':'roster'})
                sid = secrets.token_urlsafe(32)
                with guard:
                    now = time.time()
                    for expired in [k for k,v in sessions.items() if v['expires'] <= now]:
                        sessions.pop(expired, None)
                    sessions[sid] = {'token':None, 'expires':now+3600, 'students':roster['students'],
                        'student':None, 'samples':[], 'lock':threading.Lock()}
                return response({'session':sid,'students':roster['students'],
                    'settings':settings_read() if settings_read else {}})
            if kind == 'login':
                login = cloud('/auth/v1/token?grant_type=password', {
                    'email':str(body.get('email',''))[:254], 'password':str(body.get('password',''))[:512]})
                token = login.get('access_token')
                if not token:
                    raise ValueError('เข้าสู่ระบบไม่สำเร็จ')
                roster = cloud('kiosk-native-admin', {'action':'roster'}, token)
                sid = secrets.token_urlsafe(32)
                with guard:
                    now = time.time()
                    for expired in [k for k,v in sessions.items() if v['expires'] <= now]:
                        sessions.pop(expired, None)
                    sessions[sid] = {'token':token, 'expires':min(now+900, now+float(login.get('expires_in',900))),
                                     'students':roster['students'], 'student':None, 'samples':[], 'lock':threading.Lock()}
                return response({'session':sid, 'students':roster['students']})
            with guard:
                session = sessions.get(str(body.get('session','')))
            if not session or session['expires'] <= time.time():
                return response({'error':'หมดเวลาจัดการ กรุณาปิดและเปิดหน้าจัดการใหม่'},401)
            with session['lock']:
                if kind == 'logout':
                    with guard:
                        sessions.pop(str(body.get('session','')),None)
                    return response({'ok':True})
                if kind == 'settings':
                    if not settings_read:
                        raise ValueError('ไม่พบระบบตั้งค่า')
                    return response({'settings':settings_read()})
                if kind == 'settings_save':
                    if not settings_write:
                        raise ValueError('ไม่พบระบบตั้งค่า')
                    return response({'settings':settings_write(body.get('settings'))})
                if kind == 'power':
                    if not power_control:
                        raise ValueError('ไม่พบระบบจัดการเครื่อง')
                    return response(power_control(body.get('command')))
                if kind == 'diagnostics':
                    return response(diagnostics() if diagnostics else {})
                if kind == 'code':
                    code = str(body.get('code',''))
                    if not code.isascii() or not code.isdigit() or len(code)>20:
                        raise ValueError('กรอกรหัสนักเรียนเป็นตัวเลข')
                    student = next((s for s in session['students'] if s['student_code']==code),None)
                    if not student:
                        raise ValueError('ไม่พบรหัสนักเรียน')
                    session['student'],session['samples'] = student,[]
                    return response({'student':student})
                if kind == 'select':
                    student = next((s for s in session['students'] if s['id'] == body.get('student_id')),None)
                    if not student:
                        raise ValueError('ไม่พบรายชื่อนักเรียน')
                    session['student'], session['samples'] = student, []
                    return response({'student':student})
                if kind == 'card':
                    student_id = read_card(str(body.get('image','')))
                    student = next((s for s in session['students'] if s['id']==student_id),None)
                    if not student:
                        raise ValueError('ไม่พบ QR บัตรนักเรียน กรุณาชูบัตรให้ชัด')
                    session['student'],session['samples'] = student,[]
                    return response({'student':student})
                if kind in ('capture', 'upload'):
                    if not session['student']:
                        raise ValueError('เลือกนักเรียนก่อนถ่ายภาพ')
                    if len(session['samples']) >= 5:
                        raise ValueError('ครบห้าภาพแล้ว')
                    if len(str(body.get('image',''))) > 8_000_000:
                        raise ValueError('รูปใหญ่เกินไป กรุณาเลือกรูปเล็กกว่า 6 MB')
                    faces = embed(str(body.get('image','')))
                    error = quality_error(faces,session['samples'])
                    if error:
                        raise ValueError(error)
                    sample=faces[0]
                    session['samples'].append(sample)
                    return response({'count':len(session['samples']), 'photo':sample.get('crop')})
                if kind == 'save':
                    if not session['student'] or not 3 <= len(session['samples']) <= 5:
                        raise ValueError('ต้องเลือกนักเรียนและเก็บสามถึงห้าภาพ')
                    count = len(session['samples'])
                    result = cloud('kiosk-face-register', {'student_id':session['student']['id'],
                        'descriptors':[s['descriptor'] for s in session['samples']],
                        'face_images':[s.get('crop') for s in session['samples']],
                        'face_image':session['samples'][0].get('crop')},session['token'])
                    if result.get('success') is not True or result.get('count') != count:
                        raise ValueError('ระบบยังไม่ยืนยันการบันทึก กรุณาลองใหม่')
                    session['samples']=[]
                    threading.Thread(target=sync,daemon=True).start()
                    return response({'ok':True,'count':count})
                if kind == 'sync':
                    # Revalidates school roles; stale local sessions do not confer privileges.
                    roster=cloud('kiosk-native-admin',{'action':'roster'},session['token'])
                    sync()
                    session['students']=roster['students']
                    return response(roster)
                raise ValueError('ไม่พบคำสั่ง')
        except ValueError as exc:
            return response({'error':str(exc)},400)
        except Exception:
            return response({'error':'เชื่อมต่อไม่สำเร็จ ข้อมูลที่ถ่ายยังอยู่ กรุณาลองใหม่'},503)
    return router
