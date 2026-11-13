"""Run saved school power plans offline; a cancelled daily countdown stays cancelled."""
import re

def minute(value):
    match=re.fullmatch(r'([01]\d|2[0-3]):([0-5]\d)',str(value or ''))
    return int(match[1])*60+int(match[2]) if match else None

def plan(settings, now):
    enabled=settings.get('power_saving_enabled') is True
    off,on,shut=map(minute,(settings.get('screen_off_time'),settings.get('screen_on_time'),settings.get('power_off_time')))
    current=now.hour*60+now.minute
    window=off is not None and on is not None and off!=on and (off<=current<on if off<on else current>=off or current<on)
    due=shut is not None and (current-shut)%1440<10
    return {'power_saving_enabled':enabled,'screen_off_window':enabled and window,
            'power_off_due':enabled and due,'screen_idle_minutes':settings.get('screen_idle_minutes') or 0,
            'power_off_action':'sleep' if settings.get('power_off_action')=='sleep' else 'shutdown'}

class DailyShutdown:
    def __init__(self):self.last_key=None
    def reserve(self, now, settings):
        key=(now.date().isoformat(),settings.get('power_off_time'),settings.get('power_off_action'))
        if self.last_key==key:return False
        self.last_key=key
        return True