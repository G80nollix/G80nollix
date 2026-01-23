
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CreateCustomerRequest {
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  birthDate?: string;
  userType: 'individual' | 'business';
}

// Generate a secure random password
function generateRandomPassword(length: number = 16): string {
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const numbers = '0123456789';
  const special = '!@#$%&?';
  const allChars = uppercase + lowercase + numbers + special;
  
  // Ensure at least one character from each category
  let password = '';
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += special[Math.floor(Math.random() * special.length)];
  
  // Fill the rest randomly
  for (let i = password.length; i < length; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }
  
  // Shuffle the password to avoid predictable pattern
  return password.split('').sort(() => Math.random() - 0.5).join('');
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
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
    const customerData: CreateCustomerRequest = await req.json();
    console.log('[DEBUG] Creating customer account for:', customerData.email);

    // Initialize Supabase admin client
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUP_SECR_KEY') ?? ''
    );

    // Check if user already exists
    const { data: existingUser, error: checkError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (checkError) {
      console.error('[DEBUG] Error checking existing users:', checkError);
      throw new Error(`Errore nel controllo utenti esistenti: ${checkError.message}`);
    }

    const userExists = existingUser.users.some(user => user.email === customerData.email);
    
    if (userExists) {
      console.log('[DEBUG] User already exists with email:', customerData.email);
      return new Response(JSON.stringify({ 
        error: 'Un utente con questa email esiste già nel sistema',
        success: false 
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      });
    }

    // Generate a secure random temporary password
    const tempPassword = generateRandomPassword(8);
    console.log('[DEBUG] Generated random temporary password for new user');

    // Create user account with Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: customerData.email,
      password: tempPassword,
      email_confirm: true, // Auto-confirm email
      user_metadata: {
        user_type: customerData.userType,
        first_name: customerData.firstName,
        last_name: customerData.lastName,
        phone: customerData.phone,
        birth_date: customerData.birthDate,
      }
    });

    if (authError) {
      console.error('[DEBUG] Auth creation error:', authError);
      
      // Handle specific error cases
      if (authError.message?.includes('User already registered')) {
        return new Response(JSON.stringify({ 
          error: 'Un utente con questa email è già registrato',
          success: false 
        }), {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        });
      }
      
      throw new Error(`Errore nella creazione dell'account: ${authError.message}`);
    }

    console.log('[DEBUG] User created successfully:', authData.user?.id);

    // Update the user's password to force them to change it on first login
    if (authData.user?.id) {
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
        authData.user.id,
        {
          password: tempPassword,
          user_metadata: {
            ...authData.user.user_metadata,
            password_change_required: true
          }
        }
      );

      if (updateError) {
        console.error('[DEBUG] Error updating password:', updateError);
        // Don't fail the entire process if password update fails
      } else {
        console.log('[DEBUG] Password updated successfully for user:', authData.user.id);
      }
    }

    // Send welcome email to the new user using send-email
    try {
      console.log('[DEBUG] Sending welcome email to:', customerData.email);
      
      // Get shop settings for email personalization
      const { data: shopSettings } = await supabaseAdmin
        .from('shop_settings')
        .select('nome_negozio, shopIcon_url')
        .maybeSingle();

      const shopName = shopSettings?.nome_negozio || 'Nollix';
      let shopIconUrl = shopSettings?.shopIcon_url || 'https://demo.nollix.it/Nollix_favicon.png';
      
      // Validate shopIconUrl - must be a public URL (not localhost)
      if (shopIconUrl && (shopIconUrl.includes('localhost') || shopIconUrl.includes('127.0.0.1'))) {
        console.warn('[DEBUG] Invalid shopIconUrl (localhost detected), using default');
        shopIconUrl = 'https://demo.nollix.it/Nollix_favicon.png';
      }
      
      // Crea l'HTML per l'email di benvenuto
      const displayName = `${customerData.firstName} ${customerData.lastName}`.trim() || customerData.firstName;
      const welcomeEmailHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Benvenuto su ${shopName}</title>
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5; }
              .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
              .header { background-color: #ffffff; padding: 40px 20px; text-align: center; }
              .logo { width: 60px; height: 60px; background-color: rgba(255,255,255,0.2); border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 20px; }
              .logo img { display: block; margin: auto; max-width: 100%; max-height: 100%; }
              .logo-text { color: white; font-size: 24px; font-weight: bold; }
              .header-title { color: white; font-size: 28px; font-weight: bold; margin: 0; }
              .header-subtitle { color: rgba(255,255,255,0.9); font-size: 16px; margin: 10px 0 0 0; }
              .content { padding: 40px 20px; }
              .welcome-text { font-size: 18px; color: #333; margin-bottom: 30px; }
              .credentials-box { background-color: #f8f9fa; border-left: 4px solid #2563eb; padding: 20px; margin: 30px 0; border-radius: 4px; }
              .credentials-title { font-size: 16px; font-weight: bold; color: #333; margin-bottom: 15px; }
              .credential-item { margin-bottom: 10px; }
              .credential-label { font-weight: 600; color: #666; }
              .credential-value { font-family: 'Courier New', monospace; background-color: #e9ecef; padding: 8px 12px; border-radius: 4px; display: inline-block; margin-left: 10px; }
              .warning-box { background-color: #fff3cd; border: 1px solid #ffeeba; border-radius: 4px; padding: 15px; margin: 20px 0; }
              .warning-text { color: #856404; font-size: 14px; margin: 0; }
              .button { display: inline-block; background-color: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 20px 0; }
              .footer { background-color: #f8f9fa; padding: 20px; text-align: center; border-top: 1px solid #e9ecef; }
              .footer-text { color: #666; font-size: 14px; margin: 0; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <div class="logo">
                  <img src="${shopIconUrl}" alt="${shopName} Logo" style="width: 40px; height: 40px; object-fit: contain;">
                </div>
                <h1 class="header-title">Benvenuto su ${shopName}!</h1>
                <p class="header-subtitle">Il tuo account è stato creato con successo</p>
              </div>
              
              <div class="content">
                <p class="welcome-text">
                  Ciao <strong>${displayName}</strong>,
                </p>
                
                <p>È stato creato un account ${shopName} per te. Ecco le tue credenziali di accesso:</p>
                
                <div class="credentials-box">
                  <div class="credentials-title">🔐 Le tue credenziali di accesso:</div>
                  <div class="credential-item">
                    <span class="credential-label">Email:</span>
                    <span class="credential-value">${customerData.email}</span>
                  </div>
                  <div class="credential-item">
                    <span class="credential-label">Password temporanea:</span>
                    <span class="credential-value">${tempPassword}</span>
                  </div>
                </div>
                
                <div class="warning-box">
                  <p class="warning-text">
                    <strong>Importante:</strong> Per motivi di sicurezza, ti consigliamo di cambiare immediatamente la password temporanea con una di tua scelta.
                  </p>
                </div>
                
                <p>Per cambiare la tua password, visita la sezione dedicata nell'area personale del tuo profilo</p>
                
                <p>Grazie per esserti unito a ${shopName}!</p>
              </div>
              
              <div class="footer">
                <p class="footer-text">
                  Questo è un messaggio automatico, per favore non rispondere a questa email.
                </p>
              </div>
            </div>
          </body>
        </html>
      `;

      const welcomeEmailResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        },
        body: JSON.stringify({
          to: customerData.email,
          subject: `Benvenuto su ${shopName} - Account Creato`,
          html: welcomeEmailHtml
        }),
      });

      if (!welcomeEmailResponse.ok) {
        console.error('[DEBUG] Error calling send-email function:', await welcomeEmailResponse.text());
      } else {
        console.log('[DEBUG] Welcome email sent successfully');
      }
    } catch (emailError) {
      console.error('[DEBUG] Error sending welcome email:', emailError);
      // Don't fail the entire process if email sending fails
    }

    return new Response(JSON.stringify({ 
      success: true, 
      userId: authData.user?.id,
      user: authData.user,
      message: 'Account creato con successo. Email di benvenuto inviata al cliente.',
      tempPassword: tempPassword
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    });

  } catch (error: any) {
    console.error('[DEBUG] Error in create-customer-account:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Errore interno del server',
        success: false 
      }),
      {
        status: 500,
        headers: { 
          'Content-Type': 'application/json', 
          ...corsHeaders 
        },
      }
    );
  }
};

serve(handler);
