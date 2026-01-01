import {
  AdminRespondToAuthChallengeCommand,
  CognitoIdentityProviderClient,
} from '@aws-sdk/client-cognito-identity-provider'
import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda'

const cognitoClient = new CognitoIdentityProviderClient({ region: process.env.REGION })

interface VerifyOtpRequest {
  phone_number: string
  otp_code: string
  session: string
}

/**
 * Verify OTP code and return JWT tokens as HTTP-only cookies
 *
 * This Lambda verifies the OTP provided by the user and, if correct,
 * returns JWT tokens (AccessToken, IdToken, RefreshToken) as HTTP-only cookies.
 */
export const handler = async (
  event: APIGatewayProxyEvent,
  _context: Context
): Promise<APIGatewayProxyResult> => {
  try {
    console.log('Verify OTP event:', JSON.stringify(event, null, 2))

    // Parse request body
    if (!event.body) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Request body is required' }),
      }
    }

    const { phone_number, otp_code, session } = JSON.parse(event.body) as VerifyOtpRequest

    // Validate required fields
    if (!phone_number || !otp_code || !session) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'phone_number, otp_code, and session are required' }),
      }
    }

    const userPoolId = process.env.COGNITO_USER_POOL_ID
    const clientId = process.env.COGNITO_CLIENT_ID

    if (!userPoolId || !clientId) {
      throw new Error('Cognito configuration missing')
    }

    // Respond to auth challenge with OTP code
    const authResponse = await cognitoClient.send(
      new AdminRespondToAuthChallengeCommand({
        UserPoolId: userPoolId,
        ClientId: clientId,
        ChallengeName: 'CUSTOM_CHALLENGE',
        ChallengeResponses: {
          USERNAME: phone_number,
          ANSWER: otp_code,
        },
        Session: session,
      })
    )

    // Check if authentication was successful
    if (!authResponse.AuthenticationResult) {
      return {
        statusCode: 401,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Invalid OTP code' }),
      }
    }

    const { AccessToken, IdToken, RefreshToken } = authResponse.AuthenticationResult

    if (!AccessToken || !IdToken || !RefreshToken) {
      throw new Error('Missing tokens in authentication result')
    }

    console.log(`OTP verified successfully for ${phone_number}`)

    // Set HTTP-only cookies
    // Domain is required for cookies to work across subdomains (www.macconnachie.com and macconnachie.com)
    const isProduction = process.env.STAGE === 'prod'
    const domainSuffix = isProduction ? '; Domain=macconnachie.com' : ''
    const secureFlag = isProduction ? 'Secure; ' : ''
    const cookieOptions = `HttpOnly; ${secureFlag}SameSite=Lax; Path=/${domainSuffix}`
    const accessTokenCookie = `AccessToken=${AccessToken}; Max-Age=3600; ${cookieOptions}`
    const idTokenCookie = `IdToken=${IdToken}; Max-Age=3600; ${cookieOptions}`
    const refreshTokenCookie = `RefreshToken=${RefreshToken}; Max-Age=2592000; ${cookieOptions}`

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
      },
      cookies: [accessTokenCookie, idTokenCookie, refreshTokenCookie],
      body: JSON.stringify({
        message: 'Authentication successful',
        user: {
          phone_number,
        },
      }),
    }
  } catch (error: unknown) {
    console.error('Error verifying OTP:', error)

    // Handle specific Cognito errors
    if ((error as Error).name === 'NotAuthorizedException') {
      return {
        statusCode: 401,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Invalid OTP code or session expired' }),
      }
    }

    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: 'Failed to verify OTP',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
    }
  }
}
