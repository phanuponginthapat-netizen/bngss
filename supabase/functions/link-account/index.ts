import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Verify user
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { code, line_id } = await req.json();
    if (!code || typeof code !== 'string' || code.trim().length < 2) {
      return new Response(JSON.stringify({ error: 'Invalid code' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const trimmed = code.trim();
    const supabase = createClient(supabaseUrl, serviceKey);

    // Check if code already linked to another user
    let foundType: 'personnel' | 'student' | null = null;
    let recordId: string | null = null;
    let firstName: string | null = null;
    let lastName: string | null = null;

    // Try personnel first
    const { data: personnel } = await supabase
      .from('personnel')
      .select('id, user_id, first_name, last_name')
      .eq('employee_code', trimmed)
      .eq('status', 'active')
      .maybeSingle();

    if (personnel) {
      if (personnel.user_id && personnel.user_id !== user.id) {
        return new Response(JSON.stringify({ error: 'code_already_linked' }), {
          status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      foundType = 'personnel';
      recordId = personnel.id;
      firstName = personnel.first_name;
      lastName = personnel.last_name;
    } else {
      const { data: student } = await supabase
        .from('students')
        .select('id, auth_user_id, first_name, last_name')
        .eq('student_code', trimmed)
        .eq('status', 'active')
        .maybeSingle();

      if (student) {
        if (student.auth_user_id && student.auth_user_id !== user.id) {
          return new Response(JSON.stringify({ error: 'code_already_linked' }), {
            status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        foundType = 'student';
        recordId = student.id;
        firstName = student.first_name;
        lastName = student.last_name;
      }
    }

    if (!foundType || !recordId) {
      return new Response(JSON.stringify({ error: 'code_not_found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Link record to user
    if (foundType === 'personnel') {
      await supabase.from('personnel').update({
        user_id: user.id,
        email: user.email,
      }).eq('id', recordId);

      // Make sure user has role: teacher (don't downgrade admin/director)
      const { data: existingRole } = await supabase
        .from('user_roles').select('role').eq('user_id', user.id).maybeSingle();
      if (!existingRole) {
        await supabase.from('user_roles').insert({ user_id: user.id, role: 'teacher' });
      }
    } else {
      await supabase.from('students').update({
        auth_user_id: user.id,
      }).eq('id', recordId);

      const { data: existingRole } = await supabase
        .from('user_roles').select('role').eq('user_id', user.id).maybeSingle();
      if (!existingRole) {
        await supabase.from('user_roles').insert({ user_id: user.id, role: 'student' });
      }
    }

    // Update profile
    const profileUpdate: Record<string, unknown> = {
      account_linked: true,
      linked_at: new Date().toISOString(),
      google_email: user.email,
      first_name: firstName,
      last_name: lastName,
    };
    if (foundType === 'personnel') profileUpdate.employee_code = trimmed;
    else profileUpdate.student_code = trimmed;
    if (line_id) profileUpdate.line_id = String(line_id).trim();

    await supabase.from('profiles').update(profileUpdate).eq('id', user.id);

    return new Response(JSON.stringify({
      success: true,
      type: foundType,
      first_name: firstName,
      last_name: lastName,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('link-account error:', error);
    return new Response(JSON.stringify({ error: 'internal_error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
