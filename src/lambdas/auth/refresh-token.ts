import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
} from '@aws-sdk/client-cognito-identity-provider'
import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda'

const cognitoClient = new CognitoIdentityProviderClient({ region: process.env.REGION })

/**
 * Refresh Access Token using Refresh Token
 *
 * This Lambda refreshes the user's access token using the refresh token
 * stored in HTTP-only cookies. This allows users to stay logged in without
 * re-entering their OTP on every page load.
 */
export const handler = async (
  event: APIGatewayProxyEvent,
  _context: Context
): Promise<APIGatewayProxyResult> => {
  try {
    console.log('Refresh token event')

    // Extract refresh token from cookies
    const cookies = event.headers?.cookie || event.headers?.Cookie || ''

    if (!cookies) {
      return {
        statusCode: 401,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'No cookies found' }),
      }
    }

    // Parse RefreshToken from cookies
    const refreshTokenMatch = cookies.match(/RefreshToken=([^;]+)/)

    if (!refreshTokenMatch || !refreshTokenMatch[1]) {
      return {
        statusCode: 401,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'No refresh token found' }),
      }
    }

    const refreshToken = refreshTokenMatch[1]

    const clientId = process.env.COGNITO_CLIENT_ID

    if (!clientId) {
      throw new Error('Cognito configuration missing')
    }

    console.log('Attempting to refresh tokens')

    // Use refresh token to get new access token
    const authResponse = await cognitoClient.send(
      new InitiateAuthCommand({
        ClientId: clientId,
        AuthFlow: 'REFRESH_TOKEN_AUTH',
        AuthParameters: {
          REFRESH_TOKEN: refreshToken,
        },
      })
    )

    if (!authResponse.AuthenticationResult) {
      return {
        statusCode: 401,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Failed to refresh token' }),
      }
    }

    const { AccessToken, IdToken } = authResponse.AuthenticationResult

    if (!AccessToken || !IdToken) {
      throw new Error('Missing tokens in authentication result')
    }

    console.log('Tokens refreshed successfully')

    // Set HTTP-only cookies with new tokens
    // Domain is required for cookies to work across subdomains (www.macconnachie.com and macconnachie.com)
    const isProduction = process.env.STAGE === 'prod'
    const domainSuffix = isProduction ? '; Domain=macconnachie.com' : ''
    const secureFlag = isProduction ? 'Secure; ' : ''
    const cookieOptions = `HttpOnly; ${secureFlag}SameSite=Lax; Path=/${domainSuffix}`
    const accessTokenCookie = `AccessToken=${AccessToken}; Max-Age=3600; ${cookieOptions}`
    const idTokenCookie = `IdToken=${IdToken}; Max-Age=3600; ${cookieOptions}`

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
      },
      multiValueHeaders: {
        'Set-Cookie': [accessTokenCookie, idTokenCookie],
      },
      body: JSON.stringify({
        message: 'Tokens refreshed successfully',
      }),
    }
  } catch (error: unknown) {
    console.error('Error refreshing token:', error)

    // Handle specific Cognito errors
    if ((error as Error).name === 'NotAuthorizedException') {
      return {
        statusCode: 401,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Refresh token expired or invalid' }),
      }
    }

    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: 'Failed to refresh token',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
    }
  }
}
