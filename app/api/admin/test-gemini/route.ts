import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';
import { GoogleGenAI } from '@google/genai';
import logger from '@/lib/utils/logger';

export async function POST(request: NextRequest) {
  logger.debug('[Test Gemini SDK] ===== Route Hit =====');
  logger.debug('[Test Gemini SDK] Timestamp:', new Date().toISOString());
  
  try {
    logger.debug('[Test Gemini SDK] Step 1: Creating Supabase client...');
    const supabase = await createServerSupabaseClient();
    logger.debug('[Test Gemini SDK] ✓ Supabase client created');
    
    // Try getUser() first (more reliable, authenticates with Supabase Auth server)
    logger.debug('[Test Gemini SDK] Step 2a: Getting user (getUser)...');
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    logger.debug('[Test Gemini SDK] User check result:', {
      hasUser: !!user,
      userId: user?.id,
      userError: userError?.message,
    });
    
    // Also try getSession() for compatibility
    logger.debug('[Test Gemini SDK] Step 2b: Getting session (getSession)...');
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    logger.debug('[Test Gemini SDK] Session check result:', {
      hasSession: !!session,
      userId: session?.user?.id,
      sessionError: sessionError?.message,
    });

    // Use user if available, otherwise fall back to session
    const currentUser = user || session?.user;
    
    if (!currentUser) {
      logger.error('[Test Gemini SDK] ✗ No user or session found - returning 401');
      logger.error('[Test Gemini SDK] User error:', userError?.message);
      logger.error('[Test Gemini SDK] Session error:', sessionError?.message);
      
      // Log request headers to see if cookies are being sent
      const cookieHeader = request.headers.get('cookie');
      logger.debug('[Test Gemini SDK] Request cookies:', cookieHeader ? 'Present' : 'Missing');
      logger.debug('[Test Gemini SDK] Cookie header (first 200 chars):', cookieHeader?.substring(0, 200));
      
      return NextResponse.json({ 
        error: 'Unauthorized - No session found',
        details: userError?.message || sessionError?.message || 'Please ensure you are logged in',
      }, { status: 401 });
    }
    
    logger.debug('[Test Gemini SDK] ✓ User/session found, user ID:', currentUser.id);

    // Check if user is admin
    const { data: userData, error: dbUserError } = await supabase
      .from('users')
      .select('role')
      .eq('auth_id', currentUser.id)
      .single();

    if (dbUserError || userData?.role !== 'admin') {
      logger.error('[Test Gemini SDK] Admin check failed:', { dbUserError: dbUserError?.message, userRole: userData?.role });
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }
    
    logger.debug('[Test Gemini SDK] ✓ Admin access confirmed');

    // Get API key and project name from request body
    logger.debug('[Test Gemini SDK] Step 3: Parsing request body...');
    let body;
    try {
      body = await request.json();
      logger.debug('[Test Gemini SDK] ✓ Request body parsed');
      logger.debug('[Test Gemini SDK] Body keys:', Object.keys(body));
      logger.debug('[Test Gemini SDK] Has apiKey:', !!body.apiKey);
      logger.debug('[Test Gemini SDK] Has projectName:', !!body.projectName);
    } catch (parseError) {
      logger.error('[Test Gemini SDK] ✗ Failed to parse request body:', parseError);
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

    // Trim and clean the API key (remove quotes if stored as JSON string)
    apiKey = String(apiKey).trim().replace(/^["']|["']$/g, '');

    if (!apiKey || apiKey.length < 20) {
      return NextResponse.json({ 
        error: 'Invalid API key format. Please check your API key.' 
      }, { status: 400 });
    }

    // Test the API key by making a simple request
    try {
      // Log API key format details for debugging (not the actual key)
      logger.debug('[Test Gemini] ===== Starting SDK Test =====');
      logger.debug('[Test Gemini] API key length:', apiKey.length);
      logger.debug('[Test Gemini] First 4 chars:', apiKey.substring(0, 4));
      logger.debug('[Test Gemini] Last 4 chars:', apiKey.substring(apiKey.length - 4));
      logger.debug('[Test Gemini] Starts with AIza:', apiKey.startsWith('AIza'));
      logger.debug('[Test Gemini] Project name:', projectName || 'not provided');
      
      // Validate API key format (Gemini API keys typically start with "AIza")
      const keyValidation = {
        startsWithAIza: apiKey.startsWith('AIza'),
        length: apiKey.length,
        expectedLength: 39, // Standard Gemini API keys are ~39 characters
        isValidFormat: apiKey.startsWith('AIza') && apiKey.length >= 30 && apiKey.length <= 50,
        hasNonASCII: /[^\x00-\x7F]/.test(apiKey),
        hasSpaces: /\s/.test(apiKey),
        hasQuotes: /^["']|["']$/.test(apiKey),
      };
      
      logger.debug('[Test Gemini] API Key Validation:', keyValidation);
      
      if (!keyValidation.startsWithAIza) {
        logger.warn('[Test Gemini] ⚠️  WARNING: API key does not start with "AIza"');
        logger.warn('[Test Gemini] This is unusual for standard Gemini API keys from Google AI Studio');
        logger.warn('[Test Gemini] This might be:');
        logger.warn('[Test Gemini]   - A Vertex AI key (requires different authentication)');
        logger.warn('[Test Gemini]   - A different type of Google Cloud API key');
        logger.warn('[Test Gemini]   - An incorrectly formatted key');
      }
      
      if (keyValidation.hasSpaces) {
        logger.warn('[Test Gemini] ⚠️  WARNING: API key contains spaces - this may cause authentication issues');
      }
      
      if (keyValidation.hasQuotes) {
        logger.warn('[Test Gemini] ⚠️  WARNING: API key has surrounding quotes - these will be removed');
      }
      
      if (keyValidation.hasNonASCII) {
        logger.warn('[Test Gemini] ⚠️  WARNING: API key contains non-ASCII characters - this is unusual');
      }
      
      if (!keyValidation.isValidFormat) {
        logger.warn('[Test Gemini] ⚠️  WARNING: API key format does not match standard Gemini API key format');
        logger.warn('[Test Gemini] Standard format: Starts with "AIza", 30-50 characters, no spaces/quotes');
      }
      
      // Step 1: Try to initialize the client
      logger.debug('[Test Gemini] Step 1: Initializing GoogleGenAI client...');
      let client: GoogleGenAI;
      try {
        client = new GoogleGenAI({ apiKey });
        logger.debug('[Test Gemini] ✓ Client initialized successfully');
      } catch (initError) {
        logger.error('[Test Gemini] ✗ Client initialization failed:', initError);
        logger.error('[Test Gemini] Init error type:', initError?.constructor?.name);
        logger.error('[Test Gemini] Init error message:', initError instanceof Error ? initError.message : String(initError));
        throw new Error(`Failed to initialize Gemini client: ${initError instanceof Error ? initError.message : 'Unknown error'}`);
      }
      
      // Step 2: Prepare the prompt
      logger.debug('[Test Gemini] Step 2: Preparing test prompt...');
      let testPrompt = 'Say "Connection successful"';
      if (projectName) {
        testPrompt = `Project: ${projectName}\n\n${testPrompt}`;
      }
      logger.debug('[Test Gemini] Test prompt length:', testPrompt.length);
      
      // Step 3: Make the API call
      // Note: TypeScript SDK uses object format: { model, contents }
      // Python SDK uses: generate_content(model=..., contents=...)
      // Both should work, but verify contents is a string (not object)
      logger.debug('[Test Gemini] Step 3: Making API call with model: gemini-2.5-flash');
      logger.debug('[Test Gemini] Prompt type:', typeof testPrompt);
      logger.debug('[Test Gemini] Prompt length:', testPrompt.length);
      logger.debug('[Test Gemini] Prompt preview:', testPrompt.substring(0, 200));
      
      let response;
      try {
        response = await client.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: testPrompt,  // String format (matches Python guide)
        });
        logger.debug('[Test Gemini] ✓ API call completed');
      } catch (apiError) {
        logger.error('[Test Gemini] ✗ API call failed:', apiError);
        logger.error('[Test Gemini] API error type:', apiError?.constructor?.name);
        logger.error('[Test Gemini] API error message:', apiError instanceof Error ? apiError.message : String(apiError));
        
        // Try to extract more details from the API error
        if (apiError && typeof apiError === 'object') {
          const apiErrorDetails = {
            name: (apiError as any).name,
            message: (apiError as any).message,
            status: (apiError as any).status,
            statusCode: (apiError as any).statusCode,
            code: (apiError as any).code,
            cause: (apiError as any).cause,
          };
          logger.error('[Test Gemini] API error details:', JSON.stringify(apiErrorDetails, null, 2));
        }
        throw apiError;
      }

      // Step 4: Extract response
      logger.debug('[Test Gemini] Step 4: Extracting response text...');
      const responseText = response.text || 'Connection successful';
      logger.debug('[Test Gemini] ✓ Response text length:', responseText.length);
      logger.debug('[Test Gemini] ===== SDK Test Successful =====');
      
      return NextResponse.json({ 
        success: true, 
        message: 'Connection successful',
        response: responseText,
        projectName: projectName || null,
        method: 'sdk',
      });
    } catch (error) {
      logger.error('[Test Gemini] Full error object:', error);
      logger.error('[Test Gemini] Error type:', error?.constructor?.name);
      logger.error('[Test Gemini] Error message:', error instanceof Error ? error.message : String(error));
      
      logger.error('[Test Gemini] ===== SDK Test Failed =====');
      logger.error('[Test Gemini] Full error object:', error);
      logger.error('[Test Gemini] Error type:', error?.constructor?.name);
      logger.error('[Test Gemini] Error message:', error instanceof Error ? error.message : String(error));
      logger.error('[Test Gemini] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      
      // Try to extract more details from the error
      let errorDetails: any = {};
      if (error && typeof error === 'object') {
        errorDetails = {
          name: (error as any).name,
          message: (error as any).message,
          status: (error as any).status,
          statusCode: (error as any).statusCode,
          code: (error as any).code,
          cause: (error as any).cause,
          response: (error as any).response ? {
            status: (error as any).response.status,
            statusText: (error as any).response.statusText,
            data: (error as any).response.data,
          } : undefined,
        };
        logger.error('[Test Gemini] Error details:', JSON.stringify(errorDetails, null, 2));
      }
      
      // Provide more detailed error messages
      let errorMessage = 'Failed to connect to Gemini API';
      let errorCode = 'UNKNOWN';
      
      if (error instanceof Error) {
        errorMessage = error.message;
        
        // Check for specific error types
        if (error.message.includes('401') || error.message.includes('Unauthorized') || errorDetails.status === 401) {
          errorMessage = 'Invalid API key. Please check that your API key is correct and has not expired. Make sure you copied the full API key without any extra spaces or characters.';
          errorCode = 'UNAUTHORIZED';
        } else if (error.message.includes('403') || error.message.includes('Forbidden') || errorDetails.status === 403) {
          errorMessage = 'API key does not have permission to access Gemini API.';
          errorCode = 'FORBIDDEN';
        } else if (error.message.includes('429') || errorDetails.status === 429) {
          errorMessage = 'Rate limit exceeded. Please try again later.';
          errorCode = 'RATE_LIMIT';
        } else if (error.message.includes('API key') || error.message.includes('apiKey')) {
          errorMessage = `API key error: ${error.message}`;
          errorCode = 'API_KEY_ERROR';
        } else if (error.message.includes('network') || error.message.includes('fetch')) {
          errorMessage = `Network error: ${error.message}. Please check your internet connection.`;
          errorCode = 'NETWORK_ERROR';
        }
      }
      
      return NextResponse.json(
        { 
          success: false,
          error: errorMessage,
          errorCode,
          details: errorDetails.status ? `Status: ${errorDetails.status}` : undefined,
          method: 'sdk',
          suggestion: !apiKey.startsWith('AIza') 
            ? 'Your API key does not start with "AIza", which is unusual for standard Gemini API keys. This might be a Vertex AI key or a different type of key. Try using the "Test with Direct HTTP" button, or verify you\'re using the correct API key from Google AI Studio (https://aistudio.google.com/).'
            : 'If this error persists, try using the "Test with Direct HTTP" button to bypass the SDK and test the API key directly.',
          keyValidation: {
            startsWithAIza: apiKey.startsWith('AIza'),
            length: apiKey.length,
            hasSpaces: /\s/.test(apiKey),
            hasQuotes: /^["']|["']$/.test(apiKey),
          },
        },
        { status: 400 }
      );
    }
  } catch (error) {
    logger.error('Test connection error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to test connection' },
      { status: 500 }
    );
  }
}
