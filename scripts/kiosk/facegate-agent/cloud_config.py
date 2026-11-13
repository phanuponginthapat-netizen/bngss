"""School site links are not API endpoints; normalize shipped installer settings."""
from urllib.parse import urlparse

MANAGED_API = 'https://dlkyxvhnnffblerwedjz.supabase.co/functions/v1'
SCHOOL_HOSTS = {'bngss.online','www.bngss.online','bngss.lovable.app'}

def cloud_api_url(raw):
    value = str(raw or '').strip().rstrip('/')
    if not value or urlparse(value).hostname in SCHOOL_HOSTS:
        return MANAGED_API
    if value.endswith('/functions/v1'):
        return value
    if urlparse(value).hostname and urlparse(value).hostname.endswith('.supabase.co'):
        return value.split('/functions/')[0] + '/functions/v1'
    return MANAGED_API