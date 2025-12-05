import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import logger from '@/lib/utils/logger';

/**
 * Direct HTTP test endpoint that bypasses the SDK
 * This helps diagnose if the issue is with the SDK or the API key itself
 */
export async function POST(request: NextRequest) {
  logger.debug('[Direct Test] ===== Route Hit =====');
  logger.debug('[Direct Test] Timestamp:', new Date().toISOString());
  logger.debug('[Direct Test] Request URL:', request.url);
  logger.debug('[Direct Test] Request method:', request.method);
  
  try {
    logger.debug('[Direct Test] Step 1: Creating Supabase client...');
    const supabase = await createServerSupabaseClient();
    logger.debug('[Direct Test] ✓ Supabase client created');
    
    // Use getUser() - authenticates with Supabase Auth server
    logger.debug('[Direct Test] Step 2: Getting user (getUser)...');
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    logger.debug('[Direct Test] User check result:', {
      hasUser: !!user,
      userId: user?.id,
      userError: userError?.message,
    });
    
    if (!user) {
      logger.error('[Direct Test] ✗ No user found - returning 401');
      logger.error('[Direct Test] User error:', userError?.message);
      
      // Log request headers to see if cookies are being sent
      const cookieHeader = request.headers.get('cookie');
      logger.debug('[Direct Test] Request cookies:', cookieHeader ? 'Present' : 'Missing');
      logger.debug('[Direct Test] Cookie header (first 200 chars):', cookieHeader?.substring(0, 200));
      
      return NextResponse.json({ 
        error: 'Unauthorized - No session found',
        details: userError?.message || 'Please ensure you are logged in',
      }, { status: 401 });
    }
    
    const currentUser = user;
    logger.debug('[Direct Test] ✓ User found, user ID:', currentUser.id);

    // Check if user is admin
    const { data: userData, error: dbUserError } = await supabase
      .from('users')
      .select('role')
      .eq('auth_id', currentUser.id)
      .single();

    if (dbUserError || userData?.role !== 'admin') {
      logger.error('[Direct Test] Admin check failed:', { dbUserError: dbUserError?.message, userRole: userData?.role });
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }
    
    logger.debug('[Direct Test] ✓ Admin access confirmed');

    // Get API key and project name from request body
    logger.debug('[Direct Test] Step 3: Parsing request body...');
    let body;
    try {
      body = await request.json();
      logger.debug('[Direct Test] ✓ Request body parsed');
      logger.debug('[Direct Test] Body keys:', Object.keys(body));
      logger.debug('[Direct Test] Has apiKey:', !!body.apiKey);
      logger.debug('[Direct Test] Has projectName:', !!body.projectName);
    } catch (parseError) {
      logger.error('[Direct Test] ✗ Failed to parse request body:', parseError);
      return NextResponse.json({ 
        error: 'Invalid request body',
        details: parseError instanceof Error ? parseError.message : 'Could not parse JSON',
      }, { status: 400 });
    }
    
    let apiKey = body.apiKey;
    const projectName = body.projectName;

    if (!apiKey) {
      return NextResponse.json({ error: 'API key is required' }, { status: 400 });
    }

    // Clean the API key
    apiKey = String(apiKey).trim().replace(/^["']|["']$/g, '');

    if (!apiKey || apiKey.length < 20) {
      return NextResponse.json({ 
        error: 'Invalid API key format. Please check your API key.' 
      }, { status: 400 });
    }

    // Log API key info (masked for security)
    logger.debug('[Direct Test] ===== API Key Analysis =====');
    logger.debug('[Direct Test] API key length:', apiKey.length);
    logger.debug('[Direct Test] API key starts with AIza:', apiKey.startsWith('AIza'));
    logger.debug('[Direct Test] First 4 chars:', apiKey.substring(0, 4));
    logger.debug('[Direct Test] Last 4 chars:', apiKey.substring(apiKey.length - 4));
    logger.debug('[Direct Test] Key type check:', apiKey.startsWith('AIza') ? 'Standard Gemini API Key' : 'Non-standard (may be Vertex AI or other)');
    
    // Check for hidden characters or encoding issues
    const keyBytes = new TextEncoder().encode(apiKey);
    logger.debug('[Direct Test] Key byte length:', keyBytes.length);
    logger.debug('[Direct Test] Key has non-ASCII:', /[^\x00-\x7F]/.test(apiKey));

    // Make direct HTTP request to Gemini API
    // Following Python guide: Use x-goog-api-key header (primary method)
    try {
      // Request body format matching Python guide exactly
      const requestBody = {
        contents: [{
          parts: [{
            text: projectName 
              ? `Project: ${projectName}\n\nSay "Connection successful"`
              : 'Say "Connection successful"'
          }]
        }]
      };

      logger.debug('[Direct Test] ===== Request Details =====');
      logger.debug('[Direct Test] Request body:', JSON.stringify(requestBody, null, 2));
      
      // Try endpoints in order of preference (header method first per Python guide)
      const endpoints = [
        {
          url: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey,  // Primary method per Python guide
          },
          name: 'v1beta-header-x-goog-api-key',
          description: 'v1beta with x-goog-api-key header (recommended)',
        },
        {
          url: 'https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey,
          },
          name: 'v1-header-x-goog-api-key',
          description: 'v1 with x-goog-api-key header',
        },
        {
          url: `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`,
          headers: { 'Content-Type': 'application/json' },
          name: 'v1beta-query-param',
          description: 'v1beta with key in query parameter (fallback)',
        },
        {
          url: `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`,
          headers: { 'Content-Type': 'application/json' },
          name: 'v1-query-param',
          description: 'v1 with key in query parameter (fallback)',
        },
      ];

      let lastError: any = null;
      for (const endpoint of endpoints) {
        try {
          logger.debug(`[Direct Test] ===== Trying ${endpoint.name} =====`);
          logger.debug(`[Direct Test] Description: ${endpoint.description}`);
          logger.debug(`[Direct Test] URL: ${endpoint.url.includes('?key=') ? endpoint.url.replace(apiKey, '***') : endpoint.url}`);
          
          // Log headers (mask API key)
          const loggedHeaders: any = { ...endpoint.headers };
          if (loggedHeaders['x-goog-api-key']) {
            loggedHeaders['x-goog-api-key'] = `${apiKey.substring(0, 4)}...${apiKey.substring(apiKey.length - 4)}`;
          }
          logger.debug(`[Direct Test] Headers:`, loggedHeaders);

          // Filter out undefined headers for TypeScript
          const headers: Record<string, string> = {};
          Object.entries(endpoint.headers).forEach(([key, value]) => {
            if (value !== undefined) {
              headers[key] = value;
            }
          });

          const response = await fetch(endpoint.url, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(requestBody),
          });

          const responseText = await response.text();
          logger.debug(`[Direct Test] ${endpoint.name} - HTTP Status: ${response.status} ${response.statusText}`);
          logger.debug(`[Direct Test] ${endpoint.name} - Response Headers:`, Object.fromEntries(response.headers.entries()));
          logger.debug(`[Direct Test] ${endpoint.name} - Response Body Length: ${responseText.length} chars`);
          logger.debug(`[Direct Test] ${endpoint.name} - Response Body (first 1000 chars):`, responseText.substring(0, 1000));

          if (response.ok) {
            try {
              const responseData = JSON.parse(responseText);
              const generatedText = responseData.candidates?.[0]?.content?.parts?.[0]?.text || 'Connection successful';
              
              logger.debug(`[Direct Test] ✓ Success with ${endpoint.name}!`);
              return NextResponse.json({
                success: true,
                message: `Direct HTTP test successful (${endpoint.name})`,
                response: generatedText,
                projectName: projectName || null,
                method: 'direct-http',
                endpointUsed: endpoint.name,
              });
            } catch (e) {
              logger.error(`[Direct Test] ${endpoint.name} - Parse error:`, e);
              lastError = { endpoint: endpoint.name, error: 'Could not parse response', rawResponse: responseText };
              continue;
            }
          } else {
            let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
            let errorData: any = null;
            try {
              errorData = JSON.parse(responseText);
              errorMessage = errorData.error?.message || errorData.message || errorMessage;
              logger.error(`[Direct Test] ${endpoint.name} - Parsed Error:`, JSON.stringify(errorData, null, 2));
              
              // Log specific error details if available
              if (errorData.error) {
                logger.error(`[Direct Test] ${endpoint.name} - Error Code:`, errorData.error.code);
                logger.error(`[Direct Test] ${endpoint.name} - Error Status:`, errorData.error.status);
                logger.error(`[Direct Test] ${endpoint.name} - Error Details:`, errorData.error.details);
              }
            } catch (e) {
              logger.error(`[Direct Test] ${endpoint.name} - Could not parse error, raw response:`, responseText);
            }
            lastError = { endpoint: endpoint.name, status: response.status, error: errorMessage, errorData, rawResponse: responseText.substring(0, 500) };
            continue;
          }
        } catch (error) {
          logger.error(`[Direct Test] ${endpoint.name} - Request failed:`, error);
          lastError = { endpoint: endpoint.name, error: error instanceof Error ? error.message : 'Request failed' };
          continue;
        }
      }

      // All endpoints failed
      logger.error('[Direct Test] ===== All Endpoint Formats Failed =====');
      logger.error('[Direct Test] Last error details:', JSON.stringify(lastError, null, 2));
      return NextResponse.json({
        success: false,
        error: lastError?.error || 'All endpoint formats failed',
        lastAttempt: lastError,
        allAttempts: endpoints.map(e => e.name),
        suggestion: 'Please check the terminal logs for detailed error responses from each endpoint attempt. The logs will show the exact error message from Google\'s API.',
      }, { status: 400 });
    } catch (error) {
      logger.error('[Direct Test] Request error:', error);
      return NextResponse.json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to make HTTP request',
        errorType: error?.constructor?.name,
      }, { status: 400 });
    }
  } catch (error) {
    logger.error('[Direct Test] Route error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to test connection' },
      { status: 500 }
    );
  }
}

