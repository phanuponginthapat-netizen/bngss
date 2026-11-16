// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { validateDriveUpload, decodeUpload, validateJpegSnapshot } from '../../../supabase/functions/_shared/uploadValidation';
import { verifyLineSignature } from '../../../supabase/functions/_shared/lineSignature';
import { allowedTables, validateBundleRows } from '../../../supabase/functions/_shared/bundleValidation';
import { arAttribute } from '../arSceneSafety';

describe('release security boundaries', () => {
  it('rejects non-images masquerading as JPEG', () => {
    expect(() => validateJpegSnapshot(btoa('<script>alert(1)</script>'))).toThrow();
    expect(Array.from(validateJpegSnapshot(btoa(String.fromCharCode(255,216,255,224,255,217))))).toEqual([255,216,255,224,255,217]);
  });
  it('bounds decoded uploads before writing', () => {
    expect(() => decodeUpload(btoa('1234'), 3)).toThrow();
    expect(decodeUpload(btoa('123'),3).length).toBe(3);
  });
  it('rejects unsupported types and unconstrained paths', () => {
    expect(() => validateDriveUpload('../other/file.pdf','application/pdf',btoa('pdf'))).toThrow();
    expect(() => validateDriveUpload('file.html','text/html',btoa('html'))).toThrow();
    expect(validateDriveUpload('docs/file.txt','text/plain',btoa('text')).length).toBe(4);
  });
  it('requires a correct signature over the original LINE bytes', async () => {
    const key=await crypto.subtle.importKey('raw',new TextEncoder().encode('test-only'),{name:'HMAC',hash:'SHA-256'},false,['sign']);
    const signature=btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode('{"events":[]}')))));
    expect(await verifyLineSignature('{"events":[]}',signature,'test-only')).toBe(true);
    expect(await verifyLineSignature('{"events":[1]}',signature,'test-only')).toBe(false);
    expect(await verifyLineSignature('{}',null,'test-only')).toBe(false);
  });
  it('does not accept caller-selected protected tables or fields', () => {
    expect(() => allowedTables(['user_roles'],{cms_pages:'id'})).toThrow();
    expect(() => validateBundleRows('cms_pages',[{id:'x',school_id:'other'}],{cms_pages:['id','title']})).toThrow();
    expect(validateBundleRows('cms_pages',[{id:'x',title:'ok'}],{cms_pages:['id','title']})).toEqual([{id:'x',title:'ok'}]);
  });
  it('escapes publisher content before HTML parsing', () => {
    expect(arAttribute('" onerror="alert(1)')).toBe('&quot; onerror=&quot;alert(1)');
    expect(arAttribute('<script>')).toBe('&lt;script&gt;');
  });
});