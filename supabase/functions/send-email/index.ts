import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";
const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};
const handler = async (req)=>{
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: corsHeaders
    });
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({
      error: 'Metodo non consentito',
      success: false
    }), {
      status: 405,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  }
  try {
    console.log(req);
    const { subject, to, html } = await req.json();
    console.log('[DEBUG] Sending email to:', to);
    const emailHtml = html;
    const { error } = await resend.emails.send({
      from: 'Noleggio Sci Cerreto <info@noleggioscicerreto.it>',
      to: [
        to
      ],
      subject: subject,
      html: emailHtml
    });
    if (error) {
      console.error('[DEBUG] Error sending email:', error);
      throw error;
    }
    console.log('[DEBUG] Welcome email sent successfully to:', to);
    return new Response(JSON.stringify({
      success: true,
      message: 'Email di benvenuto inviata con successo'
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  } catch (error) {
    console.error('[DEBUG] Error in send-email:', error);
    return new Response(JSON.stringify({
      error: error.message || 'Errore interno del server',
      success: false
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  }
};
serve(handler);
