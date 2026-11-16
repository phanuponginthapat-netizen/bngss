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


def create_router(cloud_url, embed, read_card, sync):
    router = APIRouter()
    sessions = {}
    guard = threading.Lock()

    def response(data, status=200):
        return JSONResponse(data, status_code=status, headers={'Cache-Control': 'no-store'})

    def cloud(path, payload, token=None):
        headers = {'apikey': PUBLIC_KEY, 'content-type': 'application/json'}
        if token:
            headers['Authorization'] = 'Bearer ' + token
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
                return response({'error':'หมดเวลาจัดการ กรุณาเข้าสู่ระบบใหม่'},401)
            with session['lock']:
                if kind == 'logout':
                    with guard:
                        sessions.pop(str(body.get('session','')),None)
                    return response({'ok':True})
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
                if kind == 'capture':
                    if not session['student']:
                        raise ValueError('เลือกนักเรียนก่อนถ่ายภาพ')
                    if len(session['samples']) >= 3:
                        raise ValueError('ครบสามภาพแล้ว')
                    faces = embed(str(body.get('image','')))
                    error = quality_error(faces,session['samples'])
                    if error:
                        raise ValueError(error)
                    sample=faces[0]
                    session['samples'].append(sample)
                    return response({'count':len(session['samples']), 'photo':sample.get('crop')})
                if kind == 'save':
                    if not session['student'] or len(session['samples']) != 3:
                        raise ValueError('ต้องเลือกนักเรียนและถ่ายครบสามภาพ')
                    result = cloud('kiosk-face-register', {'student_id':session['student']['id'],
                        'descriptors':[s['descriptor'] for s in session['samples']],
                        'face_image':session['samples'][0].get('crop')},session['token'])
                    if result.get('success') is not True or result.get('count') != 3:
                        raise ValueError('ระบบยังไม่ยืนยันการบันทึก กรุณาลองใหม่')
                    session['samples']=[]
                    threading.Thread(target=sync,daemon=True).start()
                    return response({'ok':True,'count':3})
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
